import joblib, pandas as pd, sys

sys.path.append(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend")
model = joblib.load(r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib")

def check_base(p, e, x, a):
    df = pd.DataFrame([{"occupation":"261313","state":"NSW","points":p,"english_level":e,"age":a,"experience":x}])
    return model.predict_proba(df)[0][1]

print("Base-30yo-80pt:", check_base(80,"proficient",3,30))
print("Base-30yo-140pt:", check_base(140,"proficient",3,30))
print("Base-45yo-80pt:", check_base(80,"proficient",3,45))
