# 🏗️ System Architecture Documentation

> Full-stack ML prediction platform with RAG-powered chat, built on React + FastAPI

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND — React (Vite/CRA)               │
│    Dashboard  │  Predictors  │  Chat  │  Reports  │  Admin  │
└────────────────────────────┬────────────────────────────────┘
                             │
                   REST API + SSE Streaming
                             │
┌────────────────────────────▼────────────────────────────────┐
│                   BACKEND — FastAPI (Railway)                │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ /api/data/* │   │/api/predict/*│   │   /api/llm/*     │  │
│  │ 6 endpoints │   │ 4 ML models  │   │ Claude streaming │  │
│  │ Redis cached│   │ SHAP explain │   │   RAG search     │  │
│  └─────────────┘   └──────────────┘   └──────────────────┘  │
└──────┬───────────────────┬────────────────────┬─────────────┘
       │                   │                    │
┌──────▼──────┐   ┌────────▼───────┐   ┌────────▼──────────┐
│  SQLite /   │   │  ML Models     │   │  ChromaDB + Redis  │
│  PostgreSQL │   │  (.joblib)     │   │                    │
│             │   │                │   │  Vector store      │
│ 19 tables   │   │ 4 serialised   │   │  + cache           │
│ migration   │   │ loaded at      │   │  RAG + job queue   │
│ warehouse   │   │ startup        │   │                    │
└─────────────┘   └────────────────┘   └────────────────────┘
```

---

## 🗂️ Project Structure

```
project/
├── frontend/                   # React App
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
├── backend/                    # FastAPI App
│   ├── main.py
│   ├── routers/
│   │   ├── data.py             # /api/data/*
│   │   ├── predict.py          # /api/predict/*
│   │   └── llm.py              # /api/llm/*
│   ├── models/                 # .joblib ML models
│   │   ├── model_a.joblib
│   │   ├── model_b.joblib
│   │   ├── model_c.joblib
│   │   └── model_d.joblib
│   ├── db/
│   │   ├── database.py         # SQLAlchemy setup
│   │   └── migrations/
│   ├── rag/
│   │   ├── vectorstore.py      # ChromaDB integration
│   │   └── embeddings.py
│   ├── cache/
│   │   └── redis_client.py
│   └── requirements.txt
│
└── README.md
```

---

## 🔄 Workflow Breakdown

---

### 1️⃣ Dashboard Workflow

**Purpose:** Display aggregated data metrics and KPIs.

```
User visits /dashboard
        │
        ▼
React fetches GET /api/data/summary
        │
        ▼
FastAPI checks Redis cache
    ├── HIT  → return cached JSON immediately
    └── MISS → query PostgreSQL/SQLite
                    │
                    ▼
              cache result in Redis (TTL: e.g. 5 min)
                    │
                    ▼
        return JSON to React
                    │
                    ▼
        React renders charts/tables
```

**Key files:**
- Frontend: `pages/Dashboard.jsx`
- Backend: `routers/data.py` → `GET /api/data/summary`
- Cache: Redis with TTL

---

### 2️⃣ Predictors Workflow

**Purpose:** Run ML model inference with explainability via SHAP.

```
User fills prediction form
        │
        ▼
React sends POST /api/predict/{model_name}
  body: { feature_1, feature_2, ... }
        │
        ▼
FastAPI router loads pre-loaded .joblib model
  (models loaded into memory at startup — no disk I/O per request)
        │
        ▼
Run model.predict(input_data)
        │
        ▼
Run SHAP explainer → feature importance values
        │
        ▼
Return JSON:
  {
    "prediction": 0.87,
    "confidence": 0.92,
    "shap_values": { "feature_1": 0.32, ... }
  }
        │
        ▼
React renders prediction result + SHAP bar chart
```

**Key files:**
- Frontend: `pages/Predictors.jsx`
- Backend: `routers/predict.py` → `POST /api/predict/{model}`
- Models: `models/*.joblib` (loaded at app startup via `lifespan` or `startup` event)

---

### 3️⃣ Chat Workflow (RAG + Claude Streaming)

**Purpose:** AI-powered chat with contextual document search using RAG.

```
User types a message → clicks Send
        │
        ▼
React sends POST /api/llm/chat
  body: { message: "...", session_id: "..." }
        │
        ▼
FastAPI RAG pipeline:
  1. Embed user query → vector
  2. Search ChromaDB → top-K relevant document chunks
  3. Build prompt: system + retrieved context + user message
        │
        ▼
FastAPI calls Anthropic Claude API (streaming)
        │
        ▼
FastAPI returns SSE stream (text/event-stream):
  data: {"token": "Hello"}
  data: {"token": " there"}
  data: [DONE]
        │
        ▼
React useSSE() hook reads stream token by token
        │
        ▼
UI renders text progressively as it arrives
```

**Key files:**
- Frontend: `pages/Chat.jsx`, `hooks/useSSE.js`
- Backend: `routers/llm.py` → `POST /api/llm/chat`
- RAG: `rag/vectorstore.py` (ChromaDB), `rag/embeddings.py`

**SSE hook pattern (React):**
```js
// hooks/useSSE.js
async function streamChat(message, onToken) {
  const res = await fetch('/api/llm/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
    headers: { 'Content-Type': 'application/json' }
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    onToken(chunk); // update state token by token
  }
}
```

---

### 4️⃣ Reports Workflow

**Purpose:** Generate and download data reports.

```
User selects report type + date range → clicks Generate
        │
        ▼
React sends GET /api/data/report?type=X&from=Y&to=Z
        │
        ▼
FastAPI queries PostgreSQL/SQLite for filtered data
        │
        ▼
Aggregates and formats data (pandas / raw SQL)
        │
        ▼
Returns JSON or triggers file download (CSV/PDF)
        │
        ▼
React renders report table / triggers browser download
```

**Key files:**
- Frontend: `pages/Reports.jsx`
- Backend: `routers/data.py` → `GET /api/data/report`

---

### 5️⃣ Admin Workflow

**Purpose:** Manage users, data, models, and system config.

```
Admin navigates to /admin
        │
        ▼
React fetches GET /api/data/admin/* (auth-protected)
        │
        ▼
FastAPI validates JWT / session token
    ├── FAIL → 401 Unauthorized
    └── PASS → process request
                    │
                    ▼
             CRUD on DB tables
             OR trigger model retraining
             OR manage RAG document index
                    │
                    ▼
             return result to React
```

**Key files:**
- Frontend: `pages/Admin.jsx`
- Backend: `routers/data.py` (admin sub-routes), auth middleware

---

## 🗄️ Database Layer

### SQLite / PostgreSQL

| Detail | Value |
|--------|-------|
| Tables | 5 data tables (`occupations`, `osl_shortages`, `quotas`, `eoi_submissions`, `nero_employment`) |
| ORM | SQLAlchemy (async) |
| Source | Raw CSV/Excel ingested via Pandas streaming ETL |
| Dev | SQLite (local `warehouse.db`) |
| Prod | PostgreSQL (Railway) |

---

## 🤖 ML Models Layer

| Detail | Value |
|--------|-------|
| Format | `.joblib` serialised files (Scikit-Learn RandomForest Pipelines) |
| Count | 4 models (Pathway, Shortage, Volume, Approval) |
| Loading | At app startup (once, into memory via FastAPI Lifespan) |
| Feature Engineering | Pipeline automated logic (`StandardScaler`, `SimpleImputer`, `OrdinalEncoder`) |
| Explainability | Baseline mock-SHAP (Until UI feature maturity) |

**Startup loading pattern:**
```python
# main.py
from contextlib import asynccontextmanager
import joblib

models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    models["model_a"] = joblib.load("models/model_a.joblib")
    models["model_b"] = joblib.load("models/model_b.joblib")
    # ... load all 4
    yield
    models.clear()

app = FastAPI(lifespan=lifespan)
```

---

## 🧠 ChromaDB + Redis Layer

| Component | Purpose |
|-----------|---------|
| ChromaDB | Vector store for RAG document embeddings |
| Redis | HTTP response cache + background job queue |

**RAG flow:**
1. Documents are pre-embedded and stored in ChromaDB
2. At query time, user message → embed → similarity search → top-K chunks
3. Chunks injected into Claude prompt as context

**Redis usage:**
- Cache: `/api/data/*` responses with TTL
- Queue: Background jobs (e.g. async report generation, model retraining)

---

## 🚀 Deployment

| Layer | Platform |
|-------|----------|
| Frontend | Vercel (React static build) |
| Backend | Railway (FastAPI + Uvicorn) |
| Database | Railway PostgreSQL add-on |
| Cache/Queue | Railway Redis add-on |
| Vector DB | ChromaDB (self-hosted on Railway or persistent volume) |

---

## ⚙️ Environment Variables

```env
# Backend (.env)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
CHROMA_PERSIST_DIR=./chroma_db

# Frontend (.env)
VITE_API_BASE_URL=https://your-backend.railway.app
```

---

## 🛠️ Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), SSE streaming |
| Backend | FastAPI, Python |
| ML | scikit-learn / XGBoost + SHAP, joblib |
| LLM | Anthropic Claude API |
| Vector DB | ChromaDB |
| Cache | Redis |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Deploy FE | Vercel |
| Deploy BE | Railway |
