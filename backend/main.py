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

logger = logging.getLogger(__name__)

# Global model store — loaded once at startup, reused per request
models = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load pathway model (model_a.joblib) at startup — never from disk per request."""
    import joblib
    models_dir = os.getenv("MODELS_DIR", "./models")

    path = os.path.join(models_dir, "model_a.joblib")
    if os.path.exists(path):
        models["pathway"] = joblib.load(path)
        logger.info(f"✅ Loaded model: pathway from {path}")
    else:
        logger.warning(f"⚠️  Model not found: {path} — using None placeholder")
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

# Register routers per README structure
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
