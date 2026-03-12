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

router = APIRouter()


class PredictInput(BaseModel):
    occupation:   Optional[str]   = None   # ANZSCO code
    state:        Optional[str]   = None
    points:       Optional[int]   = None
    english:      Optional[str]   = None   # competent|proficient|superior
    age:          Optional[int]   = None
    experience:   Optional[int]   = None
    country:      Optional[str]   = None
    visa_type:    Optional[str]   = None
    # Shortage model features
    shortage_streak:    Optional[int]   = None
    employment_growth:  Optional[float] = None
    # Approval model features
    english_band:      Optional[float] = None
    skills_assessed:   Optional[bool]  = None
    country_risk_tier: Optional[int]   = None


def get_shap(model_name: str, features: dict) -> dict:
    """Generate SHAP values — real implementation uses shap library in Sprint 4."""
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
    Returns: { prediction, confidence, shap_values, ...model-specific fields }
    """
    from main import models

    valid = ["pathway", "shortage", "volume", "approval"]
    if model_name not in valid:
        raise HTTPException(400, f"model_name must be one of: {valid}")

    model = models.get(model_name)
    features = body.dict(exclude_none=True)

    # Sprint 4: real model inference
    # prediction = model.predict_proba([feature_vector])[0][1]
    # For now: deterministic mock based on input
    base_scores = {"pathway": 0.87, "shortage": 0.82, "volume": 0.74, "approval": 0.79}
    prediction  = base_scores[model_name]
    confidence  = round(prediction + 0.05, 2)
    shap_values = get_shap(model_name, features)

    response = {
        "model":      model_name,
        "prediction": prediction,
        "confidence": confidence,
        "shap_values": shap_values,
        "model_loaded": model is not None,
        "features_received": list(features.keys()),
    }

    # Model-specific output fields per README
    if model_name == "pathway":
        response["pathways"] = [
            {"visa": "190 — State Nominated", "state": "VIC", "score": 0.91},
            {"visa": "491 — Regional",        "state": "QLD", "score": 0.84},
            {"visa": "189 — Independent",     "state": "NSW", "score": 0.71},
        ]

    elif model_name == "shortage":
        response["forecast"] = [
            {"year": y, "probability": round(prediction + (y - 2025) * 0.02, 3)}
            for y in range(2026, 2031)
        ]

    elif model_name == "approval":
        response["risk_flags"] = ["Country risk tier 2"] if (body.country_risk_tier or 2) >= 2 else []
        response["recommendation"] = "LIKELY APPROVED" if prediction >= 0.75 else "BORDERLINE — seek advice"

    return response
