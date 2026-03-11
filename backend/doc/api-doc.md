# Migration Intelligence Platform - API Documentation

Base URL (Local): `http://127.0.0.1:8000`

## 1. Data Endpoints (`/api/data/*`)

These endpoints retrieve aggregated data from the SQLite database. Responses are cached in Redis to improve performance.

### `GET /api/data/summary`
Retrieves key performance indicators (KPIs) for the dashboard.
- **Response Format:**
  ```json
  {
    "eoi_pool": 2580000,
    "total_invitations": 58570,
    "points_cutoff": 85,
    "shortage_occupations": 342,
    "total_tracked": 916,
    "status": "live"
  }
  ```

### `GET /api/data/migration-trends`
Retrieves the breakdown of EOI submissions by their current status.
- **Response Format:**
  ```json
  {
    "source": "eoi_submissions",
    "rows": [
      {"status": "Submitted", "count": 150000},
      {"status": "Invited", "count": 20000}
    ],
    "status": "live"
  }
  ```

### `GET /api/data/shortage-heatmap`
Retrieves a count of occupations experiencing shortages, grouped by shortage type (e.g., National, Regional) for a specific year.
- **Query Parameters:**
  - `year` (int, default: 2025): The year to filter by (2021-2025).
- **Response Format:**
  ```json
  {
    "year": 2025,
    "source": "osl_shortages",
    "rows": [
      {"state": "National", "shortage_count": 150},
      {"state": "Regional", "shortage_count": 80}
    ],
    "status": "live"
  }
  ```

### `GET /api/data/eoi`
Retrieves a breakdown of EOI submissions grouped by Visa Type and Nominated State.
- **Query Parameters:**
  - `limit` (int, default: 100): Maximum number of rows to return.
- **Response Format:**
  ```json
  {
    "source": "eoi_submissions",
    "rows": [
      {"visa_type": "190", "state": "NSW", "count": 45000},
      {"visa_type": "491", "state": "VIC", "count": 32000}
    ],
    "status": "live"
  }
  ```

### `GET /api/data/employment-projections`
Retrieves the total projected employment counts grouped by year from the NERO dataset.
- **Response Format:**
  ```json
  {
    "source": "nero_employment",
    "rows": [
      {"year": "2025", "total_employed": 12500000},
      {"year": "2026", "total_employed": 12800000}
    ],
    "status": "live"
  }
  ```

### `GET /api/data/visa-analytics`
Retrieves state nomination quota allocations by visa type and state.
- **Response Format:**
  ```json
  {
    "source": "quotas",
    "rows": [
      {"state": "NSW", "visa_type": "190", "allocation": 3000},
      {"state": "VIC", "visa_type": "491", "allocation": 2000}
    ],
    "status": "live"
  }
  ```

---

## 2. Machine Learning Predictors (`/api/predict/*`)

These endpoints perform real-time model inference using loading Scikit-Learn `joblib` models.

### `POST /api/predict/{model_name}`
Runs statistical inference using one of the four core ML models.
- **Path Parameters:**
  - `model_name` (string): Must be one of `pathway`, `shortage`, `volume`, or `approval`.
- **Request Body (JSON):**
  ```json
  {
    "occupation": "261313",
    "state": "NSW",
    "points": 85,
    "english": "competent",
    "age": 30,
    "experience": 3,
    "country": "CN",
    "visa_type": "189",
    "shortage_streak": 1,
    "employment_growth": 0.05,
    "base_trend": 0.5,
    "seasonal": 1.0,
    "english_band": 6.0,
    "skills_assessed": "True",
    "country_risk_tier": 1
  }
  ```
  *(Note: Send only the fields relevant to your chosen model; omitted fields will use defaults).*

- **Response Format (`pathway` example - Classification):**
  ```json
  {
    "model": "pathway",
    "prediction": 1,
    "confidence": 0.85,
    "shap_values": {"occupation": 0.42, "state": 0.18, "points": 0.15},
    "model_loaded": true,
    "features_received": ["occupation", "state", "points"],
    "pathways": [
      {
        "visa": "190 — State Nominated",
        "state": "NSW",
        "score": 0.85
      }
    ]
  }
  ```

- **Response Format (`shortage` example - Regression):**
  ```json
  {
    "model": "shortage",
    "prediction": 0.6543,
    "confidence": 0.85,
    "shap_values": {"shortage_streak": 0.38, "employment_growth": 0.24},
    "model_loaded": true,
    "features_received": ["shortage_streak", "employment_growth"],
    "forecast": [
      {"year": 2026, "shortage_intensity": 0.687},
      {"year": 2027, "shortage_intensity": 0.720}
    ]
  }
  ```

---

## 3. System & Health Endpoints

### `GET /health`
Returns the operational status of the server and verifies which Machine Learning models are correctly loaded into active CPU memory.
- **Response Format:**
  ```json
  {
    "status": "ok",
    "models_loaded": {
      "pathway": true,
      "shortage": true,
      "volume": true,
      "approval": true
    }
  }
  ```
