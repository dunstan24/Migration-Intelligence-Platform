# Migration Intelligence Platform — API Reference

**Base URL (Local):** `http://127.0.0.1:8000`  
**Base URL (Prod):** `https://your-backend.railway.app`  
**Interactive docs:** `GET /docs` (Swagger UI)

---

## 1. Health Check

### `GET /health`

```json
{
  "status": "ok",
  "models_loaded": { "pathway": true }
}
```

---

## 2. Data Endpoints — `GET /api/data/*`

All endpoints check Redis cache first → HIT returns immediately / MISS queries DB + caches result.

| Endpoint | TTL | Source Table |
|---|---|---|
| `GET /api/data/summary` | 5 min | `eoi_submissions`, `osl_shortages`, `quotas`, `occupations` |
| `GET /api/data/migration-trends` | 10 min | `eoi_submissions` |
| `GET /api/data/shortage-heatmap?year=2025` | 60 min | `osl_shortages` |
| `GET /api/data/eoi?limit=100` | 10 min | `eoi_submissions` |
| `GET /api/data/employment-projections` | 60 min | `nero_employment` |
| `GET /api/data/visa-analytics` | 10 min | `quotas` |
| `GET /api/data/report?type=X&from=Y&to=Z` | — | Celery async (Sprint 6) |
| `GET /api/data/admin/{path}` | — | Mock — JWT planned Sprint 7 |

### `GET /api/data/summary`
```json
{ "eoi_pool": 2580000, "total_invitations": 58570, "points_cutoff": 85, "shortage_occupations": 342, "total_tracked": 916, "status": "live" }
```

### `GET /api/data/shortage-heatmap?year=2025`
Param: `year` (int, 2021–2025, default 2025)
```json
{ "year": 2025, "rows": [{ "state": "National", "shortage_count": 150 }], "status": "live" }
```

### `GET /api/data/eoi?limit=100`
Param: `limit` (int, default 100)
```json
{ "rows": [{ "visa_type": "190", "state": "NSW", "count": 45000 }], "status": "live" }
```

### `GET /api/data/admin/{path}`
Accepted `{path}`: `users` · `models` · `database`

---

## 3. ML Prediction — `POST /api/predict/pathway`

### Model Summary

| Property | Value |
|---|---|
| Algorithm | GradientBoostingClassifier (200 trees, lr=0.08, depth=4) |
| Type | 3-class classifier |
| Training data | OSL 2025 shortage list (917 ANZSCO codes × 8 states) |
| CV Accuracy | ~89% |
| Model file | `models/model_a.joblib` |
| Loaded at | Application startup (once) |

---

### Australian English Proficiency Levels

| `english_level` | IELTS Equiv. | Skill Select Bonus |
|---|---|---|
| `"vocational"` | 5.0 | +0 pts · ineligible for 189/190 |
| `"competent"` | 6.0 | +0 pts |
| `"proficient"` | 7.0 | **+10 pts** |
| `"superior"` | 8.0+ | **+20 pts** |

---

### Request Body

```json
{
  "occupation":    "261313",
  "state":         "NSW",
  "points":        80,
  "english_level": "proficient",
  "age":           30,
  "experience":    5
}
```

| Field | Type | Range / Options | Description |
|---|---|---|---|
| `occupation` | string | 6-digit ANZSCO | e.g. `"261313"` = Software Engineer |
| `state` | string | NSW / VIC / QLD / WA / SA / TAS / ACT / NT | Nominated state |
| `points` | int | 60–140 | Skill Select score (before English bonus) |
| `english_level` | string | vocational / competent / proficient / superior | English proficiency |
| `age` | int | 18–45 | Applicant age |
| `experience` | int | 0–20 | Years of experience in nominated occupation |

---

### Response

```json
{
  "model":             "pathway",
  "prediction":        0,
  "confidence":        0.7231,
  "adjusted_points":   90,
  "english_bonus_pts": 10,
  "class_probs": {
    "189 — Independent":       0.7231,
    "190 — State Nominated":   0.1982,
    "491 — Regional Sponsored": 0.0787
  },
  "top_pathway": {
    "visa":      "189",
    "visa_name": "189 — Skilled Independent",
    "state":     "Any (National)",
    "score":     0.7231,
    "eligible":  true,
    "note":      "No state nomination needed. Adjusted points: 90."
  },
  "pathways": [
    { "visa": "189", "visa_name": "189 — Skilled Independent",        "state": "Any (National)", "score": 0.7231, "eligible": true,  "note": "..." },
    { "visa": "190", "visa_name": "190 — Skilled Nominated",          "state": "NSW",            "score": 0.2282, "eligible": true,  "note": "..." },
    { "visa": "190", "visa_name": "190 — Skilled Nominated",          "state": "VIC",            "score": 0.1982, "eligible": true,  "note": "..." },
    { "visa": "491", "visa_name": "491 — Skilled Work Regional",      "state": "QLD",            "score": 0.0921, "eligible": true,  "note": "..." },
    { "...": "all 8 states for 190, 6 regional states for 491, sorted by score" }
  ],
  "shap_values": {
    "points":         0.4821,
    "english_level":  0.2314,
    "occupation":     0.1523,
    "state":          0.0892,
    "experience":     0.0312,
    "age":            0.0138
  },
  "model_loaded":  true,
  "features_used": ["occupation", "state", "points", "english_level", "age", "experience"]
}
```

**`pathways` array** — all (visa × state) combinations, sorted by `score` descending:

| Field | Description |
|---|---|
| `visa` | Visa subclass: `"189"`, `"190"`, `"491"` |
| `visa_name` | Full visa name |
| `state` | Target state, or `"Any (National)"` for 189 |
| `score` | GBM probability 0–1 |
| `eligible` | `false` if basic eligibility not met |
| `note` | Context note (adjusted points, nomination bonus) |

**Prediction classes:** `0` = 189 Independent · `1` = 190 State Nominated · `2` = 491 Regional

---

### Error Responses

| Status | Condition | Body |
|---|---|---|
| `500` | Inference error | `{"detail": "Inference error: ..."}` |
| `200` | Model not loaded | `{"error": "Pathway model not loaded into memory."}` |

---

## 4. LLM / Chat — `POST /api/llm/chat`

RAG pipeline + Anthropic Claude streaming (SSE).

**Request:**
```json
{ "message": "Which occupations are in shortage in Victoria?", "session_id": "optional-uuid" }
```

**Response stream (`text/event-stream`):**
```
data: {"token": "Based on the latest OSL data..."}
data: [DONE]
```

> Falls back to mock stream if `ANTHROPIC_API_KEY` not set in `.env`.

---

## 5. Field Reference

### `english_level`
`"vocational"` · `"competent"` · `"proficient"` · `"superior"`

### `state`
`"NSW"` · `"VIC"` · `"QLD"` · `"WA"` · `"SA"` · `"TAS"` · `"ACT"` · `"NT"`

### `occupation` — ANZSCO examples
| Code | Occupation |
|---|---|
| `261313` | Software Engineer |
| `254412` | Registered Nurse (Aged Care) |
| `233211` | Civil Engineer |
| `241411` | Secondary School Teacher |
| `252511` | Physiotherapist |
| `221113` | Taxation Accountant |
