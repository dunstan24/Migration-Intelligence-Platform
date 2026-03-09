# 🌿 Git Branching Strategy

> Menggunakan **GitFlow** yang disederhanakan, disesuaikan untuk tim fullstack dengan komponen ML.

---

## 🗺️ Struktur Branch

```
main
 └── develop
      ├── feature/frontend/dashboard-charts
      ├── feature/frontend/chat-sse-streaming
      ├── feature/frontend/predictors-form
      ├── feature/frontend/reports-page
      ├── feature/frontend/admin-panel
      │
      ├── feature/backend/data-endpoints
      ├── feature/backend/predict-api
      ├── feature/backend/llm-rag-chat
      ├── feature/backend/redis-cache
      │
      ├── feature/ml/model-training
      ├── feature/ml/shap-explainer
      ├── feature/ml/rag-vectorstore
      │
      ├── fix/login-token-refresh
      ├── fix/shap-null-values
      │
      └── release/v1.0.0
           └── hotfix/v1.0.1-sse-disconnect
```

---

## 🏷️ Deskripsi Tiap Branch

### `main`
- Kode **production-ready** saja
- Tidak pernah di-commit langsung
- Hanya menerima merge dari `release/*` atau `hotfix/*`
- Di-deploy otomatis ke **Vercel** (frontend) & **Railway** (backend)

---

### `develop`
- Branch integrasi utama untuk semua developer
- Semua `feature/*` di-merge ke sini lewat **Pull Request**
- Wajib passing CI (lint, test, build) sebelum merge
- Di-deploy otomatis ke **staging environment**

---

### `feature/*`

Penamaan: `feature/{scope}/{deskripsi-singkat}`

| Scope | Contoh Branch | Dikerjakan oleh |
|-------|--------------|-----------------|
| `frontend` | `feature/frontend/dashboard-charts` | Frontend dev |
| `backend` | `feature/backend/predict-api` | Backend dev |
| `ml` | `feature/ml/model-training` | ML engineer |
| `db` | `feature/db/add-user-table` | Backend / DBA |
| `infra` | `feature/infra/redis-setup` | DevOps |

**Aturan:**
- Dibuat dari `develop`
- Satu branch = satu fitur / task
- Merge kembali ke `develop` via PR
- Hapus branch setelah merge

---

### `fix/*`

Penamaan: `fix/{deskripsi-bug}`

Contoh: `fix/shap-null-values`, `fix/chat-sse-timeout`

- Untuk bug yang ditemukan **sebelum** production
- Dibuat dari `develop`, merge ke `develop`

---

### `release/*`

Penamaan: `release/v{major}.{minor}.{patch}`

Contoh: `release/v1.0.0`

- Dibuat dari `develop` saat siap rilis
- Hanya boleh ada **bug fix minor** dan update versi di branch ini
- Setelah siap: merge ke `main` **dan** back-merge ke `develop`
- Tag versi dibuat di `main`: `git tag v1.0.0`

---

### `hotfix/*`

Penamaan: `hotfix/v{version}-{deskripsi}`

Contoh: `hotfix/v1.0.1-sse-disconnect`

- Untuk bug **kritis di production** yang tidak bisa tunggu release cycle
- Dibuat dari `main`
- Setelah selesai: merge ke `main` **dan** `develop`
- Buat tag baru di `main`

---

## 👥 Pembagian Tugas Tim

```
Tim (contoh 4 orang):

┌─────────────────┬────────────────────────────────────────────────┐
│ Role            │ Branch yang dikerjakan                          │
├─────────────────┼────────────────────────────────────────────────┤
│ Frontend Dev    │ feature/frontend/*                              │
│ Backend Dev     │ feature/backend/*, feature/db/*                 │
│ ML Engineer     │ feature/ml/*, feature/backend/predict-api       │
│ Tech Lead / QA  │ Code review PR, merge ke develop & main         │
└─────────────────┴────────────────────────────────────────────────┘
```

---

## 🔄 Alur Kerja Harian

```
1. Ambil task dari board (Jira / Linear / GitHub Issues)

2. Update develop lokal:
   git checkout develop
   git pull origin develop

3. Buat feature branch:
   git checkout -b feature/frontend/chat-sse-streaming

4. Kerjakan → commit kecil-kecil:
   git add .
   git commit -m "feat(chat): add SSE hook for token streaming"

5. Push ke remote:
   git push origin feature/frontend/chat-sse-streaming

6. Buka Pull Request → develop
   - Assign reviewer (minimal 1 orang)
   - Pastikan CI hijau

7. Reviewer approve → Squash & Merge ke develop

8. Hapus branch:
   git branch -d feature/frontend/chat-sse-streaming
```

---

## ✍️ Konvensi Commit Message

Format: `type(scope): deskripsi singkat`

| Type | Digunakan untuk |
|------|----------------|
| `feat` | Fitur baru |
| `fix` | Bug fix |
| `chore` | Setup, config, dependencies |
| `docs` | Dokumentasi |
| `refactor` | Refactor tanpa mengubah behaviour |
| `test` | Menambah/mengubah test |
| `perf` | Optimasi performa |

**Contoh commit:**
```
feat(predict): integrate SHAP explainer to /api/predict endpoint
fix(chat): handle SSE disconnect on mobile browsers
chore(deps): upgrade FastAPI to 0.111.0
docs(readme): add RAG workflow diagram
refactor(cache): extract Redis client to separate module
test(data): add unit test for /api/data/summary endpoint
```

---

## 🔒 Branch Protection Rules (GitHub)

Pasang di Settings → Branches:

### `main`
- ✅ Require pull request before merging
- ✅ Require 2 approving reviews
- ✅ Require status checks (CI) to pass
- ✅ Require branches to be up to date
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

### `develop`
- ✅ Require pull request before merging
- ✅ Require 1 approving review
- ✅ Require status checks (CI) to pass
- ✅ Do not allow force pushes

---

## 🚦 CI Checks (GitHub Actions)

Setiap PR ke `develop` wajib passing:

```yaml
# .github/workflows/ci.yml

on: [pull_request]

jobs:
  frontend:
    - npm install
    - npm run lint
    - npm run build

  backend:
    - pip install -r requirements.txt
    - ruff check .
    - pytest tests/

  ml:
    - pytest tests/ml/
```

---

## 📦 Ringkasan Aturan

| Aturan | Keterangan |
|--------|-----------|
| Commit ke `main` langsung | ❌ Dilarang |
| Commit ke `develop` langsung | ❌ Dilarang (kecuali Tech Lead untuk hotfix kecil) |
| PR harus ada reviewer | ✅ Wajib min. 1 |
| Branch hidup > 1 minggu tanpa PR | ⚠️ Perlu di-review |
| Squash merge ke `develop` | ✅ Dianjurkan (history bersih) |
| Merge commit ke `main` | ✅ Dianjurkan (agar traceable) |
| Tag setiap rilis di `main` | ✅ Wajib |
