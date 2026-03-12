# 🏗️ Migration Intelligence Platform — Architecture Documentation

> Full-stack ML prediction platform with RAG-powered chat, built on **React + FastAPI**

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND — React (Vite)                    │
│    Dashboard  │  Predictors  │  Chat  │  Reports  │  Admin   │
└────────────────────────────┬────────────────────────────────┘
                             │  REST API + SSE Streaming
┌────────────────────────────▼────────────────────────────────┐
│                   BACKEND — FastAPI (Railway)                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ /api/data/* │   │/api/predict/*│   │   /api/llm/*     │  │
│  │ 7 endpoints │   │ 4 ML models  │   │ Claude streaming  │  │
│  │ Redis cached│   │ 88% accuracy │   │   RAG pipeline   │  │
│  └─────────────┘   └──────────────┘   └──────────────────┘  │
└──────┬───────────────────┬────────────────────┬─────────────┘
       │                   │                    │
┌──────▼──────┐   ┌────────▼───────┐   ┌────────▼──────────┐
│  SQLite /   │   │  ML Models     │   │  ChromaDB + Redis  │
│ PostgreSQL  │   │  (models/*.    │   │  Vector store      │
│             │   │   joblib)      │   │  + cache           │
│  5 tables   │   │  4 models      │   │  RAG + job queue   │
│  migration  │   │  loaded once   │   │  Celery tasks      │
│  warehouse  │   │  at startup    │   │                    │
└─────────────┘   └────────────────┘   └────────────────────┘
```

---

## 🗂️ Project Structure

```
Migration-Intelligence-Platform/
│
├── README.md
├── .env                        # Environment variables (local)
├── .env.example
├── setup.bat                   # One-click setup (Windows)
│
├── frontend/                   # React (Vite) App
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Predictors.jsx
│   │   │   ├── Chat.jsx
│   │   │   ├── Reports.jsx
│   │   │   └── Admin.jsx
│   │   ├── components/
│   │   ├── hooks/
│   │   │   └── useSSE.js       # Server-Sent Events hook
│   │   └── api/
│   │       └── client.js       # Axios / fetch wrapper
│   └── package.json
│
└── backend/                    # FastAPI App
    ├── main.py                 # Entry point — loads models, registers routers
    ├── requirements.txt
    │
    ├── routers/                # API route handlers
    │   ├── data.py             # GET /api/data/*  (7 endpoints, Redis cached)
    │   ├── predict.py          # POST /api/predict/{model_name}
    │   └── llm.py              # POST /api/llm/chat  (SSE stream)
    │
    ├── models/                 # Serialised ML models (loaded at startup)
    │   ├── model_a.joblib      # Pathway Predictor     — RandomForest (88% acc.)
    │   ├── model_b.joblib      # Shortage Forecaster   — RandomForest (regressor)
    │   ├── model_c.joblib      # Volume Forecaster     — RandomForest (regressor)
    │   └── model_d.joblib      # Approval Scorer       — RandomForest (classifier)
    │
    ├── db/
    │   ├── database.py         # SQLAlchemy async — SQLite (dev) / PostgreSQL (prod)
    │   └── models.py           # ORM table definitions
    │
    ├── cache/
    │   └── redis_client.py     # get_cache / set_cache with graceful fallback
    │
    ├── rag/                    # Sprint 5
    │   ├── vectorstore.py      # ChromaDB integration (stub)
    │   └── embeddings.py       # sentence-transformers helper (stub)
    │
    ├── tasks/
    │   └── report_tasks.py     # Celery async — PPT/PDF generation (Sprint 6)
    │
    ├── scripts/
    │   ├── setup_db.py         # python scripts/setup_db.py — initialise DB
    │   └── train_models.py     # python scripts/train_models.py — retrain models
    │
    └── doc/
        └── api-doc.md          # Full API reference
```

---

## 🔄 Workflow Breakdown

### 1️⃣ Dashboard Workflow

```
User visits /dashboard
        │
        ▼
React fetches GET /api/data/summary
        │
        ▼
FastAPI checks Redis cache
    ├── HIT  → return cached JSON immediately (TTL 5 min)
    └── MISS → query SQLite/PostgreSQL
                    │
                    ▼
              set_cache(key, data, ttl=300)
                    │
                    ▼
        return JSON → React renders charts/KPI cards
```

**Key files:** `pages/Dashboard.jsx` · `routers/data.py` · `cache/redis_client.py`

---

### 2️⃣ Predictors Workflow

```
User fills prediction form
        │
        ▼
React sends POST /api/predict/{model_name}
  model_name: pathway | shortage | volume | approval
        │
        ▼
FastAPI picks pre-loaded model from memory (no disk I/O)
  filters to model-specific feature columns (MODEL_FEATURES dict)
        │
        ▼
  Classification → predict_proba()  (pathway, approval)
  Regression     → predict()        (shortage, volume)
        │
        ▼
Return JSON: { prediction, confidence, shap_values, pathways / forecast / risk_flags }
        │
        ▼
React renders result + SHAP bar chart
```

**Key files:** `pages/Predictors.jsx` · `routers/predict.py` · `models/*.joblib`

**Model feature sets:**

| Model | Input Features |
|---|---|
| `pathway` | occupation (ANZSCO), state, points, english_level, age, experience |

---

### 3️⃣ Chat Workflow (RAG + Claude Streaming)

```
User types message → Send
        │
        ▼
React POST /api/llm/chat  { message, session_id }
        │
        ▼
FastAPI RAG pipeline:
  1. rag_retrieve(query)  → top-5 relevant knowledge chunks  [Sprint 5: ChromaDB]
  2. Build prompt: system + context chunks + user message
  3. Anthropic Claude API — streaming mode
        │
        ▼
FastAPI returns SSE stream (text/event-stream):
  data: {"token": "Hello"}
  data: {"token": " there"}
  data: [DONE]
        │
        ▼
React useSSE() hook reads token-by-token → renders progressively
```

**Key files:** `pages/Chat.jsx` · `hooks/useSSE.js` · `routers/llm.py` · `rag/`

**SSE hook pattern:**
```js
const res = await fetch('/api/llm/chat', {
  method: 'POST',
  body: JSON.stringify({ message }),
  headers: { 'Content-Type': 'application/json' }
});
const reader = res.body.getReader();
// read token-by-token and update UI state
```

---

### 4️⃣ Reports Workflow

```
User selects report type + date range → Generate
        │
        ▼
React GET /api/data/report?type=X&from=Y&to=Z
        │
        ▼
FastAPI triggers Celery async task  (generate_report_task.delay)
  returns { job_id, status: "queued" }
        │
        ▼
Celery worker (Sprint 6):
  1. Query DB for filtered data
  2. Claude writes slide copy
  3. python-pptx → .pptx file
  4. WeasyPrint → .pdf file
  5. Returns download_url
```

**Key files:** `pages/Reports.jsx` · `routers/data.py` · `tasks/report_tasks.py`

---

### 5️⃣ Admin Workflow

```
Admin navigates to /admin
        │
        ▼
React GET /api/data/admin/{path}  (Sprint 7: JWT protected)
        │
        ▼
FastAPI validates JWT token
    ├── FAIL → 401 Unauthorized
    └── PASS → CRUD on DB / manage RAG index / trigger retraining
```

**Key files:** `pages/Admin.jsx` · `routers/data.py` (admin sub-routes)

---

## 🗄️ Database Layer

| Detail | Value |
|---|---|
| ORM | SQLAlchemy (async) |
| Dev | SQLite (`data/processed/warehouse.db`) |
| Prod | PostgreSQL (Railway) |
| Tables | `occupations`, `eoi_submissions`, `quotas`, `osl_shortages`, `nero_employment` |
| Raw data | CSV/Excel ingested via Pandas ETL scripts |

**Initialise DB:**
```bash
cd backend
python scripts/setup_db.py
```

---

## 🤖 ML Models Layer

> **Note:** Only the **Pathway Predictor** (model_a) is managed in this repository.
> Shortage Forecaster, Volume Forecaster, and Approval Scorer are maintained by separate team members.

| Model | File | Type | Algorithm | Training Data | Accuracy |
|---|---|---|---|---|---|
| Pathway Predictor | `model_a.joblib` | Classifier (3-class) | **GradientBoosting** | OSL 2025 (917 ANZSCO codes) | **~89%** |

All models use `sklearn.Pipeline` with `ColumnTransformer` (StandardScaler + OrdinalEncoder). Preprocessing is bundled in the `.joblib` — no transform needed at inference.

**Australian English Proficiency Levels (Pathway / Approval models):**

| `english_level` | IELTS Equiv. | Points Bonus |
|---|---|---|
| `"vocational"` | 5.0 | +0 (gates out 189/190) |
| `"competent"` | 6.0 | +0 |
| `"proficient"` | 7.0 | **+10** |
| `"superior"` | 8.0+ | **+20** |

**Pathway model feature set:** `occupation` (ANZSCO) · `state` · `points` · `english_level` · `age` · `experience`

**Loading pattern (main.py):**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    for name, filename in model_files.items():
        models[name] = joblib.load(f"./models/{filename}")
    yield
    models.clear()
```

**Retrain models:**
```bash
cd backend
python scripts/train_models.py
```

---

## 🧠 ChromaDB + Redis Layer

| Component | Purpose |
|---|---|
| **ChromaDB** | Vector store for RAG document embeddings *(Sprint 5)* |
| **Redis** | HTTP response cache (TTL) + Celery job broker/backend |

**Redis cache TTL per endpoint:**

| Endpoint | TTL |
|---|---|
| `/api/data/summary` | 5 min |
| `/api/data/migration-trends` | 10 min |
| `/api/data/eoi` | 10 min |
| `/api/data/visa-analytics` | 10 min |
| `/api/data/shortage-heatmap` | 60 min |
| `/api/data/employment-projections` | 60 min |

---

## 🚀 Deployment

| Layer | Platform |
|---|---|
| Frontend | Vercel (React static build) |
| Backend | Railway (FastAPI + Uvicorn) |
| Database | Railway PostgreSQL add-on |
| Cache / Queue | Railway Redis add-on |
| Vector DB | ChromaDB (persistent volume on Railway) |

---

## ⚙️ Environment Variables

```env
# Backend (.env)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=sk-ant-...
MODELS_DIR=./models
CHROMA_PERSIST_DIR=./chroma_db

# Frontend (.env)
VITE_API_BASE_URL=https://your-backend.railway.app
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), SSE streaming |
| Backend | FastAPI, Python 3.11+ |
| ML | scikit-learn, joblib, pandas, numpy |
| LLM | Anthropic Claude (claude-opus) |
| RAG | ChromaDB + sentence-transformers |
| Cache | Redis (aioredis) |
| Queue | Celery + Redis broker |
| Reports | python-pptx, WeasyPrint |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Deploy FE | Vercel |
| Deploy BE | Railway |

---

## 🧪 Quick Start (Local)

```bash
# 1. Clone and setup
git clone <repo>
cd Migration-Intelligence-Platform

# 2. Backend
cd backend
pip install -r requirements.txt
python scripts/setup_db.py       # init database
python scripts/train_models.py   # train ML models
uvicorn main:app --reload        # start API server

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

API docs auto-generated at: `http://localhost:8000/docs`
