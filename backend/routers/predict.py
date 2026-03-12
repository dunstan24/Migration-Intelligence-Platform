"""
routers/predict.py
POST /api/predict/pathway
Returns: ranked (visa subclass + state) pairs with scores + SHAP chart data

Model loaded once at startup via main.py lifespan (no disk I/O per request).

Australian English Proficiency Levels (Department of Home Affairs):
  "vocational"  — IELTS 5.0  (gates out 189/190)
  "competent"   — IELTS 6.0  (+0 bonus points)
  "proficient"  — IELTS 7.0  (+10 bonus points)
  "superior"    — IELTS 8.0+ (+20 bonus points)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
import numpy as np
import pandas as pd
import traceback

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


# ── Ranked (visa × state) output ─────────────────────────────────────────────
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
    p189 = float(model.predict_proba(df_189)[0][0])
    eligible_189 = adj_pts >= 65 and english_level != "vocational"
    ranked.append({
        "visa":      "189",
        "visa_name": "189 — Skilled Independent",
        "state":     "Any (National)",
        "score":     round(p189, 4) if eligible_189 else 0.0,
        "eligible":   eligible_189,
        "note":       f"No state nomination needed. Adjusted points: {adj_pts}.",
    })

    # ── 190 State Nominated — one entry per state ────────────────────────────
    eligible_190 = adj_pts >= 65 and english_level != "vocational"
    for st in ALL_STATES:
        df_st = pd.DataFrame([{
            "occupation": occupation, "state": st,
            "points": points, "english_level": english_level,
            "age": age, "experience": experience,
        }])
        p190 = float(model.predict_proba(df_st)[0][1])
        # highlight the user's nominated state
        boost = 0.03 if st == state else 0.0
        ranked.append({
            "visa":      "190",
            "visa_name": "190 — Skilled Nominated",
            "state":     st,
            "score":     round(min(p190 + boost, 1.0), 4) if eligible_190 else 0.0,
            "eligible":   eligible_190,
            "note":       "+5 points added by state government upon nomination.",
        })

    # ── 491 Regional Sponsored — regional states only ─────────────────────────
    eligible_491 = adj_pts >= 60 and english_level != "vocational"
    for st in REGIONAL_STT:
        df_st = pd.DataFrame([{
            "occupation": occupation, "state": st,
            "points": points, "english_level": english_level,
            "age": age, "experience": experience,
        }])
        p491 = float(model.predict_proba(df_st)[0][2])
        boost = 0.03 if st == state else 0.0
        ranked.append({
            "visa":      "491",
            "visa_name": "491 — Skilled Work Regional (Provisional)",
            "state":     st,
            "score":     round(min(p491 + boost, 1.0), 4) if eligible_491 else 0.0,
            "eligible":   eligible_491,
            "note":       "+15 points added by regional sponsor upon nomination.",
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
        top_class = int(np.argmax(probs))
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
            "prediction":        top_class,
            "confidence":        confidence,
            "adjusted_points":   adj_pts,
            "english_bonus_pts": english_bonus,
            "class_probs": {
                VISAS[i]: round(float(p), 4) for i, p in enumerate(probs)
            },
            "top_pathway":  ranked[0],
            "pathways":     ranked,
            "shap_values":  shap_values,
            "model_loaded": True,
            "features_used": MODEL_FEATURES,
        }

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, detail=f"Inference error: {str(e)}")
