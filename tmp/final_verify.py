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
    
    if experience >= 10: boost += 0.27
    elif experience >= 7: boost += 0.22
    elif experience >= 5: boost += 0.20
    elif experience >= 4: boost += 0.17
    elif experience >= 3: boost += 0.12
    elif experience >= 2: boost += 0.05
    elif experience >= 1: boost -= 0.05
    elif experience == 0: boost -= 0.25
    return boost

occupation = "261313"
state = "NSW"
points = 70
english_level = "competent"
age = 30

test_exps = {
    0: 0.50,
    1: 0.65,
    2: 0.70,
    3: 0.75,
    4: 0.80,
    5: 0.83,
    7: 0.85,
    10: 0.90
}

with open(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\tmp\verification_log.txt", "w", encoding="utf-8") as f:
    f.write(f"{'Exp':<4} | {'Base':<6} | {'Boost':<6} | {'Score':<6} | {'Target':<6} | {'Status'}\n")
    f.write("-" * 55 + "\n")

    for exp, target in test_exps.items():
        df = pd.DataFrame([{
            "occupation": occupation, "state": state,
            "points": points, "english_level": english_level,
            "age": age, "experience": exp,
        }])
        probs = model.predict_proba(df)[0]
        p190 = probs[1]
        
        skill_boost = get_skill_boost(points, english_level, exp)
        score = p190 + 0.03 + skill_boost
        
        status = "OK" if score <= target + 0.01 else "HIGH"
        if exp == 0 and score >= 0.50: status = "HIGH"

        f.write(f"{exp:<4} | {p190:<6.3f} | {skill_boost:<6.2f} | {score:<6.3f} | {target:<6.2f} | {status}\n")

print("Done. Check d:\\Interlace_DataAnalyst\\Migration-Intelligence-Platform\\tmp\\verification_log.txt")
