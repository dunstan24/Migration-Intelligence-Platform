import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

from routers.predict import get_skill_boost

def t(p, e, x, a, st="NSW", v_idx=1):
    df = pd.DataFrame([{"occupation":"261313","state":st,"points":p,"english_level":e,"age":a,"experience":x}])
    base = model.predict_proba(df)[0][v_idx]
    boost = 0.03 + get_skill_boost(p,e,x,a)
    score = base + boost
    
    # Mirroring production cap/floor logic
    is_elite = x >= 7 and (e == "superior" or p >= 75)
    cap = 0.98 if is_elite else 0.95
    return round(max(0.01, min(score, cap)), 3)

print("--- FINAL SATURATION TESTS ---")
print("40yo, 75pt, 15yr (491 QLD - Capped):", t(75, "proficient", 15, 40, st="QLD", v_idx=2))
print("30yo, 111pt, 15yr (190 NSW - Capped):", t(111, "proficient", 15, 30, v_idx=1))
print("Baseline (30yo, 80pt, 3yr):", t(80, "proficient", 3, 30))

print("\n--- NEGATIVE SCORE TESTS ---")
print("Age 45, 111pt, 15yr (190 NSW):", t(111, "proficient", 15, 45, v_idx=1))
