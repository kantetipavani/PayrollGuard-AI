@echo off
echo Starting Naxpayroll FastAPI Backend on http://localhost:8001...
set PYTHONPATH=backend
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8001 --reload
