from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.payrollguard import router as payrollguard_router
from app.api.payroll_calculation import router as payroll_calculation_router
from app.api.naxpayroll import router as naxpayroll_router, ensure_initial_seed
from app.db.schema import ensure_database_schema
from app.db.session import ping_database

app = FastAPI(title="Naxpayroll PayrollGuard AI API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(payrollguard_router)
app.include_router(payroll_calculation_router)
app.include_router(naxpayroll_router)

@app.on_event("startup")
def startup() -> None:
    # Keep the API available even when MongoDB starts later than the API.
    # Database-dependent endpoints return a clear 503 until MongoDB is ready.
    try:
        ping_database()
        ensure_database_schema()
        ensure_initial_seed()
    except Exception as exc:
        print(f"PayrollGuard startup: MongoDB is not ready yet: {exc}")

@app.get("/health")
def root_health():
    try:
        ping_database()
        return {"service": "PayrollGuard AI", "status": "running", "database": "connected"}
    except Exception as exc:
        return {"service": "PayrollGuard AI", "status": "running", "database": "disconnected", "detail": str(exc)}
