import joblib
import pandas as pd
import numpy as np
import os
import sys

# Add backend to path to import helpers if needed, but we can just replicate logic
sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")

model_path = r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib"
model = joblib.load(model_path)

def get_skill_boost(points: int, english: str, experience: int) -> float:
    boost = 0.0
    if points >= 95: boost += 0.20
    elif points >= 90: boost += 0.15
    elif points >= 80: boost += 0.10
    
    if english == "superior": boost += 0.10
    elif english == "proficient": boost += 0.05
    
    if experience >= 10: boost += 0.10
    elif experience >= 8: boost += 0.08
    elif experience >= 5: boost += 0.05
    return boost

# Test inputs (from User's postman screenshot)
occupation = "261313"
state = "NSW"
points = 80
english_level = "proficient"
age = 30
experience = 5

df = pd.DataFrame([{
    "occupation": occupation, "state": state,
    "points": points, "english_level": english_level,
    "age": age, "experience": experience,
}])

probs = model.predict_proba(df)[0]
classes = list(model.classes_)
print(f"Model classes: {classes}")
print(f"Probabilities: {probs}")

# Get prob for 190 (Class 1) or 491 (Class 2)
p190 = probs[classes.index(1)] if 1 in classes else 0
p491 = probs[classes.index(2)] if 2 in classes else 0

skill_boost = get_skill_boost(points, english_level, experience)
print(f"Skill boost: {skill_boost}")

# Simulate score for some state (e.g. TAS like in user screenshot)
final_score_491 = p491 + 0.0 + 0.0 + 0.0 + skill_boost # No state/shortage boost for simplicity
print(f"Final score 491 (Base + Skill): {final_score_491}")

# User's case in screenshot had TAS 491 at 0.57.
# With skill boost (+0.05 points + 0.02 english + 0.02 exp = +0.09) 
# and potentially higher base prob from model, should hit >0.7.
