"""
routers/data.py
GET /api/data/* — Redis cached per README workflow:
  1. Check Redis cache
  2. HIT → return immediately
  3. MISS → query DB → cache with TTL → return
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from cache.redis_client import get_cache, set_cache
from db.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from db.models import EOISubmission, OSLShortage, Quota, NeroEmployment, Occupation
import json

router = APIRouter()

# ── /api/data/summary ─────────────────────────────────────
@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    """Dashboard KPIs — Redis cached, TTL 5 min."""
    cache_key = "data:summary"

    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    # Query DB 
    res_eoi_pool = await db.execute(select(func.sum(EOISubmission.count)))
    eoi_pool = res_eoi_pool.scalar() or 0

    res_shortage = await db.execute(select(func.count(func.distinct(OSLShortage.anzsco_code))))
    shortage_count = res_shortage.scalar() or 0

    res_occupations = await db.execute(select(func.count(Occupation.anzsco_code)))
    occ_count = res_occupations.scalar() or 0
    
    res_quota = await db.execute(select(func.sum(Quota.allocation)))
    total_quota = res_quota.scalar() or 0

    data = {
        "eoi_pool":             eoi_pool,
        "total_invitations":    total_quota, # Displaying total quota as a proxy for capacity
        "points_cutoff":        85,          # Placeholder/Proxy
        "shortage_occupations": shortage_count,
        "total_tracked":        occ_count,
        "status": "live"
    }

    await set_cache(cache_key, json.dumps(data), ttl=300)
    return data


# ── /api/data/migration-trends ────────────────────────────
@router.get("/migration-trends")
async def get_migration_trends(db: AsyncSession = Depends(get_db)):
    cache_key = "data:migration_trends"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    # Real query: get EOI submissions breakdown by status
    res = await db.execute(select(EOISubmission.status, func.sum(EOISubmission.count)).group_by(EOISubmission.status))
    rows = [{"status": row[0], "count": row[1]} for row in res.all()]

    data = {"source": "eoi_submissions", "rows": rows, "status": "live"}
    await set_cache(cache_key, json.dumps(data), ttl=600)
    return data


# ── /api/data/shortage-heatmap ────────────────────────────
@router.get("/shortage-heatmap")
async def get_shortage_heatmap(year: int = Query(2025, ge=2021, le=2025), db: AsyncSession = Depends(get_db)):
    cache_key = f"data:shortage_heatmap:{year}"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    res = await db.execute(
        select(OSLShortage.shortage_type, func.count(OSLShortage.id))
        .where(OSLShortage.year == year)
        .group_by(OSLShortage.shortage_type)
    )
    rows = [{"state": row[0], "shortage_count": row[1]} for row in res.all()]

    data = {"year": year, "source": "osl_shortages", "rows": rows, "status": "live"}
    await set_cache(cache_key, json.dumps(data), ttl=3600)
    return data


# ── /api/data/eoi ─────────────────────────────────────────
@router.get("/eoi")
async def get_eoi(limit: int = 100, db: AsyncSession = Depends(get_db)):
    cache_key = f"data:eoi:{limit}"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    res = await db.execute(
        select(EOISubmission.visa_type, EOISubmission.nominated_state, func.sum(EOISubmission.count))
        .group_by(EOISubmission.visa_type, EOISubmission.nominated_state)
        .limit(limit)
    )
    rows = [{"visa_type": row[0], "state": row[1], "count": row[2]} for row in res.all()]

    data = {"source": "eoi_submissions", "rows": rows, "status": "live"}
    await set_cache(cache_key, json.dumps(data), ttl=600)
    return data


# ── /api/data/employment-projections ──────────────────────
@router.get("/employment-projections")
async def get_employment_projections(db: AsyncSession = Depends(get_db)):
    cache_key = "data:employment_projections"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    # Query NERO employment total by year
    # (SQLite extracts year from YYYY-MM-DD using substr)
    res = await db.execute(
        select(func.substr(NeroEmployment.date, 1, 4).label("year"), func.sum(NeroEmployment.count))
        .group_by("year")
    )
    rows = [{"year": row[0], "total_employed": row[1]} for row in res.all()]

    data = {"source": "nero_employment", "rows": rows, "status": "live"}
    await set_cache(cache_key, json.dumps(data), ttl=3600)
    return data


# ── /api/data/visa-analytics ──────────────────────────────
@router.get("/visa-analytics")
async def get_visa_analytics(db: AsyncSession = Depends(get_db)):
    cache_key = "data:visa_analytics"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    res = await db.execute(
        select(Quota.state, Quota.visa_type, Quota.allocation)
    )
    rows = [{"state": row[0], "visa_type": row[1], "allocation": row[2]} for row in res.all()]

    data = {"source": "quotas", "rows": rows, "status": "live"}
    await set_cache(cache_key, json.dumps(data), ttl=600)
    return data


# ── /api/data/report ──────────────────────────────────────
@router.get("/report")
async def get_report(
    type: str = Query(..., description="Report type"),
    from_: str = Query(None, alias="from"),
    to: str = Query(None),
):
    """
    Triggers Celery async job for PPT/PDF generation.
    Returns job_id — client polls for completion.
    """
    from tasks.report_tasks import generate_report_task
    job = generate_report_task.delay(type, from_, to)
    return {"job_id": job.id, "status": "queued", "type": type}


# ── /api/data/admin/* ─────────────────────────────────────
@router.get("/admin/{path:path}")
async def get_admin(path: str):
    """JWT protected — FastAPI validates token in Sprint 7."""
    routes = {
        "users":    {"users": [], "status": "mock"},
        "models":   {"models": [], "status": "mock"},
        "database": {"tables": ["occupations", "eoi_submissions", "quotas", "osl_shortages", "nero_employment"], "status": "live"},
    }
    return routes.get(path.split("/")[0], {"error": "not found"})
