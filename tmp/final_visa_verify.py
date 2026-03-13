import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

from routers.predict import get_skill_boost

def check(p, e, x, a, visa_idx, label):
    df = pd.DataFrame([{"occupation":"261313","state":"NSW","points":p,"english_level":e,"age":a,"experience":x}])
    base_prob = model.predict_proba(df)[0][visa_idx]
    boost = 0.03 + get_skill_boost(p, e, x, a)
    final = round(max(0.01, min(base_prob + boost, 1.0)), 3)
    return f"{label:<40} | Base: {base_prob:.3f} | Final: {final:.3%}"

print(f"{'Test':<40} | Result")
print("-" * 65)
print(check(80, "proficient", 3, 30, 1, "190: Age 30 Baseline")) # State Nominated
print(check(100, "proficient", 11, 46, 2, "491: Age 46 User Case")) # Regional
print(check(80, "proficient", 3, 40, 1, "190: Age 40 Mid-Penalty"))
print(check(80, "proficient", 3, 45, 1, "190: Age 45 Plateau"))
