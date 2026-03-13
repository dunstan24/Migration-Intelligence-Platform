import joblib
import pandas as pd
import numpy as np
import sys
import os

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")

model_path = r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib"
model = joblib.load(model_path)

def get_skill_boost(points, english, experience):
    boost = 0.0
    if points >= 95: boost += 0.20
    elif points >= 90: boost += 0.15
    elif points >= 80: boost += 0.10
    elif points >= 70: boost += 0.05
    
    # Reduced English Weight
    if english == "superior": boost += 0.05
    elif english == "proficient": boost += 0.02
    
    # Recalibrated Experience weight
    if experience >= 10: boost += 0.23
    elif experience >= 7: boost += 0.17
    elif experience >= 5: boost += 0.10
    elif experience >= 4: boost += 0.04
    elif experience >= 3: boost += 0.03
    elif experience >= 2: boost -= 0.05
    elif experience >= 1: boost -= 0.15
    elif experience == 0: boost -= 0.40
    
    if experience >= 7 and (english == "superior" or points >= 75):
        boost += 0.15
    return boost

occupation = "261313"
state = "NSW"
age = 30

cases = [
    (70, "competent", 0, "0yr Baseline (70pts)"),
    (65, "proficient", 0, "0yr User (65pts)"),
    (70, "proficient", 3, "3yr Mid (70pts, Prof)"),
    (65, "proficient", 7, "7yr Mid (65pts, Prof)"),
    (75, "proficient", 7, "7yr Elite (75pts, Prof)"),
    (65, "superior", 7, "7yr Elite (65pts, Sup)"),
]

print(f"{'Case':<30} | {'Base':<6} | {'Boost':<6} | {'Final':<6}")
print("-" * 65)

for p, en, x, l in cases:
    df = pd.DataFrame([{
        "occupation": occupation, "state": state,
        "points": p, "english_level": en,
        "age": age, "experience": x,
    }])
    p190 = model.predict_proba(df)[0][1]
    boost = get_skill_boost(p, en, x)
    score = p190 + 0.03 + boost
    print(f"{l:<30} | {p190:<6.3f} | {boost:<6.2f} | {min(score, 1.0):<6.3f}")
