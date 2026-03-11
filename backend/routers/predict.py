"""
routers/predict.py
POST /api/predict/{model_name}
==============================================
Sprint 4 — Real ML model inference
==============================================
Models loaded at startup from ml/serialized/

Supported model_name values:
  - pathway   → EOI invitation probability per state (XGBoost EOI model)
  - shortage  → Occupation shortage probability 2026-2030 (RandomForest)
  - approval  → Same EOI model, approval framing
  - volume    → Placeholder (Prophet — Sprint 4b)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json, os
from pathlib import Path

router = APIRouter()

# ── Model loading at module level (cached in memory) ──────────────
ML_DIR = Path(__file__).resolve().parent.parent / "ml" / "serialized"

_eoi_model     = None
_eoi_encoders  = None
_eoi_meta      = None
_shortage_fc   = None   # pre-computed forecast dict
_shortage_meta = None

def _load_models():
    global _eoi_model, _eoi_encoders, _eoi_meta
    global _shortage_fc, _shortage_meta

    # EOI model
    eoi_model_path    = ML_DIR / "eoi_model.pkl"
    eoi_encoders_path = ML_DIR / "eoi_encoders.pkl"
    eoi_meta_path     = ML_DIR / "eoi_model_meta.json"

    if eoi_model_path.exists() and eoi_encoders_path.exists():
        try:
            import joblib
            _eoi_model    = joblib.load(eoi_model_path)
            _eoi_encoders = joblib.load(eoi_encoders_path)
            if eoi_meta_path.exists():
                with open(eoi_meta_path) as f:
                    _eoi_meta = json.load(f)
            print("  ✅ EOI model loaded")
        except Exception as e:
            print(f"  ⚠ Could not load EOI model: {e}")

    # Shortage forecast (pre-computed JSON — no inference needed at request time)
    shortage_fc_path   = ML_DIR / "shortage_forecast.json"
    shortage_meta_path = ML_DIR / "shortage_model_meta.json"

    if shortage_fc_path.exists():
        try:
            with open(shortage_fc_path) as f:
                _shortage_fc = json.load(f)
            if shortage_meta_path.exists():
                with open(shortage_meta_path) as f:
                    _shortage_meta = json.load(f)
            print("  ✅ Shortage forecast loaded")
        except Exception as e:
            print(f"  ⚠ Could not load shortage forecast: {e}")

# Load on import
_load_models()


# ── Request / Response schemas ─────────────────────────────────────

class PathwayRequest(BaseModel):
    anzsco_code: str           # 6-digit code e.g. "261312"
    points: int                # e.g. 85
    state: Optional[str] = None  # e.g. "VIC", None = all states
    visa_type: Optional[str] = "189"  # "189" | "190" | "491"
    year: Optional[int] = 2026
    month: Optional[int] = 3

class ShortageRequest(BaseModel):
    anzsco_code: str           # 6-digit ANZSCO
    state: Optional[str] = None  # None = all states

class ApprovalRequest(BaseModel):
    anzsco_code: str
    points: int
    state: str
    visa_type: Optional[str] = "190"

class VolumeRequest(BaseModel):
    anzsco_code: Optional[str] = None
    state: Optional[str] = None


# ── /api/predict/pathway ──────────────────────────────────────────

STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]

VISA_TYPE_MAP = {
    "189": "189 Skilled Independent",
    "190": "190SAS Skilled Australian Sponsored",
    "491": "491SKR Skilled Work Regional (Provisional)",
}

@router.post("/pathway")
async def predict_pathway(req: PathwayRequest):
    """
    Returns ranked list of states with invitation probability for a given
    occupation + points combination.
    Uses EOI XGBoost model if available, else mock.
    """
    states_to_check = [req.state] if req.state else STATES

    if _eoi_model is None or _eoi_encoders is None:
        # ── MOCK fallback ──────────────────────────────────────────
        results = _mock_pathway(req.anzsco_code, req.points, states_to_check)
        return {
            "model": "pathway",
            "status": "mock",
            "message": "EOI model not trained yet. Run: python ml/train_eoi_model.py",
            "results": results,
        }

    # ── Real inference ─────────────────────────────────────────────
    import pandas as pd
    import numpy as np

    enc = _eoi_encoders
    results = []

    visa_label = VISA_TYPE_MAP.get(req.visa_type, req.visa_type)

    for state in states_to_check:
        try:
            # Encode features
            visa_enc  = _safe_encode(enc, "Visa Type", visa_label)
            occ_enc   = _safe_encode(enc, "anzsco_code", req.anzsco_code)
            state_enc = _safe_encode(enc, "Nominated State", state)

            row = pd.DataFrame([{
                "Visa Type":       visa_enc,
                "anzsco_code":     occ_enc,
                "Points":          req.points,
                "Nominated State": state_enc,
                "Month":           req.month,
                "Year":            req.year,
            }])

            prob = float(_eoi_model.predict_proba(row)[0][1])
            results.append({"state": state, "probability": round(prob, 4), "visa_type": req.visa_type})

        except Exception as e:
            results.append({"state": state, "probability": None, "error": str(e)})

    results.sort(key=lambda x: (x["probability"] or 0), reverse=True)

    return {
        "model":       "pathway",
        "status":      "live",
        "anzsco_code": req.anzsco_code,
        "points":      req.points,
        "visa_type":   req.visa_type,
        "results":     results,
        "model_meta":  _eoi_meta,
    }


# ── /api/predict/shortage ─────────────────────────────────────────

@router.post("/shortage")
async def predict_shortage(req: ShortageRequest):
    """
    Returns 2026–2030 shortage probability for an occupation.
    Uses pre-computed forecast from shortage_forecast.json.
    """
    code = req.anzsco_code.strip()

    if _shortage_fc is None:
        results = _mock_shortage(code, req.state)
        return {
            "model": "shortage",
            "status": "mock",
            "message": "Shortage model not trained yet. Run: python ml/train_shortage_model.py",
            "results": results,
        }

    by_code = _shortage_fc.get("by_code", {})
    occ_data = by_code.get(code, {})

    if not occ_data:
        raise HTTPException(status_code=404, detail=f"No forecast data for ANZSCO {code}")

    states_to_return = [req.state] if req.state else list(occ_data.keys())
    results = []
    for state in states_to_return:
        if state in occ_data:
            results.append({
                "state": state,
                "forecast": occ_data[state],  # {"2026": 0.78, "2027": 0.71, ...}
            })

    return {
        "model":       "shortage",
        "status":      "live",
        "anzsco_code": code,
        "results":     results,
        "model_meta":  _shortage_meta,
    }


# ── /api/predict/shortage/top ─────────────────────────────────────

@router.get("/shortage/top")
async def get_top_shortages(state: str = "NSW", limit: int = 20):
    """
    Returns top occupations by shortage probability in 2026 for a given state.
    Directly from pre-computed index in shortage_forecast.json.
    """
    if _shortage_fc is None:
        return {
            "model": "shortage",
            "status": "mock",
            "state": state,
            "results": _mock_top_shortage(state, limit),
        }

    top = _shortage_fc.get("top_shortage", {}).get(state, [])
    return {
        "model":   "shortage",
        "status":  "live",
        "state":   state,
        "results": top[:limit],
        "model_meta": _shortage_meta,
    }


# ── /api/predict/approval ────────────────────────────────────────

@router.post("/approval")
async def predict_approval(req: ApprovalRequest):
    """
    Approval probability for a specific state + visa + points.
    Reuses EOI model (same underlying question).
    """
    pathway_req = PathwayRequest(
        anzsco_code=req.anzsco_code,
        points=req.points,
        state=req.state,
        visa_type=req.visa_type,
    )
    pathway_result = await predict_pathway(pathway_req)

    state_result = next(
        (r for r in pathway_result["results"] if r["state"] == req.state),
        {"probability": None}
    )
    prob = state_result.get("probability")

    risk_flags = []
    if prob is not None:
        if prob < 0.3:
            risk_flags.append("Low invitation probability — consider higher-demand states")
        if req.points < 75:
            risk_flags.append("Points below competitive threshold for most occupations")
        if prob > 0.7:
            risk_flags.append("Strong invitation probability — competitive profile")

    return {
        "model":       "approval",
        "status":      pathway_result["status"],
        "anzsco_code": req.anzsco_code,
        "points":      req.points,
        "state":       req.state,
        "visa_type":   req.visa_type,
        "probability": prob,
        "risk_flags":  risk_flags,
        "model_meta":  _eoi_meta,
    }


# ── /api/predict/volume ──────────────────────────────────────────

@router.post("/volume")
async def predict_volume(req: VolumeRequest):
    """Volume forecasting — Prophet model — Sprint 4b placeholder."""
    return {
        "model":   "volume",
        "status":  "mock",
        "message": "Prophet volume model scheduled for Sprint 4b",
        "results": _mock_volume(req.anzsco_code, req.state),
    }


# ── /api/predict/models ──────────────────────────────────────────

@router.get("/models")
async def get_model_status():
    """Returns status and metadata of all loaded models."""
    return {
        "eoi_model": {
            "loaded":  _eoi_model is not None,
            "meta":    _eoi_meta,
        },
        "shortage_model": {
            "loaded":  _shortage_fc is not None,
            "meta":    _shortage_meta,
        },
    }


# ── HELPERS ───────────────────────────────────────────────────────

def _safe_encode(encoders, col, value):
    """Encode a value; return 0 if unseen label."""
    le = encoders.get(col)
    if le is None:
        return 0
    classes = list(le.classes_)
    if value in classes:
        return int(le.transform([value])[0])
    # unseen — return most common class index (0)
    return 0


# ── MOCK DATA (fallbacks when model not trained) ──────────────────

def _mock_pathway(anzsco, points, states):
    import random
    rng = random.Random(hash(anzsco + str(points)))
    base = min(0.9, max(0.1, (points - 60) / 50))
    return [
        {"state": s, "probability": round(base * rng.uniform(0.7, 1.0), 3), "visa_type": "190"}
        for s in sorted(states, key=lambda x: rng.random(), reverse=True)
    ]

def _mock_shortage(code, state):
    import random
    rng = random.Random(hash(code))
    base = rng.uniform(0.3, 0.9)
    years = [2026, 2027, 2028, 2029, 2030]
    states = [state] if state else STATES
    return [
        {
            "state": s,
            "forecast": {str(y): round(base * (0.95 ** i), 4) for i, y in enumerate(years)},
        }
        for s in states
    ]

def _mock_top_shortage(state, limit):
    return [
        {"code": "261312", "occupation": "Developer Programmer", "anzsco4": "2613",
         "prob_2026": 0.85, "prob_2027": 0.82, "prob_2028": 0.79, "prob_2029": 0.77, "prob_2030": 0.75},
        {"code": "254411", "occupation": "Registered Nurse", "anzsco4": "2544",
         "prob_2026": 0.81, "prob_2027": 0.80, "prob_2028": 0.78, "prob_2029": 0.74, "prob_2030": 0.70},
    ][:limit]

def _mock_volume(code, state):
    months = [
        "Mar 2026", "Apr 2026", "May 2026", "Jun 2026",
        "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026",
        "Nov 2026", "Dec 2026",
    ]
    import random
    rng = random.Random(hash(str(code) + str(state)))
    base = rng.randint(200, 800)
    return [{"month": m, "volume": int(base * rng.uniform(0.85, 1.15))} for m in months]
