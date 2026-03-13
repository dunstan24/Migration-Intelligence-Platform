import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

def check_491(p, e, x, a):
    df = pd.DataFrame([{"occupation":"261313","state":"QLD","points":p,"english_level":e,"age":a,"experience":x}])
    probs = model.predict_proba(df)[0]
    return f"189: {probs[0]:.4f}, 190: {probs[1]:.4f}, 491: {probs[2]:.4f}"

print("Age 46, 100pt, 11yr (Base Probs):")
print(check_491(100, "proficient", 11, 46))
