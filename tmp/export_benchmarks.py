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

# Expanded test cases
test_cases = [
    # Baseline for 0yr
    {"pts": 70, "eng": "competent", "exp": 0, "label": "0yr Baseline (70pts)"},
    {"pts": 65, "eng": "proficient", "exp": 0, "label": "0yr (User Postman - 65pts)"},
    # 7yr transition
    {"pts": 65, "eng": "proficient", "exp": 7, "label": "7yr Mid (65pts, Proficient)"},
    {"pts": 70, "eng": "proficient", "exp": 7, "label": "7yr Mid (70pts, Proficient)"},
    {"pts": 75, "eng": "proficient", "exp": 7, "label": "7yr Elite (75pts, Proficient)"},
    {"pts": 65, "eng": "superior", "exp": 7, "label": "7yr Elite (65pts, Superior)"},
    # 10yr transition
    {"pts": 75, "eng": "superior", "exp": 10, "label": "10yr Elite Max"},
]

results = []
for case in test_cases:
    df = pd.DataFrame([{
        "occupation": occupation, "state": state,
        "points": case["pts"], "english_level": case["eng"],
        "age": age, "experience": case["exp"],
    }])
    p190 = model.predict_proba(df)[0][1]
    boost = get_skill_boost(case["pts"], case["eng"], case["exp"])
    score = p190 + 0.03 + boost
    results.append({
        "Label": case["label"],
        "Base": round(p190, 3),
        "Boost": round(boost, 2),
        "Final": round(min(score, 1.0), 4)
    })

pd.DataFrame(results).to_csv(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\tmp\final_benchmarks.csv", index=False)
print("Benchmarks exported to tmp/final_benchmarks.csv")
