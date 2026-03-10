"""
backend/config.py
Centralized environment config — all settings read from .env
Used across: main.py, routers/, cache/, db/, rag/, tasks/

Usage:
    from config import settings
    print(settings.DATABASE_URL)
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):

    # ── App ──────────────────────────────────────────────────
    APP_NAME:    str  = "Interlace Migration Intelligence API"
    APP_VERSION: str  = "1.0.0"
    DEBUG:       bool = False
    ENVIRONMENT: str  = "development"   # development | production

    # ── Database ─────────────────────────────────────────────
    # Dev:  SQLite local file
    # Prod: PostgreSQL on Railway (set DATABASE_URL in Railway env vars)
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/processed/warehouse.db"
    SQLITE_PATH:  str = "./data/processed/warehouse.db"

    # ── Redis ────────────────────────────────────────────────
    # Used for: API response cache + Celery broker + Celery result backend
    REDIS_URL:              str = "redis://localhost:6379/0"
    CELERY_BROKER_URL:      str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND:  str = "redis://localhost:6379/1"
    CACHE_DEFAULT_TTL:      int = 300    # seconds — 5 minutes
    CACHE_LONG_TTL:         int = 3600   # seconds — 1 hour

    # ── Anthropic / Claude ───────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL:      str = "claude-opus-4-6"
    CLAUDE_MAX_TOKENS: int = 1024

    # ── ChromaDB (RAG vector store) ──────────────────────────
    CHROMA_PERSIST_DIR:    str = "./data/embeddings"
    CHROMA_COLLECTION:     str = "migration_knowledge"
    RAG_TOP_K:             int = 5       # number of chunks to retrieve per query

    # ── Embedding model ──────────────────────────────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"   # sentence-transformers

    # ── ML Models ────────────────────────────────────────────
    MODELS_DIR:      str = "./ml/serialized"
    MODEL_A_FILE:    str = "model_a.joblib"   # Pathway Predictor (GBM)
    MODEL_B_FILE:    str = "model_b.joblib"   # Shortage Forecaster (RF)
    MODEL_C_FILE:    str = "model_c.joblib"   # Volume Forecaster (Prophet)
    MODEL_D_FILE:    str = "model_d.joblib"   # Approval Scorer (LR)

    # ── Data Paths ───────────────────────────────────────────
    DATA_RAW_DIR:          str = "./data/raw"
    DATA_PROCESSED_DIR:    str = "./data/processed"

    # Raw data subfolders
    EOI_DATA_DIR:          str = "./data/raw/eoi"
    OSL_DATA_DIR:          str = "./data/raw/osl"
    EMPLOYMENT_DATA_DIR:   str = "./data/raw/employment"
    MIGRATION_DATA_DIR:    str = "./data/raw/migration"
    STUDENT_DATA_DIR:      str = "./data/raw/student"
    VISA_DATA_DIR:         str = "./data/raw/visa"
    JSA_DATA_DIR:          str = "./data/raw/jsa"
    SA4_DATA_DIR:          str = "./data/raw/sa4"
    ARRIVALS_DATA_DIR:     str = "./data/raw/arrivals"
    TEMP_VISA_DATA_DIR:    str = "./data/raw/temp_visas"
    CANCELLATIONS_DATA_DIR:str = "./data/raw/cancellations"
    ENGINE_DATA_DIR:       str = "./data/raw/engine"

    # Source filenames — change here if filenames differ
    EOI_FILENAME:          str = "Complete_EOI_and_JSA_Data_October_2025.xlsx"
    EMPLOYMENT_FILENAME:   str = "employment_projections_may2025.xlsx"
    MIGRATION_FILENAME:    str = "migration_trends_statistical_2024-25.xlsx"
    STUDENT_FILENAME:      str = "student_temporary_visa_dataset_2015_2025.xlsx"
    VISA_GRANTS_FILENAME:  str = "visa_grants_extracted.xlsx"
    VISA_COSTS_FILENAME:   str = "australian_visa_costs.xlsx"
    SA4_FILENAME:          str = "labour_market_ratings_by_sa4.xlsx"
    FEATURES_FILENAME:     str = "occupation_state_features_2025-12.csv"

    # ── Auth ─────────────────────────────────────────────────
    SECRET_KEY:         str = "change-me-in-production"
    JWT_ALGORITHM:      str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24   # 24 hours

    # ── CORS ─────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://*.vercel.app",
    ]

    # ── Reports output ───────────────────────────────────────
    REPORTS_OUTPUT_DIR: str = "./data/reports"

    # ── Computed properties ──────────────────────────────────
    @property
    def model_paths(self) -> dict:
        """Full paths to all 4 .joblib model files."""
        return {
            "pathway":  os.path.join(self.MODELS_DIR, self.MODEL_A_FILE),
            "shortage": os.path.join(self.MODELS_DIR, self.MODEL_B_FILE),
            "volume":   os.path.join(self.MODELS_DIR, self.MODEL_C_FILE),
            "approval": os.path.join(self.MODELS_DIR, self.MODEL_D_FILE),
        }

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def eoi_file_path(self) -> str:
        return os.path.join(self.EOI_DATA_DIR, self.EOI_FILENAME)

    @property
    def employment_file_path(self) -> str:
        return os.path.join(self.EMPLOYMENT_DATA_DIR, self.EMPLOYMENT_FILENAME)

    @property
    def migration_file_path(self) -> str:
        return os.path.join(self.MIGRATION_DATA_DIR, self.MIGRATION_FILENAME)

    @property
    def features_file_path(self) -> str:
        return os.path.join(self.ENGINE_DATA_DIR, self.FEATURES_FILENAME)

    class Config:
        env_file = ".env"           # backend/.env
        env_file_encoding = "utf-8"
        extra = "ignore"


# Single instance — import this everywhere
settings = Settings()
