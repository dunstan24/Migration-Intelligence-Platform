import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

def check_base(p, e, x, a, st="QLD", v_idx=2):
    df = pd.DataFrame([{"occupation":"261313","state":st,"points":p,"english_level":e,"age":a,"experience":x}])
    return round(model.predict_proba(df)[0][v_idx], 4)

print("Base Probs for 491 QLD (105pt, 10yr):")
for age in range(39, 46):
    print(f"Age {age}: {check_base(105, 'proficient', 10, age)}")
