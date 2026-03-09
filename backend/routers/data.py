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
import json

router = APIRouter()


# ── /api/data/summary ─────────────────────────────────────
@router.get("/summary")
async def get_summary():
    """Dashboard KPIs — Redis cached, TTL 5 min."""
    cache_key = "data:summary"

    # Check Redis cache
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    # MISS — query DB (mock until Sprint 1)
    data = {
        "eoi_pool":             25800,
        "total_invitations":    58570,
        "points_cutoff":        97,
        "shortage_occupations": 342,
        "total_tracked":        916,
    }

    await set_cache(cache_key, json.dumps(data), ttl=300)
    return data


# ── /api/data/migration-trends ────────────────────────────
@router.get("/migration-trends")
async def get_migration_trends():
    cache_key = "data:migration_trends"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    # TODO Sprint 1: query migration_trends table
    data = {"source": "migration_trends_statistical_2024-25.xlsx", "rows": [], "status": "mock"}
    await set_cache(cache_key, json.dumps(data), ttl=600)
    return data


# ── /api/data/shortage-heatmap ────────────────────────────
@router.get("/shortage-heatmap")
async def get_shortage_heatmap(year: int = Query(2025, ge=2021, le=2025)):
    cache_key = f"data:shortage_heatmap:{year}"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    # TODO Sprint 1: query osl_shortage table
    data = {"year": year, "source": "OSL 2021–2025 CSVs", "rows": [], "status": "mock"}
    await set_cache(cache_key, json.dumps(data), ttl=3600)
    return data


# ── /api/data/eoi ─────────────────────────────────────────
@router.get("/eoi")
async def get_eoi():
    cache_key = "data:eoi"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    data = {"source": "Complete_EOI_and_JSA_Data_October_2025.xlsx", "rows": [], "status": "mock"}
    await set_cache(cache_key, json.dumps(data), ttl=600)
    return data


# ── /api/data/employment-projections ──────────────────────
@router.get("/employment-projections")
async def get_employment_projections():
    cache_key = "data:employment_projections"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    data = {"source": "employment_projections_may2025.xlsx", "rows": [], "status": "mock"}
    await set_cache(cache_key, json.dumps(data), ttl=3600)
    return data


# ── /api/data/visa-analytics ──────────────────────────────
@router.get("/visa-analytics")
async def get_visa_analytics():
    cache_key = "data:visa_analytics"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    data = {"source": "visa_grants_extracted.xlsx", "rows": [], "status": "mock"}
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
    # TODO: add JWT middleware
    routes = {
        "users":    {"users": [], "status": "mock"},
        "models":   {"models": [], "status": "mock"},
        "database": {"tables": [], "status": "mock"},
    }
    return routes.get(path.split("/")[0], {"error": "not found"})
