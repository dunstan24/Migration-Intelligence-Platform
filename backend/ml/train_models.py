import os
import sqlite3
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
import joblib

def create_mock_data():
    """Generates synthetic tabular data matching API inputs."""
    np.random.seed(42)
    n = 1000
    
    data = pd.DataFrame({
        'occupation': np.random.choice(['221111', '261313', '254412', '133111', '351311', '100000'], n),
        'state': np.random.choice(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'], n),
        'points': np.random.randint(60, 120, n),
        'english': np.random.choice(['competent', 'proficient', 'superior'], n),
        'age': np.random.randint(18, 45, n),
        'experience': np.random.randint(0, 15, n),
        'country': np.random.choice(['IN', 'CN', 'UK', 'PH', 'PH', 'VN'], n),
        'visa_type': np.random.choice(['189', '190', '491'], n),
        
        # shortage features
        'shortage_streak': np.random.randint(0, 5, n),
        'employment_growth': np.random.uniform(-0.05, 0.15, n),
        
        # volume features
        'base_trend': np.random.uniform(0.1, 1.0, n),
        'seasonal': np.random.uniform(0.5, 1.5, n),
        
        # approval features
        'english_band': np.random.uniform(6.0, 9.0, n),
        'skills_assessed': np.random.choice(['True', 'False'], n, p=[0.9, 0.1]),
        'country_risk_tier': np.random.choice([1, 2, 3], n, p=[0.8, 0.15, 0.05]),
    })
    
    # pathway target (classification)
    data['pathway_target'] = np.random.randint(0, 3, n)  # 0:189, 1:190, 2:491
    
    # shortage target (regression - probability)
    data['shortage_target'] = np.random.uniform(0, 1, n)
    
    # volume target (regression)
    data['volume_target'] = np.random.randint(100, 5000, n)
    
    # approval target (classification)
    data['approval_target'] = np.random.choice([0, 1], n, p=[0.2, 0.8])
    
    return data

def train_and_save():
    print("Generating synthetic data for models...")
    df = create_mock_data()
    
    os.makedirs('ml/serialized', exist_ok=True)
    
    # Helper to create a basic pipeline
    def make_pipeline(num_cols, cat_cols, is_classifier=True):
        numeric_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ])
        
        # We'll use a simple ordinal encoding for categoricals so RF can ingest them easily
        from sklearn.preprocessing import OrdinalEncoder
        categorical_transformer = Pipeline(steps=[
            ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
            ('encoder', OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1))
        ])
        
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', numeric_transformer, num_cols),
                ('cat', categorical_transformer, cat_cols)
            ])
            
        model = RandomForestClassifier(n_estimators=50, random_state=42) if is_classifier else RandomForestRegressor(n_estimators=50, random_state=42)
        
        return Pipeline(steps=[('preprocessor', preprocessor), ('model', model)])
    
    print("Training Model A: Pathway Recommendation")
    # Pathway features
    X_a = df[['occupation', 'state', 'points', 'english', 'age', 'experience']]
    y_a = df['pathway_target']
    mod_a = make_pipeline(num_cols=['points', 'age', 'experience'], cat_cols=['occupation', 'state', 'english'], is_classifier=True)
    mod_a.fit(X_a, y_a)
    joblib.dump(mod_a, 'ml/serialized/model_a.joblib')
    
    print("Training Model B: Shortage Forecast")
    X_b = df[['shortage_streak', 'employment_growth', 'occupation', 'state']]
    y_b = df['shortage_target']
    mod_b = make_pipeline(num_cols=['shortage_streak', 'employment_growth'], cat_cols=['occupation', 'state'], is_classifier=False)
    mod_b.fit(X_b, y_b)
    joblib.dump(mod_b, 'ml/serialized/model_b.joblib')

    print("Training Model C: Volume Prediction")
    X_c = df[['base_trend', 'seasonal', 'occupation', 'state']]
    y_c = df['volume_target']
    mod_c = make_pipeline(num_cols=['base_trend', 'seasonal'], cat_cols=['occupation', 'state'], is_classifier=False)
    mod_c.fit(X_c, y_c)
    joblib.dump(mod_c, 'ml/serialized/model_c.joblib')
    
    print("Training Model D: Approval Probability")
    X_d = df[['points', 'english_band', 'skills_assessed', 'country_risk_tier', 'experience']]
    y_d = df['approval_target']
    mod_d = make_pipeline(num_cols=['points', 'english_band', 'country_risk_tier', 'experience'], cat_cols=['skills_assessed'], is_classifier=True)
    mod_d.fit(X_d, y_d)
    joblib.dump(mod_d, 'ml/serialized/model_d.joblib')

    print("Successfully trained and saved all 4 baseline models to ml/serialized/")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    os.chdir("../") # go to backend/
    train_and_save()
