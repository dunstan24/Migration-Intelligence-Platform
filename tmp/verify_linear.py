import joblib
import pandas as pd
import numpy as np

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
    
    if experience >= 10: boost += 0.40
    elif experience >= 8: boost += 0.35
    elif experience >= 5: boost += 0.27
    elif experience >= 4: boost += 0.22
    elif experience >= 3: boost += 0.17
    elif experience >= 2: boost += 0.12
    elif experience >= 1: boost += 0.02
    elif experience == 0: boost -= 0.08
    return boost

occupation = "261313"
state = "NSW"
points = 70
english_level = "competent"
age = 30

results = []
for exp in range(6):
    df = pd.DataFrame([{
        "occupation": occupation, "state": state,
        "points": points, "english_level": english_level,
        "age": age, "experience": exp,
    }])
    probs = model.predict_proba(df)[0]
    max_prob = np.max(probs)
    boost = get_skill_boost(points, english_level, exp)
    final = max_prob + boost
    results.append(f"Exp {exp}: Base={max_prob:.2f} Boost={boost:.2f} Final={final:.2f}")

for r in results:
    print(r)
