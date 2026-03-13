import joblib
import pandas as pd
import numpy as np
import os
import sys

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
    
    if experience >= 10: boost += 0.12
    elif experience >= 8: boost += 0.10
    elif experience >= 5: boost += 0.05
    elif experience >= 4: boost += 0.02
    elif experience >= 3: boost -= 0.05
    elif experience >= 2: boost -= 0.15
    elif experience >= 1: boost -= 0.25
    elif experience == 0: boost -= 0.35
    return boost

occupation = "261313"
state = "NSW"
points = 65
english_level = "competent"
age = 30

for exp in [0, 1, 2, 3, 4, 5]:
    print(f"\n--- Testing Experience: {exp} ---")
    df = pd.DataFrame([{
        "occupation": occupation, "state": state,
        "points": points, "english_level": english_level,
        "age": age, "experience": exp,
    }])

    probs = model.predict_proba(df)[0]
    classes = list(model.classes_)
    print(f"Model Classes: {classes}")
    print(f"Probabilities: {probs}")
    
    # Check max prob across all classes
    max_prob = np.max(probs)
    skill_boost = get_skill_boost(points, english_level, exp)
    
    final_score = max_prob + skill_boost
    print(f"Max Prob: {max_prob:.4f}")
    print(f"Skill Boost: {skill_boost:.4f}")
    print(f"Final Score: {final_score:.4f}")
