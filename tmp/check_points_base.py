import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

def get_base(p, e, x, a, st="NSW", v_idx=1):
    df = pd.DataFrame([{"occupation":"261313","state":st,"points":p,"english_level":e,"age":a,"experience":x}])
    return model.predict_proba(df)[0][v_idx]

print("--- Base Model Probs (NSW 190) ---")
for p in [60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115]:
    prob = get_base(p, "proficient", 3, 30)
    print(f"Points {p}: {prob:.4f}")

print("\n--- Base Model Probs (NT 190) ---")
for p in [60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115]:
    prob = get_base(p, "proficient", 3, 30, st="NT")
    print(f"Points {p}: {prob:.4f}")
