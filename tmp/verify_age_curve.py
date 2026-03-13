import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

from routers.predict import get_skill_boost

def t(p, e, x, a, st="NSW", v_idx=1):
    df = pd.DataFrame([{"occupation":"261313","state":st,"points":p,"english_level":e,"age":a,"experience":x}])
    base = model.predict_proba(df)[0][v_idx]
    boost = 0.03 + get_skill_boost(p,e,x,a)
    score = base + boost
    
    # Cap/Floor logic
    is_elite = x >= 7 and (e == "superior" or p >= 75)
    cap = 0.98 if is_elite else 0.95
    return round(max(0.01, min(score, cap)), 3)

ages = range(39, 47)
for age in ages:
    s190 = t(105, "proficient", 10, age, st="NSW", v_idx=1)
    s491 = t(105, "proficient", 10, age, st="QLD", v_idx=2)
    print(f"Age {age}: 190={s190:.1%} | 491={s491:.1%}")
