"""
db/database.py
SQLAlchemy setup — SQLite (dev) / PostgreSQL (prod) per README
19 data tables — migration warehouse
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./data/processed/warehouse.db"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    from . import models  # Import models here to register them with Base
    import os
    os.makedirs(os.path.dirname(DATABASE_URL.replace("sqlite+aiosqlite:///", "")), exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
