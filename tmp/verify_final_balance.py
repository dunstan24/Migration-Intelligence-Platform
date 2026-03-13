import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

from routers.predict import get_skill_boost

def t(p, e, x, a, st="NSW", v_idx=1):
    df = pd.DataFrame([{"occupation":"261313","state":st,"points":p,"english_level":e,"age":a,"experience":x}])
    base = model.predict_proba(df)[0][v_idx]
    boost = 0.03 + get_skill_boost(p,e,x,a)
    return round(max(0.01, min(base + boost, 1.0)), 3)

print("--- SATURATION TESTS (NSW 190) ---")
print("30yo, 80pt, 3yr (Baseline):", t(80, "proficient", 3, 30))
print("30yo, 111pt, 5yr (High Skill):", t(111, "proficient", 5, 30))
print("30yo, 111pt, 15yr (Ultra Skill):", t(111, "proficient", 15, 30))

print("\n--- NEGATIVE SCORE TESTS (Age 45, 111pt, 15yr) ---")
print("NSW 190 (Was -54%):", t(111, "proficient", 15, 45, v_idx=1))
print("NT 491 (Was 40%):", t(75, "proficient", 15, 45, st="NT", v_idx=2))

print("\n--- ELITE TARGETS ---")
print("30yo, 75pt, 7yr (Elite Target ~90%):", t(75, "superior", 7, 30))
