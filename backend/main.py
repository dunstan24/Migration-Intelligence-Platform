"""
main.py — FastAPI entry point
Models loaded at startup via lifespan:
  models["pathway"]     — GBM sklearn Pipeline     backend/models/model_a.joblib
  models["approval"]    — XGBoost XGBClassifier     backend/models/model_xgb.pkl
  models["occ_encoder"] — sklearn LabelEncoder      backend/models/encoder_occupation.pkl
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging, os, numpy as np

logger = logging.getLogger(__name__)
models = {}


def _patch_sklearn_imputer():
    """Fix sklearn SimpleImputer compatibility (trained on ~1.2, running on 1.4+)."""
    try:
        from sklearn.impute import SimpleImputer
        if not hasattr(SimpleImputer, "_fill_dtype"):
            def _fill_dtype(self):
                if (self.statistics_ is not None
                        and self.statistics_.dtype.kind in ("U","O","S")):
                    return object
                return np.float64
            SimpleImputer._fill_dtype = property(_fill_dtype)
            logger.info("✅ Applied sklearn SimpleImputer compatibility patch")
    except Exception as e:
        logger.warning(f"⚠️  Could not apply sklearn patch: {e}")


def _load_joblib(path: str, label: str):
    import joblib
    if not os.path.exists(path):
        logger.warning(f"⚠️  {label} not found at {path}")
        return None
    try:
        obj = joblib.load(path)
        logger.info(f"✅ Loaded {label} ({path})")
        return obj
    except Exception as e:
        logger.error(f"❌ Failed to load {label}: {e}")
        return None


def _load_pickle(path: str, label: str):
    import pickle
    if not os.path.exists(path):
        logger.warning(f"⚠️  {label} not found at {path}")
        return None
    try:
        with open(path, "rb") as f:
            obj = pickle.load(f)
        logger.info(f"✅ Loaded {label} ({path})")
        return obj
    except Exception as e:
        logger.error(f"❌ Failed to load {label}: {e}")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    _patch_sklearn_imputer()

    models_dir = os.getenv("MODELS_DIR", "./models")

    # GBM pathway model (sklearn Pipeline)
    models["pathway"] = _load_joblib(
        os.path.join(models_dir, "model_a.joblib"), "pathway model"
    )

    # XGBoost approval model — joblib handles numpy arrays inside pkl correctly
    models["approval"] = _load_joblib(
        os.path.join(models_dir, "model_xgb.pkl"), "approval model (XGBoost)"
    )

    # Occupation LabelEncoder — joblib
    models["occ_encoder"] = _load_joblib(
        os.path.join(models_dir, "encoder_occupation.pkl"), "occupation encoder"
    )

    # Historical EOI data for lookup endpoint
    df_path = os.path.join(models_dir, "..", "data", "processed", "df_filtered.csv")
    # Also try same folder as models
    alt_path = os.path.join(models_dir, "df_filtered.csv")
    for p in [df_path, alt_path]:
        if os.path.exists(p):
            try:
                import pandas as pd
                df = pd.read_csv(p, parse_dates=["As At Month"])
                df["Count EOIs"] = pd.to_numeric(df["Count EOIs"], errors="coerce").fillna(10)
                df = df.sort_values(["Occupation","Visa Type","Nominated State","Points","As At Month"])
                models["df_hist"] = df
                logger.info(f"✅ Loaded df_hist ({len(df):,} rows from {p})")
                break
            except Exception as e:
                logger.warning(f"⚠️  Could not load df_filtered.csv: {e}")
    else:
        models["df_hist"] = None
        logger.warning("⚠️  df_filtered.csv not found — lookup endpoint will return not-found")

    # Threshold JSON
    models["threshold"] = 0.5
    for tp in [os.path.join(models_dir, "threshold.json"),
               os.path.join(models_dir, "..", "threshold.json")]:
        if os.path.exists(tp):
            try:
                import json
                with open(tp) as f:
                    models["threshold"] = json.load(f).get("best_threshold", 0.5)
                logger.info(f"✅ Loaded threshold: {models['threshold']} ({tp})")
                break
            except Exception as e:
                logger.warning(f"⚠️  Could not load threshold.json: {e}")

    loaded = {k: v is not None for k, v in models.items()}
    logger.info(f"🚀 Interlace API started · models: {loaded}")
    yield
    models.clear()
    logger.info("🛑 Shutdown — models cleared")


app = FastAPI(
    title="Interlace Migration Intelligence API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import data, predict, llm
app.include_router(data.router,    prefix="/api/data",    tags=["Data"])
app.include_router(predict.router, prefix="/api/predict", tags=["Predict"])
app.include_router(llm.router,     prefix="/api/llm",     tags=["LLM"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": {k: v is not None for k, v in models.items()},
    }