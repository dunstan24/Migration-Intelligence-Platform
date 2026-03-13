"""
routers/predict.py
POST /api/predict/{model_name}
Returns: { prediction, confidence, shap_values }
Models are pre-loaded into memory at startup via main.py lifespan
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
import numpy as np
import pandas as pd
import traceback

import sqlite3
import os
from config import settings

router = APIRouter()

# ── Feature columns model_a was trained on ───────────────────────────────────
MODEL_FEATURES = ["occupation", "state", "points", "english_level", "age", "experience"]

# ── Visa class labels ─────────────────────────────────────────────────────────
VISAS = {
    0: "189 — Independent",
    1: "190 — State Nominated",
    2: "491 — Regional Sponsored",
}

ALL_STATES   = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
REGIONAL_STT = ["QLD", "WA", "SA", "TAS", "ACT", "NT"]  # 491 eligible only

ENGLISH_POINTS = {
    "vocational": 0,
    "competent":  0,
    "proficient": 10,
    "superior":   20,
}


# ── SHAP proxy from GBM feature importances ───────────────────────────────────
def compute_shap(model, feature_names: list) -> dict:
    try:
        importances = model.named_steps["model"].feature_importances_
        pre = model.named_steps["preprocessor"]
        num_feats = list(pre.transformers_[0][2])
        cat_feats  = list(pre.transformers_[1][2])
        all_feats  = num_feats + cat_feats
        total = importances.sum() or 1.0
        shap = {f: round(float(v / total), 4) for f, v in zip(all_feats, importances)}
        return dict(sorted(shap.items(), key=lambda x: x[1], reverse=True))
    except Exception:
        return {}


# ── Scoring Layer Helpers ───────────────────────────────────────────────────
def get_shortage_boost(occupation: str, state: str) -> float:
    """Check both OSL and forecast for shortage boost."""
    boost = 0.0
    try:
        conn = sqlite3.connect(settings.SQLITE_PATH)
        # 1. Check current OSL shortage
        osl = conn.execute(
            f"SELECT national, [{state.lower()}] FROM osl_shortage WHERE anzsco_code=? ORDER BY year DESC LIMIT 1",
            (occupation,)
        ).fetchone()
        if osl:
            if osl[1] == 1: boost += 0.15 # State shortage
            elif osl[0] == 1: boost += 0.05 # National shortage

        # 2. Check future forecast
        forecast = conn.execute(
            "SELECT prob_2026 FROM shortage_forecast WHERE anzsco_code=? AND state=? LIMIT 1",
            (occupation, state)
        ).fetchone()
        if forecast:
            boost += float(forecast[0]) * 0.1 # Weight future prob

        conn.close()
    except Exception:
        pass
    return boost

def get_quota_factor(state: str, visa: str) -> float:
    """Adjust score based on state nomination quotas."""
    try:
        conn = sqlite3.connect(settings.SQLITE_PATH)
        q = conn.execute(
            "SELECT quota_amount FROM state_nomination_quotas WHERE state=? AND visa_type LIKE ? LIMIT 1",
            (state, f"%{visa}%")
        ).fetchone()
        conn.close()
        if q:
            # Simple scaling: quotas range from ~200 to 5000+
            # We add a subtle boost for high-quota regions
            return min(q[0] / 5000.0 * 0.05, 0.05)
    except Exception:
        pass
    return 0.0

def get_skill_boost(points: int, english: str, experience: int) -> float:
    """Explicitly reward high skill metrics to increase score confidence."""
    boost = 0.0
    # Point-based boost (more aggressive)
    if points >= 95: boost += 0.20
    elif points >= 90: boost += 0.15
    elif points >= 80: boost += 0.10
    elif points >= 70: boost += 0.05
    
    # English proficiency boost
    if english == "superior": boost += 0.10
    elif english == "proficient": boost += 0.05
    
    # Experience boost (Tiered calibration: 0yr < 50%, 7yr = 100% only for Elite)
    if experience >= 10: boost += 0.18
    elif experience >= 7: boost += 0.12
    elif experience >= 5: boost += 0.05
    elif experience >= 4: boost -= 0.01
    elif experience >= 3: boost -= 0.02
    elif experience >= 2: boost -= 0.10
    elif experience >= 1: boost -= 0.20
    elif experience == 0: boost -= 0.45
    
    # Elite Experience Bonus (reserved for high-skill candidates)
    if experience >= 7 and (english == "superior" or points >= 75):
        boost += 0.15
    
    return boost


# ── Ranked (visa × state) output ─────────────────────────────────────────────
def safe_get_proba(model, df, class_idx: int) -> float:
    """Safely get probability for a class index, even if missing from model."""
    try:
        probs = model.predict_proba(df)[0]
        # model.classes_ might be [1, 2] instead of [0, 1, 2]
        classes = list(model.classes_)
        if class_idx in classes:
            idx = classes.index(class_idx)
            return float(probs[idx])
    except Exception:
        pass
    return 0.0

def build_ranked_pathways(model, occupation: str, state: str,
                           points: int, english_level: str,
                           age: int, experience: int) -> list[dict]:
    """
    For each of the 3 visa classes × eligible states, run model.predict_proba
    and return all combinations sorted by score descending.
    """
    english_bonus = ENGLISH_POINTS.get(english_level, 0)
    adj_pts = points + english_bonus
    ranked = []

    # ── 189 Independent — one entry, state-agnostic ───────────────────────────
    df_189 = pd.DataFrame([{
        "occupation": occupation, "state": state,
        "points": points, "english_level": english_level,
        "age": age, "experience": experience,
    }])
    p189 = safe_get_proba(model, df_189, 0) # Class 0 is 189
    eligible_189 = adj_pts >= 65 and english_level != "vocational"
    
    # Apply scoring layer
    shortage_189 = get_shortage_boost(occupation, "National")
    final_score_189 = p189 + shortage_189
    
    ranked.append({
        "visa":      "189",
        "visa_name": "189 — Skilled Independent",
        "state":     "Any (National)",
        "score":     round(min(final_score_189, 1.0), 4) if eligible_189 else 0.0,
        "eligible":   eligible_189,
        "note":       f"No state nomination needed. Adjusted points: {adj_pts}. Boosted by shortage data.",
    })

    eligible_190 = adj_pts >= 65 and english_level != "vocational"
    skill_boost = get_skill_boost(points, english_level, experience)
    
    for st in ALL_STATES:
        df_st = pd.DataFrame([{
            "occupation": occupation, "state": st,
            "points": points, "english_level": english_level,
            "age": age, "experience": experience,
        }])
        p190 = safe_get_proba(model, df_st, 1) # Class 1 is 190
        
        # Apply scoring layer
        boost = 0.03 if st == state else 0.0
        shortage = get_shortage_boost(occupation, st)
        quota = get_quota_factor(st, "190")
        final_score_190 = p190 + boost + shortage + quota + skill_boost

        ranked.append({
            "visa":      "190",
            "visa_name": "190 — Skilled Nominated",
            "state":     st,
            "score":     round(min(final_score_190, 1.0), 4) if eligible_190 else 0.0,
            "eligible":   eligible_190,
            "note":       "+5 pts from state. Acccounted for shortage forecasts and nomination quotas.",
        })

    # ── 491 Regional Sponsored — regional states only ─────────────────────────
    eligible_491 = adj_pts >= 60 and english_level != "vocational"
    for st in REGIONAL_STT:
        df_st = pd.DataFrame([{
            "occupation": occupation, "state": st,
            "points": points, "english_level": english_level,
            "age": age, "experience": experience,
        }])
        p491 = safe_get_proba(model, df_st, 2) # Class 2 is 491
        
        # Apply scoring layer
        boost = 0.03 if st == state else 0.0
        shortage = get_shortage_boost(occupation, st)
        quota = get_quota_factor(st, "491")
        final_score_491 = p491 + boost + shortage + quota + skill_boost

        ranked.append({
            "visa":      "491",
            "visa_name": "491 — Skilled Work Regional (Provisional)",
            "state":     st,
            "score":     round(min(final_score_491, 1.0), 4) if eligible_491 else 0.0,
            "eligible":   eligible_491,
            "note":       "+15 pts from regional sponsor. Score weighted by local demand factors.",
        })

    ranked.sort(key=lambda x: (x["eligible"], x["score"]), reverse=True)
    return ranked


# ── Request schema — 6 fields only ───────────────────────────────────────────
class PathwayInput(BaseModel):
    occupation: str = Field(
        default="261313",
        description="ANZSCO 6-digit occupation code",
        examples=["261313", "254412", "233211", "241411"]
    )
    state: Literal["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] = Field(
        default="NSW",
        description="Nominated Australian state or territory"
    )
    points: int = Field(
        default=80, ge=60, le=140,
        description="Skill Select points score (before English level bonus)"
    )
    english_level: Literal["vocational", "competent", "proficient", "superior"] = Field(
        default="proficient",
        description=(
            "Australian English proficiency level. "
            "vocational=IELTS 5 | competent=IELTS 6 (+0 pts) | "
            "proficient=IELTS 7 (+10 pts) | superior=IELTS 8+ (+20 pts)"
        )
    )
    age: int = Field(default=30, ge=18, le=45, description="Applicant age in years")
    experience: int = Field(
        default=5, ge=0, le=20,
        description="Years of skilled work experience in the nominated occupation"
    )


# ── Route ─────────────────────────────────────────────────────────────────────
@router.post("/pathway")
async def predict_pathway(body: PathwayInput):
    """
    POST /api/predict/pathway

    Returns ranked (visa subclass + state) combinations with GBM probability
    scores, plus SHAP-based feature importance chart data.

    Input: occupation (ANZSCO), state, points, english_level, age, experience
    Output: ranked pathways array + top_pathway + class_probs + shap_values
    """
    from main import models

    model = models.get("pathway")
    if not model:
        return {"error": "Pathway model not loaded into memory."}

    try:
        english_bonus = ENGLISH_POINTS.get(body.english_level, 0)
        adj_pts = body.points + english_bonus

        # Run inference for the primary input (for class_probs summary)
        df_primary = pd.DataFrame([{
            "occupation":    body.occupation,
            "state":         body.state,
            "points":        body.points,
            "english_level": body.english_level,
            "age":           body.age,
            "experience":    body.experience,
        }])
        probs = model.predict_proba(df_primary)[0]
        classes = list(model.classes_)
        
        # Map actual probabilities to global VISAS structure
        class_probs = {}
        for i in range(3):
            if i in classes:
                val = float(probs[classes.index(i)])
                class_probs[VISAS[i]] = round(val, 4)
            else:
                class_probs[VISAS[i]] = 0.0

        top_class_val = int(classes[np.argmax(probs)])
        confidence = round(float(np.max(probs)), 4)

        # Build full ranked (visa × state) list
        ranked = build_ranked_pathways(
            model,
            occupation=body.occupation,
            state=body.state,
            points=body.points,
            english_level=body.english_level,
            age=body.age,
            experience=body.experience,
        )

        # SHAP from GBM feature importances
        shap_values = compute_shap(model, MODEL_FEATURES)

        return {
            "model":             "pathway",
            "prediction":        top_class_val,
            "confidence":        confidence,
            "adjusted_points":   adj_pts,
            "english_bonus_pts": english_bonus,
            "class_probs":       class_probs,
            "top_pathway":  ranked[0],
            "pathways":     ranked,
            "shap_values":  shap_values,
            "model_loaded": True,
            "features_used": MODEL_FEATURES,
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, detail=f"Inference error: {str(e)}")
