import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

from routers.predict import build_ranked_pathways

def check_ratio(p, e, x, a, label):
    res = build_ranked_pathways(model, "261313", "NSW", p, e, a, x)
    # Get top score for 190 NT
    score_190 = next((r['score'] for r in res if r['visa'] == '190' and r['state'] == 'NT'), 0)
    print(f"{label: <30} | Score: {score_190:.1%}")

print("--- ENGLISH VS EXPERIENCE RATIO TEST ---")
# Base: 60 points, 30 years old
check_ratio(60, "superior", 0, 30, "Superior English, 0yr Exp")
check_ratio(60, "proficient", 5, 30, "Proficient English, 5yr Exp")
check_ratio(60, "proficient", 10, 30, "Proficient English, 10yr Exp")
check_ratio(60, "competent", 10, 30, "Competent English, 10yr Exp")
