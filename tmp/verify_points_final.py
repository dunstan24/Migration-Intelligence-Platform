import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

from routers.predict import get_skill_boost

def t(p, e, x, a, st="NSW", v_idx=1):
    df = pd.DataFrame([{"occupation":"261313","state":st,"points":p,"english_level":e,"age":a,"experience":x}])
    base = model.predict_proba(df)[0][v_idx]
    boost = 0.03 + get_skill_boost(p,e,x,a)
    score = base + boost
    
    # Mirroring production eligibility logic for 190
    adj_pts = p + (20 if e=="superior" else 10 if e=="proficient" else 0)
    eligible = adj_pts >= 65 and e != "vocational"
    
    # Cap/Floor logic
    is_elite = x >= 7 and (e == "superior" or p >= 75)
    cap = 0.98 if is_elite else 0.95
    
    if not eligible:
        return 0.01
    return round(max(0.01, min(score, cap)), 3)

print("--- POINTS MONOTONICITY (NSW 190, 30yo, 3yr) ---")
prev_score = -1
for p in [60, 70, 80, 90, 100, 110, 120]:
    score = t(p, "proficient", 3, 30)
    trend = "↑" if score > prev_score else "=" if score == prev_score else "↓ (ERROR)"
    print(f"Points {p}: {score:.1%} {trend}")
    prev_score = score

print("\n--- VOCATIONAL ENGLISH TEST ---")
print(f"Vocational Score (111pts): {t(111, 'vocational', 3, 30):.1%}")
