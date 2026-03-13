import joblib
import pandas as pd
import numpy as np
import sys
import os

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")

model_path = r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib"
model = joblib.load(model_path)

def get_skill_boost(points: int, english: str, experience: int) -> float:
    boost = 0.0
    if points >= 95: boost += 0.20
    elif points >= 90: boost += 0.15
    elif points >= 80: boost += 0.10
    elif points >= 70: boost += 0.05
    
    if english == "superior": boost += 0.10
    elif english == "proficient": boost += 0.05
    
    if experience >= 10: boost += 0.18
    elif experience >= 7: boost += 0.12
    elif experience >= 5: boost += 0.05
    elif experience >= 4: boost -= 0.01
    elif experience >= 3: boost -= 0.02
    elif experience >= 2: boost -= 0.10
    elif experience >= 1: boost -= 0.20
    elif experience == 0: boost -= 0.45
    
    if experience >= 7 and (english == "superior" or points >= 75):
        boost += 0.15
    return boost

occupation = "261313"
state = "NSW"
age = 30

test_cases = [
    {"pts": 70, "eng": "competent", "exp": 0, "target": 0.50, "label": "0yr (Mid Profile)"},
    {"pts": 65, "eng": "proficient", "exp": 7, "target": 0.90, "label": "7yr (65pt Profile)"},
    {"pts": 75, "eng": "proficient", "exp": 7, "target": 1.00, "label": "7yr (Elite Profile - 75pt)"},
    {"pts": 65, "eng": "superior", "exp": 10, "target": 1.00, "label": "10yr (Elite Profile - Superior)"},
]

print(f"{'Case':<30} | {'Base':<6} | {'Boost':<6} | {'Score':<6} | {'Target'}")
print("-" * 75)

for case in test_cases:
    df = pd.DataFrame([{
        "occupation": occupation, "state": state,
        "points": case["pts"], "english_level": case["eng"],
        "age": age, "experience": case["exp"],
    }])
    probs = model.predict_proba(df)[0]
    p190 = probs[1]
    
    skill_boost = get_skill_boost(case["pts"], case["eng"], case["exp"])
    score = p190 + 0.03 + skill_boost # +0.03 for state match
    
    label = case["label"]
    print(f"{label:<30} | {p190:<6.3f} | {skill_boost:<6.2f} | {score:<6.3f} | {case['target']:.2f}")
