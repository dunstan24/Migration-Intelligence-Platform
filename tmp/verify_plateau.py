import joblib
import pandas as pd
import numpy as np
import sys
import os

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")

model_path = r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib"
model = joblib.load(model_path)

def get_skill_boost(points, english, experience, age):
    boost = 0.0
    
    # ── Point-based boost with Diminishing Returns ──
    if points > 100:
        boost += 0.22 # Max points boost plateau
    elif points >= 95: boost += 0.20
    elif points >= 90: boost += 0.15
    elif points >= 80: boost += 0.10
    elif points >= 70: boost += 0.05
    
    # ── English proficiency boost (Reduced influence) ──
    if english == "superior": boost += 0.05
    elif english == "proficient": boost += 0.02
    
    # ── Experience boost with Diminishing Returns ──
    if experience > 10:
        boost += 0.20 + (min(experience, 20) - 10) * 0.005 # Plateau growth
    elif experience >= 7: boost += 0.14
    elif experience >= 5: boost += 0.10
    elif experience >= 4: boost += 0.07
    elif experience >= 3: boost += 0.05
    elif experience >= 2: boost += 0.00
    elif experience >= 1: boost -= 0.10
    elif experience == 0: boost -= 0.22
    
    # ── Elite Experience Bonus ──
    if experience >= 7 and (english == "superior" or points >= 75):
        boost += 0.10
        
    # ── Age Penalty/Diminishing Returns (Rules for 186/190 subclasses) ──
    if age >= 45:
        boost -= 0.40 # Deep penalty but not 0
    elif age >= 40:
        boost -= (age - 39) * 0.05 # Progressive penalty
        
    return boost

def run_test(points, english, experience, age, label):
    df = pd.DataFrame([{
        "occupation": "261313", "state": "NSW",
        "points": points, "english_level": english,
        "age": age, "experience": experience,
    }])
    p190 = model.predict_proba(df)[0][1]
    boost = get_skill_boost(points, english, experience, age)
    score = p190 + 0.03 + boost
    final_score = max(0.01, min(score, 1.0)) # Floor at 1%
    return f"{label:<40} | Base: {p190:.3f} | Boost: {boost:.2f} | Final: {final_score:.3%}"

print(f"{'Test Case':<40} | Results")
print("-" * 80)

# Baseline
print(run_test(80, "proficient", 3, 30, "30yo, 80pts, 3yr (Target ~71%)"))

# Age Tests
print(run_test(80, "proficient", 3, 40, "40yo, 80pts, 3yr (Penalty)"))
print(run_test(80, "proficient", 3, 44, "44yo, 80pts, 3yr (Penalty)"))
print(run_test(80, "proficient", 3, 45, "45yo, 80pts, 3yr (Plateau)"))
print(run_test(80, "proficient", 3, 55, "55yo, 80pts, 3yr (Plateau)"))

# Experience Plateau
print(run_test(80, "proficient", 10, 30, "10yr Experience"))
print(run_test(80, "proficient", 15, 30, "15yr Experience (Plateau)"))
print(run_test(80, "proficient", 20, 30, "20yr Experience (Plateau)"))

# Points Plateau
print(run_test(100, "proficient", 3, 30, "100 Points"))
print(run_test(120, "proficient", 3, 30, "120 Points (Plateau)"))
print(run_test(140, "proficient", 3, 30, "140 Points (Plateau)"))
