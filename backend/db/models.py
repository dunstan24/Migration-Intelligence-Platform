"""
db/models.py
SQLAlchemy ORM models — semua tabel warehouse.db
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.sql import func
from db.database import Base


# ── EOI SkillSelect ──────────────────────────────────────────
class EOIRecord(Base):
    __tablename__ = "eoi_records"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    as_at_str        = Column(String(10), nullable=False, index=True)   # '03/2024'
    as_at_year       = Column(Integer, nullable=False, index=True)
    as_at_month_no   = Column(Integer, nullable=False)
    visa_type        = Column(String(10), nullable=False, index=True)   # '190' | '491'
    visa_type_full   = Column(Text)
    anzsco_code      = Column(String(6), index=True)
    occupation_name  = Column(Text, nullable=False)
    eoi_status       = Column(String(20), nullable=False, index=True)   # SUBMITTED|INVITED|HOLD|CLOSED|LODGED
    points           = Column(Integer, nullable=False)
    count_eois       = Column(Integer, nullable=False)                  # -1 = '<20'
    state            = Column(String(5), nullable=False, index=True)
    ingested_at      = Column(DateTime, server_default=func.now())


# ── OSL Shortage ─────────────────────────────────────────────
class OSLShortage(Base):
    __tablename__ = "osl_shortage"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    year             = Column(Integer, nullable=False, index=True)
    anzsco_code      = Column(String(6), index=True)
    occupation_name  = Column(Text, nullable=False)
    state            = Column(String(5), nullable=False, index=True)
    shortage_status  = Column(String(20))     # Shortage | Recruitment Difficulty | Balance | Metropolitan
    rating           = Column(String(30))
    ingested_at      = Column(DateTime, server_default=func.now())


# ── Employment Projections ───────────────────────────────────
class EmploymentProjection(Base):
    __tablename__ = "employment_projections"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    anzsco_code      = Column(String(6), index=True)
    occupation_name  = Column(Text, nullable=False)
    employment_2024  = Column(Integer)
    projected_2029   = Column(Integer)
    projected_2034   = Column(Integer)
    growth_5yr_pct   = Column(Float)
    growth_10yr_pct  = Column(Float)
    sector           = Column(String(100))
    ingested_at      = Column(DateTime, server_default=func.now())


# ── Migration Grants ─────────────────────────────────────────
class MigrationGrant(Base):
    __tablename__ = "migration_grants"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    financial_year   = Column(String(10), nullable=False, index=True)   # '2023-24'
    stream           = Column(String(50))                                # Skilled|Family|Humanitarian|Student
    visa_subclass    = Column(String(10))
    grants           = Column(Integer)
    planning_level   = Column(Integer)
    ingested_at      = Column(DateTime, server_default=func.now())


# ── Visa Grants ──────────────────────────────────────────────
class VisaGrant(Base):
    __tablename__ = "visa_grants"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    financial_year   = Column(String(10), nullable=False, index=True)
    visa_subclass    = Column(String(10), index=True)
    visa_name        = Column(Text)
    country          = Column(String(100))
    state            = Column(String(5))
    grants           = Column(Integer)
    ingested_at      = Column(DateTime, server_default=func.now())


# ── Occupation Features (ML input) ───────────────────────────
class OccupationFeature(Base):
    __tablename__ = "occupation_features"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    anzsco_code      = Column(String(6), nullable=False, index=True)
    occupation_name  = Column(Text)
    state            = Column(String(5), nullable=False, index=True)
    shortage_count_5yr = Column(Integer)
    shortage_streak  = Column(Integer)
    eoi_pool_size    = Column(Integer)
    invitation_rate  = Column(Float)
    employment_growth= Column(Float)
    jsa_rating       = Column(String(30))
    pr_probability   = Column(Float)
    ingested_at      = Column(DateTime, server_default=func.now())
