# PayrollGuard AI backend

This backend is isolated from the existing Naxpayroll frontend API and uses its own MongoDB database (`naxpayroll_guard`).

From the repository root in Windows PowerShell:

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

MongoDB Community Server must be running locally. The API is available at `http://localhost:8001`; interactive API documentation is at `/docs`.

Generate the deterministic assessment dataset from the repository root in a second backend terminal:

```powershell
$env:PYTHONPATH = "backend"
python backend\scripts\generate_synthetic_data.py --reset --seed 20261022
```

The generator resets only PayrollGuard collections and writes generated CSVs, separate ground truth and SHA-256 manifests beneath `data/`. Do not expose this development generator to the public internet or run it against a production database.
