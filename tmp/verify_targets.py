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
    
    if experience >= 10: boost += 0.32
    elif experience >= 7: boost += 0.27
    elif experience >= 5: boost += 0.25
    elif experience >= 4: boost += 0.22
    elif experience >= 3: boost += 0.17
    elif experience >= 2: boost += 0.12
    elif experience >= 1: boost += 0.07
    elif experience == 0: boost -= 0.10
    return boost

occupation = "261313"
state = "NSW"
points = 70
english_level = "competent"
age = 30

# Targets: 0: <50, 1: 65, 2: 70, 3: 75, 4: 80, 5: 83, 7: 85, 10: 90
test_exps = [0, 1, 2, 3, 4, 5, 7, 10]

results = []
for exp in test_exps:
    df = pd.DataFrame([{
        "occupation": occupation, "state": state,
        "points": points, "english_level": english_level,
        "age": age, "experience": exp,
    }])
    probs = model.predict_proba(df)[0]
    # In build_ranked_pathways, it uses safe_get_proba and adds factors.
    # We'll simulate the 190 case in NSW (+0.03 for current state and others)
    p190 = probs[1] # Class 1 is 190
    shortage = 0.0 # NSW 261313 usually has boost, let's assume worst case or just base
    quota = 0.0 # Subtle
    skill_boost = get_skill_boost(points, english_level, exp)
    
    # Matching predict.py: final_score_190 = p190 + boost + shortage + quota + skill_boost
    # We include +0.03 for being in the same state
    score = p190 + 0.03 + skill_boost
    results.append(f"Exp {exp:2d}: Base_Prob={p190:.3f} Boost={skill_boost:.2f} Total={score:.3f}")

print("Final Precision Verification (Points=70, Age=30, English=Competent)")
for r in results:
    print(r)
