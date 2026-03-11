"""
routers/predict.py
POST /api/predict/{model_name}
Returns: { prediction, confidence, shap_values }
Models are pre-loaded into memory at startup via main.py lifespan
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import numpy as np
import pandas as pd
import traceback

router = APIRouter()

class PredictInput(BaseModel):
    occupation:   Optional[str]   = "100000"   
    state:        Optional[str]   = "NSW"
    points:       Optional[int]   = 65
    english:      Optional[str]   = "competent"   
    age:          Optional[int]   = 30
    experience:   Optional[int]   = 3
    country:      Optional[str]   = "CN"
    visa_type:    Optional[str]   = "189"
    # Shortage model features
    shortage_streak:    Optional[int]   = 1
    employment_growth:  Optional[float] = 0.05
    # Volume features
    base_trend:         Optional[float] = 0.5
    seasonal:           Optional[float] = 1.0
    # Approval model features
    english_band:      Optional[float] = 6.0
    skills_assessed:   Optional[str]  = "True"
    country_risk_tier: Optional[int]   = 1


def get_base_shap(model_name: str, features: dict) -> dict:
    """Mock shap library values until Sprint 4."""
    shap_maps = {
        "pathway":  {"occupation": 0.42, "state": 0.18, "points": 0.15, "english": 0.12, "age": 0.08, "experience": 0.05},
        "shortage": {"shortage_streak": 0.38, "employment_growth": 0.24, "jsa_rating": 0.18, "eoi_activity": 0.12, "shortage_count_5yr": 0.08},
        "volume":   {"base_trend": 0.45, "seasonal": 0.28, "covid_regressor": 0.18, "planning_level": 0.09},
        "approval": {"points_score": 0.35, "english_band": 0.22, "skills_assessed": 0.18, "country_risk": 0.14, "experience": 0.11},
    }
    return shap_maps.get(model_name, {})


@router.post("/{model_name}")
async def predict(model_name: str, body: PredictInput):
    """
    POST /api/predict/{model_name}
    model_name: pathway | shortage | volume | approval
    """
    from main import models

    valid = ["pathway", "shortage", "volume", "approval"]
    if model_name not in valid:
        raise HTTPException(400, f"model_name must be one of: {valid}")

    model = models.get(model_name)
    if not model:
         # Fallback default responses if no model is loaded
         return {"error": f"Model {model_name} not loaded into memory."}

    features = body.dict(exclude_none=True)
    df_features = pd.DataFrame([features])
    
    try:
        if model_name in ["pathway", "approval"]:
            # Classification
            probs = model.predict_proba(df_features)[0]
            prediction_class = int(model.predict(df_features)[0])
            confidence = round(float(np.max(probs)), 2)
            prediction = prediction_class
            
        elif model_name in ["shortage", "volume"]:
            # Regression
            prediction = float(model.predict(df_features)[0])
            prediction = round(prediction, 4)
            confidence = 0.85 # mock confidence for regressor
            
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, detail=f"Inference error: {str(e)}")

    shap_values = get_base_shap(model_name, features)

    response = {
        "model":      model_name,
        "prediction": prediction,
        "confidence": confidence,
        "shap_values": shap_values,
        "model_loaded": True,
        "features_received": list(features.keys()),
    }

    # Model-specific output formatting
    if model_name == "pathway":
        visas = ["189 — Independent", "190 — State Nominated", "491 — Regional"]
        best_visa = visas[prediction] if prediction < 3 else visas[0]
        response["pathways"] = [
            {"visa": best_visa, "state": body.state, "score": confidence},
        ]

    elif model_name == "shortage":
        # probability
        response["forecast"] = [
            {"year": y, "shortage_intensity": round(prediction * (1.0 + (y - 2025)*0.05), 3)}
            for y in range(2026, 2031)
        ]

    elif model_name == "approval":
        response["risk_flags"] = ["Country risk tier 2+"] if (body.country_risk_tier or 1) >= 2 else []
        response["recommendation"] = "LIKELY APPROVED" if prediction == 1 else "BORDERLINE / LOW PROBABILITY"

    return response
