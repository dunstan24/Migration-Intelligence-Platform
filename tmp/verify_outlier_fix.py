import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

def get_skill_boost(pt, en, ex, ag):
    b = 0.0
    if pt > 100: b += 0.45 + (pt - 100) * 0.002
    elif pt >= 95: b += 0.20
    elif pt >= 90: b += 0.15
    elif pt >= 80: b += 0.10
    elif pt >= 70: b += 0.05
    if en == "superior": b += 0.05
    elif en == "proficient": b += 0.02
    if ex > 10: b += 0.20 + (min(ex, 20) - 10) * 0.002
    elif ex >= 7: b += 0.14
    elif ex >= 5: b += 0.10
    elif ex >= 4: b += 0.07
    elif ex >= 3: b += 0.05
    elif ex >= 2: b += 0.00
    elif ex >= 1: b -= 0.10
    elif ex == 0: b -= 0.22
    if ex >= 7 and (en == "superior" or pt >= 75): b += 0.10
    
    if ag >= 45:
        b -= 0.70
        b += max(0, ag - 45) * 0.001
    elif ag >= 40:
        b -= (ag - 39) * 0.05
    return b

def t(p, e, x, a, st="NSW"):
    df = pd.DataFrame([{"occupation":"261313","state":st,"points":p,"english_level":e,"age":a,"experience":x}])
    raw = model.predict_proba(df)[0][2] # 491
    sc = raw + 0.03 + get_skill_boost(p,e,x,a)
    return round(max(0.01, min(sc, 1.0)), 3)

print("User Case: 46yo, 100pt, 11yr (491 QLD):", t(100, "proficient", 11, 46, "NSW")) # NSW boost is same
print("Age 30 Target (80pt, 3yr):", t(80, "proficient", 3, 30))
