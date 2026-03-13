import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

from routers.predict import build_ranked_pathways

def test(p, e, x, a, st="NSW"):
    res = build_ranked_pathways(model, "261313", st, p, e, a, x)
    adj = p + (20 if e=="superior" else 10 if e=="proficient" else 0)
    
    # Get top score per visa type
    scores = {}
    for r in res:
        vt = r['visa']
        if vt not in scores: scores[vt] = r['score']
    
    print(f"[{p}pts, {e}] (Adj: {adj}) -> 491: {scores.get('491',0):.1%}, 190: {scores.get('190',0):.1%}, 189: {scores.get('189',0):.1%}")

print("--- PROXIMITY SMOOTHING TEST (NT Profile) ---")
test(60, "competent", 5, 30)   # Adj 60 (Threshold for 491)
test(63, "competent", 5, 30)   # Adj 63 
test(65, "competent", 5, 30)   # Adj 65 (Threshold for 190)
test(70, "competent", 5, 30)   # Adj 70
test(75, "competent", 5, 30)   # Adj 75 (Peak)

print("\n--- RATIO NORMALIZATION TEST (NSW Profile) ---")
test(60, "proficient", 5, 30)  # Adj 70
test(70, "proficient", 5, 30)  # Adj 80
test(80, "proficient", 5, 30)  # Adj 90
