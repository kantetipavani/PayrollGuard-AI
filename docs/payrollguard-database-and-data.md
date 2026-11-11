# PayrollGuard AI — local data and database setup

PayrollGuard is isolated from the existing Naxpayroll modules and uses its own MongoDB database (`naxpayroll_guard`). The supplied CSV dataset is synthetic and is committed under `data/` so the project includes usable data files immediately. The MongoDB collections are populated separately by the backend generator.

## 1. Requirements

- Windows 10/11
- Python 3.11 (recommended)
- Node.js 20+
- MongoDB Community Server running locally on `127.0.0.1:27017`

## 2. Install and start everything

Open PowerShell at the project root:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\Start-PayrollGuard.ps1 -InstallDependencies
```

The script checks MongoDB, creates `backend\\.venv`, installs backend/frontend packages, starts FastAPI on port 8001 and starts Vite on port 8443. The Vite development server proxies `/api` and `/health` to FastAPI, avoiding browser CORS and `Failed to fetch` errors in local development.

## 3. Initialize and populate MongoDB

With MongoDB running, use a second PowerShell window at the project root:

```powershell
.\scripts\Start-PayrollGuard.ps1 -GenerateData
```

This resets only the dedicated PayrollGuard business collections in `naxpayroll_guard`, registers the ten rules and creates the deterministic records using seed `20261022`. Do not run `--reset` against a production database.

Alternatively, after the backend virtual environment is active:

```powershell
$env:PYTHONPATH = (Resolve-Path backend).Path
python backend\scripts\init_db.py
python backend\scripts\generate_synthetic_data.py --reset --seed 20261022
```

## 4. Verify connectivity

- API health: `http://127.0.0.1:8001/api/v1/payrollguard/health`
- API dashboard: `http://127.0.0.1:8001/api/v1/payrollguard/dashboard`
- API docs: `http://127.0.0.1:8001/docs`
- Frontend: `http://localhost:8443`

The dashboard returns MongoDB collection counts. If the database is offline, the API remains available and reports `database: disconnected`; start MongoDB and press **Refresh**. If the API is stopped, start it with the command above and refresh. The dashboard now reads response bodies as text before JSON parsing, so an empty or non-JSON proxy/backend response produces a readable diagnostic instead of `Unexpected end of JSON input`.

## 5. Included offline CSV dataset

`data/generated/` includes pay periods, employees, time entries, leave records, allowance transactions, deduction transactions, four seeded exceptions and four pending approval examples. `data/ground_truth/ground_truth.csv` contains test expectations and must never be imported into application collections or read by production validation. `data/manifests/` contains counts and SHA-256 hashes. To regenerate only the CSV dataset without MongoDB:

```powershell
python backend\scripts\generate_synthetic_csv.py --seed 20261022
```

Expected counts: 3,000 employees; 1 pay group; 3 pay periods; 90,000 time entries; 3,000 leave records; 5,000 allowance transactions; 5,000 deduction transactions; 4 exceptions; 4 pending approvals; 0 payroll exports (exports are intentionally empty until a later payroll-processing phase); 10 validation rules. The four CSV exception/approval rows are deterministic demo fixtures. The MongoDB generator creates corresponding records in the dedicated database.

## 6. Frontend build

```powershell
npm ci
npm run build
```

For a non-local deployment, set `VITE_PAYROLLGUARD_API_URL` to the API origin before building. The Vite proxy is only for local development.
