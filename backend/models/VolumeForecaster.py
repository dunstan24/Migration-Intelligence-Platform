import pandas as pd
import numpy as np
from prophet import Prophet
from statsmodels.tsa.arima.model import ARIMA
from sklearn.metrics import mean_absolute_percentage_error
import warnings
import logging
import glob
import os
import json

# Suppress warnings agar output terminal bersih dan fokus pada JSON
warnings.filterwarnings('ignore')
logging.getLogger('prophet').setLevel(logging.WARNING)

def prepare_data():
    # Menghilangkan print log agar tidak mengganggu struktur JSON di terminal jika diperlukan
    # Namun saya biarkan log minimal untuk tracing proses
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    all_mig_data = []
    mig_files = glob.glob(os.path.join(base_dir, 'dataset', 'migration_trend', '*.xls*'))
    
    for file in mig_files:
        try:
            xl = pd.ExcelFile(file)
            target = next((str(s) for s in xl.sheet_names if any(k.lower() in str(s).lower() for k in ['arrivals', 'table 1'])), None)
            if target:
                skip = 16 if 'arrivals' in target.lower() else 23
                df_temp = pd.read_excel(file, sheet_name=target, skiprows=skip)
                cat_col = next((c for c in df_temp.columns if 'category' in str(c).lower()), df_temp.columns[0])
                date_cols = [c for c in df_temp.columns if any(str(yr) in str(c) for yr in range(2010, 2027))]
                if date_cols:
                    df_long = df_temp.melt(id_vars=[cat_col], value_vars=date_cols, var_name='ds', value_name='mig_y')
                    all_mig_data.append(df_long)
        except Exception: pass

    all_stu_data = []
    stu_files = glob.glob(os.path.join(base_dir, 'dataset', 'visas_student', '*.xls*'))
    
    for file in stu_files:
        try:
            xl = pd.ExcelFile(file)
            target = next((str(s) for s in xl.sheet_names if any(k.lower() in str(s).lower() for k in ['granted', 'lodged', 'rates', 'table 1'])), None)
            if target:
                df_raw = pd.read_excel(file, sheet_name=target)
                date_row_idx = -1
                for i in range(min(30, len(df_raw))):
                    row_vals = [str(val) for val in df_raw.iloc[i].values]
                    if sum('20' in s for s in row_vals) >= 3:
                        date_row_idx = i
                        break
                
                if date_row_idx != -1:
                    dates = df_raw.iloc[date_row_idx].values[2:]
                    search_range = df_raw.iloc[max(0, date_row_idx-5):date_row_idx+5, 2:]
                    numeric_sum = search_range.apply(pd.to_numeric, errors='coerce').sum(axis=1)
                    total_row_idx = numeric_sum.idxmax()
                    counts = df_raw.loc[total_row_idx].values[2:]
                    if len(dates) == len(counts):
                        all_stu_data.append(pd.DataFrame({'ds': dates, 'stu_y': counts}))
        except Exception: pass

    if not all_mig_data or not all_stu_data:
        return None, None, None

    df_mig = pd.concat(all_mig_data)
    df_mig['ds'] = pd.to_datetime(df_mig['ds'], errors='coerce')
    df_mig = df_mig.dropna(subset=['ds']).groupby('ds')['mig_y'].mean().reset_index()

    df_stu = pd.concat(all_stu_data)
    df_stu['ds'] = pd.to_datetime(df_stu['ds'], errors='coerce')
    df_stu = df_stu.dropna(subset=['ds']).groupby('ds')['stu_y'].mean().reset_index()
    
    df = pd.merge(df_mig, df_stu, on='ds', how='outer').sort_values('ds')
    for col in ['stu_y', 'mig_y']:
        df[col] = pd.to_numeric(df[col].astype(str).str.replace(r'[^0-9.]', '', regex=True), errors='coerce')
    
    df['y'] = df['stu_y'].interpolate(method='linear').ffill().bfill()
    df['mig_y'] = df['mig_y'].interpolate(method='linear').ffill().bfill()
    df = df.dropna(subset=['ds']).reset_index(drop=True)
    df = df[df['y'] > 0].reset_index(drop=True)

    df['covid'] = df['ds'].apply(lambda x: 1.0 if x.year in [2020, 2021] else 0.0)
    df['planning_level'] = np.linspace(20000.0, 35000.0, len(df))

    if len(df) > 10:
        split_idx = int(len(df) * 0.8)
        return df, df.iloc[:split_idx].copy(), df.iloc[split_idx:].copy()
    else:
        return df, df, df.tail(1)

def train_forecaster(df, train_df, test_df):
    if len(train_df) < 2: return None, None, 0

    eval_model = Prophet(interval_width=0.80, yearly_seasonality=True)
    eval_model.add_regressor('covid')
    eval_model.add_regressor('planning_level')
    eval_model.fit(train_df)

    future_eval = test_df[['ds', 'covid', 'planning_level']]
    eval_forecast = eval_model.predict(future_eval)
    mape = mean_absolute_percentage_error(test_df['y'], eval_forecast['yhat'])

    last_date = df['ds'].max()
    future_dates = pd.date_range(start=last_date + pd.DateOffset(months=1), end='2030-12-01', freq='MS')
    future_df = pd.DataFrame({
        'ds': future_dates,
        'covid': 0.0,
        'planning_level': np.linspace(df['planning_level'].max(), 35000, len(future_dates))
    })

    if mape > 0.25:
        res_type = "ARIMA"
        df_arima = df.set_index('ds').resample('MS').mean().ffill()
        model_arima = ARIMA(df_arima['y'], order=(2, 1, 2))
        res_arima = model_arima.fit()
        fc = res_arima.get_forecast(steps=len(future_dates))
        res_forecast = pd.DataFrame({
            'ds': future_dates,
            'yhat': fc.predicted_mean.values,
            'yhat_lower_95': fc.conf_int(alpha=0.05).iloc[:, 0].values,
            'yhat_upper_95': fc.conf_int(alpha=0.05).iloc[:, 1].values,
            'yhat_lower_80': fc.conf_int(alpha=0.20).iloc[:, 0].values,
            'yhat_upper_80': fc.conf_int(alpha=0.20).iloc[:, 1].values
        })
    else:
        res_type = "Prophet"
        final_model = Prophet(interval_width=0.95, yearly_seasonality=True)
        final_model.add_regressor('covid')
        final_model.add_regressor('planning_level')
        final_model.fit(df)
        forecast = final_model.predict(future_df)
        res_forecast = pd.DataFrame({
            'ds': forecast['ds'],
            'yhat': forecast['yhat'],
            'yhat_lower_95': forecast['yhat_lower'],
            'yhat_upper_95': forecast['yhat_upper'],
            'yhat_lower_80': forecast['yhat'] - (forecast['yhat'] - forecast['yhat_lower']) * 0.65,
            'yhat_upper_80': forecast['yhat'] + (forecast['yhat_upper'] - forecast['yhat']) * 0.65
        })
    return res_type, res_forecast, mape

# --- EKSEKUSI UTAMA ---
df_clean, train, test = prepare_data()
if df_clean is not None:
    final_type, results, mape_val = train_forecaster(df_clean, train, test)

    # --- OUTPUT JSON (Siap untuk Postman) ---
    results['ds'] = results['ds'].dt.strftime('%Y-%m-%d')
    json_response = {
        "status": "success",
        "metadata": {
            "algorithm": final_type,
            "mape": round(float(mape_val), 5),
            "historical_points": len(df_clean)
        },
        "predictions": results.to_dict(orient='records')
    }
    print(json.dumps(json_response, indent=4))
else:
    print(json.dumps({"status": "error", "message": "Data preparation failed"}, indent=4))