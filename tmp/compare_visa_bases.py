import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

def get_all_bases(p, e, x, a, st="NT"):
    df = pd.DataFrame([{"occupation":"261313","state":st,"points":p,"english_level":e,"age":a,"experience":x}])
    probs = model.predict_proba(df)[0]
    classes = list(model.classes_)
    return {c: probs[classes.index(c)] for c in classes}

print("--- Base Model Probs (NT Profile from Image 2) ---")
print("Points: 60, Proficient, 5yr Exp, 30yo")
print(get_all_bases(60, "proficient", 5, 30))
