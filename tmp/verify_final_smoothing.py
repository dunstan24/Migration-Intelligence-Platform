import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

from routers.predict import build_ranked_pathways

def check_scenario(p, e, x, a, st="NSW"):
    results = build_ranked_pathways(model, "261313", st, p, e, a, x)
    print(f"\nScenario: {p}pts, {e}, {x}yr exp, {a}yo")
    # Show top 5 unique visas
    seen = set()
    count = 0
    for r in results:
        key = (r['visa'], r['state'])
        if key not in seen:
            print(f" - {r['visa']} {r['state']}: {r['score']:.1%} {'(Not Eligible)' if not r['eligible'] else ''}")
            seen.add(key)
            count += 1
        if count >= 3: break

print("--- VERIFYING PROXIMITY RAMP (NSW 190) ---")
check_scenario(60, "competent", 5, 30) # Adj 60 (Eligible for 491 only)
check_scenario(65, "competent", 5, 30) # Adj 65 (Eligible for 190/189)
check_scenario(70, "competent", 5, 30) # Adj 70
check_scenario(75, "competent", 5, 30) # Adj 75

print("\n--- VERIFYING VISA RATIO (491 vs 190) ---")
check_scenario(60, "proficient", 5, 30) # Adj 70
