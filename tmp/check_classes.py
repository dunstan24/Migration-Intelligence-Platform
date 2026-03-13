import joblib
import os

BASE_DIR = r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend"
MODEL_SAVE_PATH = os.path.join(BASE_DIR, "models", "model_a.joblib")

if os.path.exists(MODEL_SAVE_PATH):
    model = joblib.load(MODEL_SAVE_PATH)
    print(f"Model classes: {model.classes_}")
else:
    print("Model file not found.")
