# PayrollGuard AI — primary Naxpayroll workspace

PayrollGuard AI is now the first Organisation Admin navigation item and the default landing screen. The existing Naxpayroll Dashboard, Employees, Salary Management, Payroll / Pay Runs, Payslips, Documents, Reports, Access Management, Audit History and Settings remain available after it.

## Architecture and data isolation

- Existing Naxpayroll frontend: React + TypeScript + Vite (Vite port `8443`).
- PayrollGuard service: FastAPI on `http://localhost:8001`.
- PayrollGuard database: MongoDB database `naxpayroll_guard` (separate from any existing Naxpayroll data).
- Frontend dashboard reads live counts from the PayrollGuard API; the API reads MongoDB directly.
- Synthetic ground-truth labels are written only to `data/ground_truth/`, never into operational collections.

## Windows setup

1. Install and start MongoDB Community Server. The default local URI is `mongodb://localhost:27017`.
2. In PowerShell at the repository root:

```powershell
py -3.11 -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
$env:PYTHONPATH = "backend"
python backend\scripts\init_db.py
uvicorn app.main:app --app-dir backend --reload --port 8001
```

3. In a second PowerShell window, start the existing frontend:

```powershell
npm install
npm run dev
```

4. Open the Vite URL shown in the terminal (this project defaults to `http://localhost:8443`), sign in as Organisation Admin, and select **PayrollGuard AI**. It is also the initial Organisation Admin screen.

## Verify the database connection

Open these endpoints:

- `http://localhost:8001/health`
- `http://localhost:8001/api/v1/payrollguard/health`
- `http://localhost:8001/api/v1/payrollguard/dashboard`
- `http://localhost:8001/docs`

The dashboard shows the database name and live collection counts. If MongoDB is stopped or unreachable, the API health check reports the connection failure and the UI displays the error.

## Generate the deterministic synthetic dataset

From the repository root, in a PowerShell window where the backend virtual environment is active:

```powershell
$env:PYTHONPATH = "backend"
python backend\scripts\generate_synthetic_data.py --reset --seed 20261022
```

The reset affects only the dedicated PayrollGuard collections in `naxpayroll_guard`; it does not clear existing Naxpayroll collections. Expected key counts:

| Collection | Records |
|---|---:|
| Employees | 3,000 |
| Pay periods | 3 |
| Time entries | 90,000 |
| Leave records | 3,000 |
| Allowance transactions | 5,000 |
| Deduction transactions | 5,000 |
| Validation rules | 10 |

CSV outputs, separate ground truth, validation summary and SHA-256 manifest are written beneath `data/`. Use synthetic data only. Never expose the development generation endpoint to the public internet or point this local assessment setup at a production database.

## Automated local verification

After installing dependencies and starting MongoDB + the FastAPI service, run from the repository root in PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\Verify-PayrollGuard.ps1
```

This checks Python syntax, the frontend production build, API health, MongoDB connectivity and dashboard access. To also reset and regenerate the synthetic dataset and verify its expected record counts, run:

```powershell
.\scripts\Verify-PayrollGuard.ps1 -GenerateData
```

The second command prompts for the exact word `GENERATE` because it resets only the dedicated `naxpayroll_guard` collections. Do not run it against production data.

## Date storage compatibility fix

The generator converts date-only Python values to UTC-midnight `datetime` values before MongoDB insertion. This is required because BSON stores dates as datetimes and PyMongo does not encode Python `datetime.date` objects directly.
