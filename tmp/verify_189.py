import joblib
import pandas as pd
import numpy as np
import os
import sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")

model_path = r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib"
model = joblib.load(model_path)

# Test inputs for high-skill candidate (likely for 189)
occupation = "261313"
state = "NSW"
points = 95 # Very high for 189
english_level = "superior"
age = 30
experience = 8

df = pd.DataFrame([{
    "occupation": occupation, "state": state,
    "points": points, "english_level": english_level,
    "age": age, "experience": experience,
}])

probs = model.predict_proba(df)[0]
classes = list(model.classes_)
print(f"Model classes: {classes}")
print(f"Probabilities: {probs}")

# Map to names
visa_map = {0: "189", 1: "190", 2: "491"}
for i, prob in enumerate(probs):
    cls_val = classes[i]
    name = visa_map.get(cls_val, "Unknown")
    print(f"Visa {name} (Class {cls_val}): {prob:.4f}")
