"""
routers/predict.py
POST /api/predict/pathway   — GBM model_a.joblib      (visa subclass recommender)
POST /api/predict/approval  — XGBoost model_xgb.pkl   (EOI approval probability)
                              encoder: encoder_occupation.pkl (LabelEncoder, 386 occupations)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional
import numpy as np
import pandas as pd
import traceback

router = APIRouter()

# ── GBM pathway constants ─────────────────────────────────────
ALL_STATES   = ["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"]
REGIONAL_STT = ["QLD","WA","SA","TAS","ACT","NT"]
ENGLISH_POINTS = {"vocational":0,"competent":0,"proficient":10,"superior":20}
VISAS = {0:"189 — Independent",1:"190 — State Nominated",2:"491 — Regional Sponsored"}

# ── XGB feature schema (32 features, exact order from booster) ─
# [0]  Points
# [1]  total_months_observed
# [2]  avg_count_submitted
# [3]  max_count_submitted
# [4]  min_count_submitted
# [5]  std_count_submitted
# [6]  trend_submitted
# [7]  last_count_submitted
# [8]  first_count_submitted
# [9]  growth_rate
# [10] points_bucket
# [11] volatility
# [12] count_vs_state_avg
# [13] count_vs_occ_avg
# [14] is_small_queue
# [15] is_large_queue
# [16] growth_rate_log
# [17] points_x_count
# [18] occ_popularity
# [19] occupation_enc
# [20] Visa Type_189PTS Points-Tested Stream
# [21] Visa Type_190SAS Skilled Australian Sponsored
# [22] Visa Type_491FSR Family Sponsored - Regional
# [23] Visa Type_491SNR State or Territory Nominated - Regional
# [24] Nominated State_ACT
# [25] Nominated State_NSW
# [26] Nominated State_NT
# [27] Nominated State_QLD
# [28] Nominated State_SA
# [29] Nominated State_TAS
# [30] Nominated State_VIC
# [31] Nominated State_WA

XGB_FEATURE_NAMES = [
    "Points","total_months_observed","avg_count_submitted","max_count_submitted",
    "min_count_submitted","std_count_submitted","trend_submitted","last_count_submitted",
    "first_count_submitted","growth_rate","points_bucket","volatility",
    "count_vs_state_avg","count_vs_occ_avg","is_small_queue","is_large_queue",
    "growth_rate_log","points_x_count","occ_popularity","occupation_enc",
    "Visa Type_189PTS Points-Tested Stream",
    "Visa Type_190SAS Skilled Australian Sponsored",
    "Visa Type_491FSR Family Sponsored - Regional",
    "Visa Type_491SNR State or Territory Nominated - Regional",
    "Nominated State_ACT","Nominated State_NSW","Nominated State_NT",
    "Nominated State_QLD","Nominated State_SA","Nominated State_TAS",
    "Nominated State_VIC","Nominated State_WA",
]

XGB_VISA_MAP = {
    "189": "Visa Type_189PTS Points-Tested Stream",
    "190": "Visa Type_190SAS Skilled Australian Sponsored",
    "491": "Visa Type_491SNR State or Territory Nominated - Regional",
    "491fsr": "Visa Type_491FSR Family Sponsored - Regional",
}

XGB_STATE_MAP = {
    "ACT":"Nominated State_ACT","NSW":"Nominated State_NSW",
    "NT":"Nominated State_NT",  "QLD":"Nominated State_QLD",
    "SA":"Nominated State_SA",  "TAS":"Nominated State_TAS",
    "VIC":"Nominated State_VIC","WA":"Nominated State_WA",
}

def points_to_bucket(pts: int) -> int:
    """Replicate the points_bucket feature used during training."""
    if pts < 65:  return 0
    if pts < 70:  return 1
    if pts < 75:  return 2
    if pts < 80:  return 3
    if pts < 85:  return 4
    if pts < 90:  return 5
    if pts < 100: return 6
    return 7

def build_xgb_input(
    occupation_enc: int,
    visa_type: str,          # "189" | "190" | "491"
    state: str,
    points: int,
    count_eois: int,
    occ_popularity: float = 0.5,   # 0-1, normalised popularity rank
) -> pd.DataFrame:
    """
    Builds a 1-row DataFrame with all 32 XGB features.
    Derived/statistical features are estimated from the user's inputs.
    """
    # Derived stats — estimated from count_eois as proxy for queue depth
    avg_c   = float(count_eois)
    growth  = 0.0
    growth_log = 0.0
    trend   = 0.0

    row = {n: 0.0 for n in XGB_FEATURE_NAMES}

    # Numeric features
    row["Points"]                 = float(points)
    row["total_months_observed"]  = 12.0       # typical observation window
    row["avg_count_submitted"]    = avg_c
    row["max_count_submitted"]    = avg_c * 1.3
    row["min_count_submitted"]    = avg_c * 0.7
    row["std_count_submitted"]    = avg_c * 0.2
    row["trend_submitted"]        = trend
    row["last_count_submitted"]   = avg_c
    row["first_count_submitted"]  = avg_c
    row["growth_rate"]            = growth
    row["points_bucket"]          = float(points_to_bucket(points))
    row["volatility"]             = avg_c * 0.2
    row["count_vs_state_avg"]     = 1.0        # neutral ratio
    row["count_vs_occ_avg"]       = 1.0
    row["is_small_queue"]         = 1.0 if count_eois <= 20 else 0.0
    row["is_large_queue"]         = 1.0 if count_eois >= 100 else 0.0
    row["growth_rate_log"]        = growth_log
    row["points_x_count"]         = float(points) * avg_c
    row["occ_popularity"]         = occ_popularity
    row["occupation_enc"]         = float(occupation_enc)

    # Visa OHE
    visa_col = XGB_VISA_MAP.get(visa_type)
    if visa_col and visa_col in row:
        row[visa_col] = 1.0

    # State OHE
    state_col = XGB_STATE_MAP.get(state)
    if state_col:
        row[state_col] = 1.0

    return pd.DataFrame([row])[XGB_FEATURE_NAMES]


# ── GBM helpers ───────────────────────────────────────────────
def compute_shap(model):
    try:
        importances = model.named_steps["model"].feature_importances_
        pre = model.named_steps["preprocessor"]
        all_feats = list(pre.transformers_[0][2]) + list(pre.transformers_[1][2])
        total = importances.sum() or 1.0
        shap = {f: round(float(v/total),4) for f,v in zip(all_feats, importances)}
        return dict(sorted(shap.items(), key=lambda x: x[1], reverse=True))
    except Exception:
        return {}

def build_ranked_pathways(model, occupation, state, points, english_level, age, experience):
    english_bonus = ENGLISH_POINTS.get(english_level, 0)
    adj_pts = points + english_bonus
    ranked = []
    base = {"occupation":occupation,"state":state,"points":points,
            "english_level":english_level,"age":age,"experience":experience}
    p189 = float(model.predict_proba(pd.DataFrame([base]))[0][0])
    eligible_189 = adj_pts >= 65 and english_level != "vocational"
    ranked.append({"visa":"189","visa_name":"189 — Skilled Independent","state":"Any (National)",
                   "score":round(p189,4) if eligible_189 else 0.0,"eligible":eligible_189,
                   "note":f"No state nomination needed. Adjusted points: {adj_pts}."})
    for st in ALL_STATES:
        df_st = pd.DataFrame([{**base,"state":st}])
        p190 = float(model.predict_proba(df_st)[0][1])
        boost = 0.03 if st == state else 0.0
        ranked.append({"visa":"190","visa_name":"190 — Skilled Nominated","state":st,
                       "score":round(min(p190+boost,1.0),4) if adj_pts>=65 else 0.0,
                       "eligible": adj_pts>=65,"note":"+5 points from state nomination."})
    for st in REGIONAL_STT:
        df_st = pd.DataFrame([{**base,"state":st}])
        p491 = float(model.predict_proba(df_st)[0][2])
        boost = 0.03 if st == state else 0.0
        ranked.append({"visa":"491","visa_name":"491 — Skilled Work Regional","state":st,
                       "score":round(min(p491+boost,1.0),4) if adj_pts>=60 else 0.0,
                       "eligible": adj_pts>=60,"note":"+15 points from regional sponsor."})
    ranked.sort(key=lambda x: (x["eligible"], x["score"]), reverse=True)
    return ranked


# ── Request schemas ───────────────────────────────────────────
class PathwayInput(BaseModel):
    occupation:    str   = Field(default="261313")
    state: Literal["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"] = Field(default="NSW")
    points:        int   = Field(default=80, ge=60, le=140)
    english_level: Literal["vocational","competent","proficient","superior"] = Field(default="proficient")
    age:           int   = Field(default=30, ge=18, le=45)
    experience:    int   = Field(default=5, ge=0, le=20)

class ApprovalInput(BaseModel):
    # Core inputs
    occupation: str   = Field(default="261313 Software Engineer")
    visa_type:  str   = Field(default="491SNR State or Territory Nominated - Regional",
                              description="Full visa type string or short code (189/190/491)")
    points:     int   = Field(default=80, ge=35, le=140)
    state: Literal["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"] = Field(default="NSW")
    # EOI statistical features (auto-filled from lookup or manual input)
    avg_count_submitted:   float = Field(default=50.0)
    max_count_submitted:   float = Field(default=100.0)
    min_count_submitted:   float = Field(default=10.0)
    std_count_submitted:   float = Field(default=20.0)
    trend_submitted:       float = Field(default=0.0)
    last_count_submitted:  float = Field(default=50.0)
    first_count_submitted: float = Field(default=50.0)
    total_months_observed: int   = Field(default=12)
    growth_rate:           float = Field(default=1.0)
    # Legacy field kept for backward compat
    count_eois:            int   = Field(default=50, ge=1, le=2000)

class OccupationSearchInput(BaseModel):
    query: str = Field(default="", description="Search term — ANZSCO code or occupation name")


# ── Routes ────────────────────────────────────────────────────
@router.post("/pathway")
async def predict_pathway(body: PathwayInput):
    from main import models
    model = models.get("pathway")
    if not model:
        return {"error":"Pathway model not loaded. Place model_a.joblib in backend/models/."}
    try:
        english_bonus = ENGLISH_POINTS.get(body.english_level, 0)
        adj_pts = body.points + english_bonus
        df_p = pd.DataFrame([{"occupation":body.occupation,"state":body.state,"points":body.points,
                               "english_level":body.english_level,"age":body.age,"experience":body.experience}])
        probs     = model.predict_proba(df_p)[0]
        top_class = int(np.argmax(probs))
        ranked    = build_ranked_pathways(model,body.occupation,body.state,body.points,
                                          body.english_level,body.age,body.experience)
        return {"model":"pathway","prediction":top_class,"confidence":round(float(np.max(probs)),4),
                "adjusted_points":adj_pts,"english_bonus_pts":english_bonus,
                "class_probs":{VISAS[i]:round(float(p),4) for i,p in enumerate(probs)},
                "top_pathway":ranked[0],"pathways":ranked,
                "shap_values":compute_shap(model),"model_loaded":True}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, detail=f"Pathway error: {str(e)}")


@router.post("/approval")
async def predict_approval(body: ApprovalInput):
    """
    POST /api/predict/approval
    XGBoost (binary:logistic) — predicts EOI lodgement probability.
    0 = Submitted/Waiting, 1 = Lodged/Approved.
    Uses encoder_occupation.pkl for occupation label encoding.
    """
    from main import models
    xgb_model = models.get("approval")
    occ_encoder = models.get("occ_encoder")

    if not xgb_model:
        return {"error":"Approval model not loaded. Place model_xgb.pkl in backend/models/.",
                "model_loaded":False}

    try:
        # Encode occupation
        occupation_enc = 0
        occ_known = False
        occ_popularity = 0.5

        if occ_encoder is not None:
            classes = list(occ_encoder.classes_)
            # Try exact match first
            if body.occupation in classes:
                occupation_enc = int(occ_encoder.transform([body.occupation])[0])
                occ_known = True
                # Popularity = normalised rank (common occs have low index in freq-sorted enc)
                occ_popularity = round(1.0 - occupation_enc / max(len(classes), 1), 4)
            else:
                # Try prefix match on ANZSCO code
                code = body.occupation.split()[0] if ' ' in body.occupation else body.occupation
                matches = [c for c in classes if c.startswith(code)]
                if matches:
                    occupation_enc = int(occ_encoder.transform([matches[0]])[0])
                    occ_known = True
                    occ_popularity = round(1.0 - occupation_enc / max(len(classes), 1), 4)

        # Use exact same feature engineering as app.py
        import numpy as _np
        volatility     = body.std_count_submitted / (body.avg_count_submitted + 1)
        growth_log     = float(_np.log1p(body.growth_rate))
        points_x_count = body.points * float(_np.log1p(body.avg_count_submitted))
        is_small       = int(body.avg_count_submitted < 20)
        is_large       = int(body.avg_count_submitted > 100)
        import pandas as _pd
        points_bucket  = int(_pd.cut([body.points], bins=[0,60,70,80,90,100,999],
                             labels=[1,2,3,4,5,6])[0])

        # Normalise visa_type — accept both short and full string
        _VISA_FULL = {
            "189": "189PTS Points-Tested Stream",
            "190": "190SAS Skilled Australian Sponsored",
            "491": "491SNR State or Territory Nominated - Regional",
            "491fsr": "491FSR Family Sponsored - Regional",
        }
        visa_full = _VISA_FULL.get(body.visa_type, body.visa_type)

        row = {
            "Points":                 float(body.points),
            "total_months_observed":  float(body.total_months_observed),
            "avg_count_submitted":    body.avg_count_submitted,
            "max_count_submitted":    body.max_count_submitted,
            "min_count_submitted":    body.min_count_submitted,
            "std_count_submitted":    body.std_count_submitted,
            "trend_submitted":        body.trend_submitted,
            "last_count_submitted":   body.last_count_submitted,
            "first_count_submitted":  body.first_count_submitted,
            "growth_rate":            body.growth_rate,
            "occupation_enc":         float(occupation_enc),
            "points_bucket":          float(points_bucket),
            "volatility":             volatility,
            "count_vs_state_avg":     1.0,
            "count_vs_occ_avg":       1.0,
            "is_small_queue":         float(is_small),
            "is_large_queue":         float(is_large),
            "growth_rate_log":        growth_log,
            "points_x_count":         points_x_count,
            "occ_popularity":         occ_popularity,
        }
        VISA_TYPES = ["189PTS Points-Tested Stream","190SAS Skilled Australian Sponsored",
                      "491FSR Family Sponsored - Regional",
                      "491SNR State or Territory Nominated - Regional"]
        STATES_OHE = ["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"]
        for vt in VISA_TYPES:
            row[f"Visa Type_{vt}"] = 1.0 if vt == visa_full else 0.0
        for st in STATES_OHE:
            row[f"Nominated State_{st}"] = 1.0 if st == body.state else 0.0

        X = _pd.DataFrame([row])[XGB_FEATURE_NAMES]

        prob = round(float(xgb_model.predict_proba(X)[0][1]), 4)
        pred = 1 if prob >= 0.5 else 0

        if prob >= 0.80:   label, color = "High — Likely Approved",  "green"
        elif prob >= 0.60: label, color = "Moderate-High",           "blue"
        elif prob >= 0.40: label, color = "Moderate",                "amber"
        elif prob >= 0.20: label, color = "Low-Moderate",            "orange"
        else:              label, color = "Low — Unlikely",          "red"

        # Feature importance from XGB
        feat_imp = {}
        try:
            imp = xgb_model.feature_importances_
            feat_imp = {n: round(float(v),4) for n,v in zip(XGB_FEATURE_NAMES, imp)}
            feat_imp = dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True)[:10])
        except Exception:
            pass

        return {
            "model":          "approval_xgb",
            "model_loaded":   True,
            "prediction":     pred,
            "probability":    prob,
            "label":          label,
            "color":          color,
            "interpretation": "1 = Likely Lodged/Approved · 0 = Likely still Submitted/Waiting",
            "inputs": {
                "visa_type":    body.visa_type,
                "occupation":   body.occupation,
                "points":       body.points,
                "count_eois":   body.count_eois,
                "state":        body.state,
            },
            "occupation_enc":      occupation_enc,
            "occupation_known":    occ_known,
            "top_feature_importance": feat_imp,
            "note": (None if occ_known else
                     f"'{body.occupation}' not found in encoder ({len(occ_encoder.classes_) if occ_encoder else 'N/A'} known occupations). "
                     "Used fallback encoding — accuracy may be lower."),
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(500, detail=f"Approval error: {str(e)}")


@router.get("/approval/occupations")
async def list_occupations(q: str = ""):
    """
    GET /api/predict/approval/occupations?q=engineer
    Returns matching occupation strings from encoder.
    Used by frontend autocomplete.
    """
    from main import models
    enc = models.get("occ_encoder")
    if not enc:
        return {"occupations": [], "error": "Encoder not loaded"}
    classes = list(enc.classes_)
    if q:
        ql = q.lower()
        classes = [c for c in classes if ql in c.lower()]
    return {"occupations": classes[:50], "total": len(classes)}


@router.get("/approval/lookup")
async def approval_lookup(occupation: str, visa_type: str, state: str, points: int):
    """
    GET /api/predict/approval/lookup?occupation=...&visa_type=...&state=...&points=...
    Returns historical EOI stats for the given combination from df_filtered.csv.
    Mirrors the /lookup endpoint from app.py.
    """
    from main import models
    df_hist = models.get("df_hist")
    if df_hist is None:
        return {"found": False, "message": "Historical data not loaded."}

    # Normalise visa_type — accept short ("190") or full string
    VISA_FULL = {
        "189": "189PTS Points-Tested Stream",
        "190": "190SAS Skilled Australian Sponsored",
        "491": "491SNR State or Territory Nominated - Regional",
        "491fsr": "491FSR Family Sponsored - Regional",
    }
    visa_full = VISA_FULL.get(visa_type, visa_type)
    # Also accept if user passes full string already
    if visa_type in ["189PTS Points-Tested Stream",
                     "190SAS Skilled Australian Sponsored",
                     "491FSR Family Sponsored - Regional",
                     "491SNR State or Territory Nominated - Regional"]:
        visa_full = visa_type

    try:
        mask = (
            (df_hist["Occupation"]      == occupation) &
            (df_hist["Visa Type"]       == visa_full)  &
            (df_hist["Nominated State"] == state)      &
            (df_hist["Points"]          == points)     &
            (df_hist["EOI Status"]      == "SUBMITTED")
        )
        subset = df_hist[mask]["Count EOIs"]

        if len(subset) == 0:
            return {"found": False, "message": "No historical data for this combination. Using defaults."}

        first = float(subset.iloc[0])
        last  = float(subset.iloc[-1])
        import numpy as np

        return {
            "found":                  True,
            "total_months_observed":  int(len(subset)),
            "avg_count_submitted":    round(float(subset.mean()), 1),
            "max_count_submitted":    round(float(subset.max()),  1),
            "min_count_submitted":    round(float(subset.min()),  1),
            "std_count_submitted":    round(float(subset.std()), 1) if len(subset) > 1 else 0.0,
            "trend_submitted":        round(last - first, 1),
            "last_count_submitted":   round(last, 1),
            "first_count_submitted":  round(first, 1),
            "growth_rate":            round(last / first, 2) if first > 0 else 1.0,
        }
    except Exception as e:
        return {"found": False, "message": str(e)}


@router.get("/approval/threshold")
async def approval_threshold():
    """Returns the model's best_threshold value."""
    from main import models
    threshold = models.get("threshold", 0.5)
    return {"threshold": threshold}