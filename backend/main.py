"""
main.py — FastAPI entry point
Routers: /api/data/* | /api/predict/* | /api/llm/*
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

logger = logging.getLogger(__name__)
from config import settings

models = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init database tables
    from db.database import init_db
    await init_db()
    logger.info("✅ Database tables ready")

    # Load ML models — skip gracefully if not ready yet (Sprint 4)
    try:
        import joblib
        for name, path in settings.model_paths.items():
            if os.path.exists(path):
                models[name] = joblib.load(path)
                logger.info(f"✅ Model loaded: {name}")
            else:
                models[name] = None
    except ImportError:
        for name in ["pathway", "shortage", "volume", "approval"]:
            models[name] = None

    logger.info(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} ready")
    yield
    models.clear()


app = FastAPI(
    title="Interlace Migration Intelligence API",
    description="FastAPI backend · /api/data/* /api/predict/* /api/llm/*",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
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
    from db.database import engine
    from sqlalchemy import text
    db_ok = False
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    return {
        "status": "ok",
        "database": "connected" if db_ok else "not connected",
        "models": {k: v is not None for k, v in models.items()},
    }
