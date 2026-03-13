import joblib
import os

model_path = r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\models\model_a.joblib"
if os.path.exists(model_path):
    model = joblib.load(model_path)
    print(f"Model type: {type(model)}")
    if hasattr(model, "named_steps"):
        print(f"Steps: {model.named_steps.keys()}")
        if "model" in model.named_steps:
            inner_model = model.named_steps["model"]
            print(f"Inner model type: {type(inner_model)}")
            if hasattr(inner_model, "feature_importances_"):
                print(f"Feature importances: {inner_model.feature_importances_}")
    
    # Try to see if it's a Pipeline
    try:
        from sklearn.pipeline import Pipeline
        if isinstance(model, Pipeline):
            print("It's a scikit-learn Pipeline")
    except:
        pass
else:
    print("Model not found")
