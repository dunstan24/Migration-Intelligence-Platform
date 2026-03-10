"""
routers/data.py
GET /api/data/* — query warehouse.db via SQLAlchemy
Redis cache: HIT → return immediately, MISS → query DB → cache → return
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db.database import get_db
from cache.redis_client import get_cache, set_cache
from config import settings
import json

router = APIRouter()


# ── /api/data/summary ─────────────────────────────────────────
@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    """Dashboard KPIs — Redis cached 5 min."""
    cache_key = "data:summary"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    # Query EOI table
    try:
        # Latest snapshot month
        latest = await db.execute(text("""
            SELECT as_at_str, as_at_year, as_at_month_no
            FROM eoi_records
            ORDER BY as_at_year DESC, as_at_month_no DESC
            LIMIT 1
        """))
        latest_row = latest.fetchone()
        latest_month = latest_row[0] if latest_row else "N/A"

        # Total EOI pool (SUBMITTED) in latest month
        pool = await db.execute(text("""
            SELECT COALESCE(SUM(CASE WHEN count_eois = -1 THEN 10 ELSE count_eois END), 0)
            FROM eoi_records
            WHERE eoi_status = 'SUBMITTED'
            AND as_at_str = :month
        """), {"month": latest_month})
        eoi_pool = int(pool.scalar() or 0)

        # Total invitations (INVITED) in latest month
        invited = await db.execute(text("""
            SELECT COALESCE(SUM(CASE WHEN count_eois = -1 THEN 10 ELSE count_eois END), 0)
            FROM eoi_records
            WHERE eoi_status = 'INVITED'
            AND as_at_str = :month
        """), {"month": latest_month})
        total_invitations = int(invited.scalar() or 0)

        # Highest points cutoff (max points of INVITED)
        cutoff = await db.execute(text("""
            SELECT MAX(points)
            FROM eoi_records
            WHERE eoi_status = 'INVITED'
            AND as_at_str = :month
        """), {"month": latest_month})
        points_cutoff = int(cutoff.scalar() or 0)

        # Unique occupations in pool
        occ_count = await db.execute(text("""
            SELECT COUNT(DISTINCT anzsco_code)
            FROM eoi_records
            WHERE anzsco_code != ''
        """))
        shortage_occupations = int(occ_count.scalar() or 0)

        data = {
            "eoi_pool":              eoi_pool,
            "total_invitations":     total_invitations,
            "points_cutoff":         points_cutoff,
            "shortage_occupations":  shortage_occupations,
            "latest_snapshot":       latest_month,
            "source":                "warehouse.db → eoi_records",
        }

    except Exception as e:
        # Table doesn't exist yet — return info message
        data = {
            "eoi_pool":             0,
            "total_invitations":    0,
            "points_cutoff":        0,
            "shortage_occupations": 0,
            "latest_snapshot":      "N/A",
            "source":               "mock — run EOI ingestor first",
            "error":                str(e),
        }

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_DEFAULT_TTL)
    return data


# ── /api/data/eoi ─────────────────────────────────────────────
@router.get("/eoi")
async def get_eoi(
    year:   int = Query(None),
    state:  str = Query(None),
    status: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """EOI records — filter by year, state, status."""
    cache_key = f"data:eoi:{year}:{state}:{status}"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    try:
        # Build dynamic query
        conditions = []
        params = {}
        if year:
            conditions.append("as_at_year = :year")
            params["year"] = year
        if state:
            conditions.append("state = :state")
            params["state"] = state.upper()
        if status:
            conditions.append("eoi_status = :status")
            params["status"] = status.upper()

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        # Summary by occupation + status
        result = await db.execute(text(f"""
            SELECT
                anzsco_code,
                occupation_name,
                visa_type,
                eoi_status,
                state,
                as_at_str,
                as_at_year,
                SUM(CASE WHEN count_eois = -1 THEN 10 ELSE count_eois END) as total_eois,
                MIN(points) as min_points,
                MAX(points) as max_points,
                COUNT(*) as row_count
            FROM eoi_records
            {where}
            GROUP BY anzsco_code, occupation_name, visa_type, eoi_status, state, as_at_str, as_at_year
            ORDER BY as_at_year DESC, total_eois DESC
            LIMIT 500
        """), params)

        rows = result.fetchall()
        data = {
            "count": len(rows),
            "filters": {"year": year, "state": state, "status": status},
            "records": [
                {
                    "anzsco_code":     r[0],
                    "occupation_name": r[1],
                    "visa_type":       r[2],
                    "eoi_status":      r[3],
                    "state":           r[4],
                    "as_at_str":       r[5],
                    "as_at_year":      r[6],
                    "total_eois":      r[7],
                    "min_points":      r[8],
                    "max_points":      r[9],
                }
                for r in rows
            ],
        }

    except Exception as e:
        data = {"count": 0, "records": [], "error": str(e), "source": "run EOI ingestor first"}

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_DEFAULT_TTL)
    return data


# ── /api/data/eoi/monthly ─────────────────────────────────────
@router.get("/eoi/monthly")
async def get_eoi_monthly(db: AsyncSession = Depends(get_db)):
    """EOI pool + invitations per month — for trend chart."""
    cache_key = "data:eoi:monthly"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    try:
        result = await db.execute(text("""
            SELECT
                as_at_str,
                as_at_year,
                as_at_month_no,
                eoi_status,
                SUM(CASE WHEN count_eois = -1 THEN 10 ELSE count_eois END) as total
            FROM eoi_records
            GROUP BY as_at_str, as_at_year, as_at_month_no, eoi_status
            ORDER BY as_at_year, as_at_month_no
        """))
        rows = result.fetchall()

        # Pivot: month → { pool, invitations }
        months = {}
        for r in rows:
            key = r[0]
            if key not in months:
                months[key] = {"month": key, "year": r[1], "month_no": r[2], "pool": 0, "invitations": 0}
            if r[3] == "SUBMITTED":
                months[key]["pool"] += r[4]
            elif r[3] == "INVITED":
                months[key]["invitations"] += r[4]

        data = {
            "count": len(months),
            "records": sorted(months.values(), key=lambda x: (x["year"], x["month_no"])),
        }

    except Exception as e:
        data = {"count": 0, "records": [], "error": str(e)}

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_DEFAULT_TTL)
    return data


# ── /api/data/eoi/occupations ─────────────────────────────────
@router.get("/eoi/occupations")
async def get_eoi_occupations(
    year:  int = Query(None),
    state: str = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db)
):
    """Top occupations by EOI pool size + invitation rate."""
    cache_key = f"data:eoi:occupations:{year}:{state}:{limit}"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    try:
        conditions = []
        params = {"limit": limit}
        if year:
            conditions.append("as_at_year = :year")
            params["year"] = year
        if state:
            conditions.append("state = :state")
            params["state"] = state.upper()
        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        result = await db.execute(text(f"""
            SELECT
                anzsco_code,
                occupation_name,
                SUM(CASE WHEN eoi_status = 'SUBMITTED' AND (count_eois = -1) THEN 10
                         WHEN eoi_status = 'SUBMITTED' THEN count_eois ELSE 0 END) as pool,
                SUM(CASE WHEN eoi_status = 'INVITED' AND (count_eois = -1) THEN 10
                         WHEN eoi_status = 'INVITED' THEN count_eois ELSE 0 END) as invitations,
                MAX(CASE WHEN eoi_status = 'INVITED' THEN points ELSE 0 END) as max_invited_points,
                MIN(CASE WHEN eoi_status = 'INVITED' THEN points ELSE NULL END) as min_invited_points,
                COUNT(DISTINCT state) as state_count
            FROM eoi_records
            {where}
            GROUP BY anzsco_code, occupation_name
            HAVING pool > 0
            ORDER BY invitations DESC, pool DESC
            LIMIT :limit
        """), params)

        rows = result.fetchall()
        data = {
            "count": len(rows),
            "records": [
                {
                    "anzsco_code":        r[0],
                    "occupation_name":    r[1],
                    "pool":               int(r[2] or 0),
                    "invitations":        int(r[3] or 0),
                    "max_invited_points": int(r[4] or 0),
                    "min_invited_points": int(r[5] or 0),
                    "invitation_rate":    round(r[3] / r[2], 3) if r[2] and r[2] > 0 else 0,
                    "states":             int(r[6] or 0),
                }
                for r in rows
            ],
        }

    except Exception as e:
        data = {"count": 0, "records": [], "error": str(e)}

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_DEFAULT_TTL)
    return data


# ── /api/data/eoi/points ──────────────────────────────────────
@router.get("/eoi/points")
async def get_eoi_points(
    occupation: str = Query(None),
    visa_type:  str = Query(None),
    state:      str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Points distribution — for points cutoff chart."""
    cache_key = f"data:eoi:points:{occupation}:{visa_type}:{state}"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    try:
        conditions = ["eoi_status IN ('SUBMITTED','INVITED')"]
        params = {}
        if occupation:
            conditions.append("anzsco_code = :occupation")
            params["occupation"] = occupation
        if visa_type:
            conditions.append("visa_type = :visa_type")
            params["visa_type"] = visa_type
        if state:
            conditions.append("state = :state")
            params["state"] = state.upper()

        where = "WHERE " + " AND ".join(conditions)

        result = await db.execute(text(f"""
            SELECT
                points,
                eoi_status,
                SUM(CASE WHEN count_eois = -1 THEN 10 ELSE count_eois END) as total
            FROM eoi_records
            {where}
            GROUP BY points, eoi_status
            ORDER BY points
        """), params)

        rows = result.fetchall()
        data = {
            "count": len(rows),
            "records": [
                {"points": r[0], "status": r[1], "total": int(r[2] or 0)}
                for r in rows
            ],
        }

    except Exception as e:
        data = {"count": 0, "records": [], "error": str(e)}

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_DEFAULT_TTL)
    return data


# ── /api/data/shortage-heatmap ────────────────────────────────
@router.get("/shortage-heatmap")
async def get_shortage_heatmap(
    year: int = Query(2025, ge=2021, le=2026),
    db: AsyncSession = Depends(get_db)
):
    cache_key = f"data:shortage_heatmap:{year}"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    try:
        result = await db.execute(text("""
            SELECT anzsco_code, occupation_name, state, shortage_status, rating
            FROM osl_shortage
            WHERE year = :year
            ORDER BY shortage_status, occupation_name
        """), {"year": year})
        rows = result.fetchall()
        data = {
            "year": year,
            "count": len(rows),
            "records": [
                {"anzsco_code": r[0], "occupation_name": r[1], "state": r[2],
                 "shortage_status": r[3], "rating": r[4]}
                for r in rows
            ],
        }
    except Exception as e:
        data = {"year": year, "count": 0, "records": [], "error": str(e)}

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_LONG_TTL)
    return data


# ── /api/data/employment-projections ─────────────────────────
@router.get("/employment-projections")
async def get_employment_projections(db: AsyncSession = Depends(get_db)):
    cache_key = "data:employment_projections"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    try:
        result = await db.execute(text("""
            SELECT anzsco_code, occupation_name, employment_2024,
                   projected_2029, projected_2034, growth_5yr_pct, growth_10yr_pct, sector
            FROM employment_projections
            ORDER BY growth_5yr_pct DESC
            LIMIT 100
        """))
        rows = result.fetchall()
        data = {
            "count": len(rows),
            "records": [
                {"anzsco_code": r[0], "occupation_name": r[1],
                 "employment_2024": r[2], "projected_2029": r[3], "projected_2034": r[4],
                 "growth_5yr_pct": r[5], "growth_10yr_pct": r[6], "sector": r[7]}
                for r in rows
            ],
        }
    except Exception as e:
        data = {"count": 0, "records": [], "error": str(e)}

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_LONG_TTL)
    return data


# ── /api/data/migration-trends ───────────────────────────────
@router.get("/migration-trends")
async def get_migration_trends(db: AsyncSession = Depends(get_db)):
    cache_key = "data:migration_trends"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    try:
        result = await db.execute(text("""
            SELECT financial_year, stream, SUM(grants) as total_grants, SUM(planning_level) as planning
            FROM migration_grants
            GROUP BY financial_year, stream
            ORDER BY financial_year, stream
        """))
        rows = result.fetchall()
        data = {
            "count": len(rows),
            "records": [
                {"financial_year": r[0], "stream": r[1], "grants": r[2], "planning_level": r[3]}
                for r in rows
            ],
        }
    except Exception as e:
        data = {"count": 0, "records": [], "error": str(e)}

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_LONG_TTL)
    return data


# ── /api/data/visa-analytics ─────────────────────────────────
@router.get("/visa-analytics")
async def get_visa_analytics(db: AsyncSession = Depends(get_db)):
    cache_key = "data:visa_analytics"
    cached = await get_cache(cache_key)
    if cached:
        return JSONResponse(json.loads(cached))

    try:
        result = await db.execute(text("""
            SELECT financial_year, visa_subclass, visa_name,
                   country, state, SUM(grants) as total
            FROM visa_grants
            GROUP BY financial_year, visa_subclass, visa_name, country, state
            ORDER BY financial_year DESC, total DESC
            LIMIT 200
        """))
        rows = result.fetchall()
        data = {
            "count": len(rows),
            "records": [
                {"financial_year": r[0], "visa_subclass": r[1], "visa_name": r[2],
                 "country": r[3], "state": r[4], "grants": r[5]}
                for r in rows
            ],
        }
    except Exception as e:
        data = {"count": 0, "records": [], "error": str(e)}

    await set_cache(cache_key, json.dumps(data), ttl=settings.CACHE_LONG_TTL)
    return data


# ── /api/data/report ─────────────────────────────────────────
@router.get("/report")
async def get_report(
    type: str = Query(...),
    from_: str = Query(None, alias="from"),
    to: str = Query(None),
):
    """Trigger Celery async report job — Sprint 6."""
    return {
        "job_id": f"job_placeholder_{type}",
        "status": "queued",
        "type": type,
        "note": "Celery report generation — Sprint 6",
    }


# ── /api/data/admin/* ─────────────────────────────────────────
@router.get("/admin/{path:path}")
async def get_admin(path: str, db: AsyncSession = Depends(get_db)):
    """JWT protected admin routes — Sprint 7."""
    if path.startswith("users"):
        return {"users": [], "note": "JWT auth — Sprint 7"}
    if path.startswith("tables"):
        try:
            result = await db.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ))
            tables = [r[0] for r in result.fetchall()]
            return {"tables": tables}
        except Exception as e:
            return {"tables": [], "error": str(e)}
    return {"error": "not found"}
