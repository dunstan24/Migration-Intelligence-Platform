"""
main.py — FastAPI entry point
Models loaded at startup via lifespan (never from disk per request)
Routers: /api/data/* | /api/predict/* | /api/llm/*
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import numpy as np

logger = logging.getLogger(__name__)

# Global model store — loaded once at startup, reused per request
models = {}


def _patch_sklearn_imputer():
    """
    Patch sklearn SimpleImputer for model_a.joblib compatibility.

    model_a was trained on sklearn ~1.2–1.3. On sklearn 1.4+ the
    SimpleImputer.transform() calls self._fill_dtype which did not
    exist in older versions, causing:
        AttributeError: 'SimpleImputer' object has no attribute '_fill_dtype'
    or
        ValueError: could not convert string to float: 'missing'

    Fix: add a smart _fill_dtype property that returns object dtype
    when the imputer's statistics_ contain strings (categorical),
    and float64 otherwise (numeric).
    """
    try:
        from sklearn.impute import SimpleImputer

        if not hasattr(SimpleImputer, "_fill_dtype"):
            def _fill_dtype(self):
                if (
                    self.statistics_ is not None
                    and self.statistics_.dtype.kind in ("U", "O", "S")
                ):
                    return object
                return np.float64

            SimpleImputer._fill_dtype = property(_fill_dtype)
            logger.info("✅ Applied sklearn SimpleImputer._fill_dtype compatibility patch")
    except Exception as e:
        logger.warning(f"⚠️  Could not apply sklearn patch: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load pathway model (model_a.joblib) at startup — never from disk per request."""
    # Apply sklearn compatibility patch BEFORE loading any model
    _patch_sklearn_imputer()

    import joblib
    models_dir = os.getenv("MODELS_DIR", "./models")

    path = os.path.join(models_dir, "model_a.joblib")
    if os.path.exists(path):
        try:
            models["pathway"] = joblib.load(path)
            logger.info(f"✅ Loaded model: pathway from {path}")
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            models["pathway"] = None
    else:
        logger.warning(f"⚠️  Model not found: {path} — place model_a.joblib in backend/models/")
        models["pathway"] = None

    logger.info(f"🚀 Interlace API started · {len(models)} models in memory")
    yield
    models.clear()
    logger.info("🛑 Shutdown — models cleared")


app = FastAPI(
    title="Interlace Migration Intelligence API",
    description="FastAPI backend · /api/data/* /api/predict/* /api/llm/*",
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

# Register routers
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