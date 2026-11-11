from fastapi import APIRouter, HTTPException
from pathlib import Path
import subprocess, sys, json
from app.db.session import get_database, ping_database
from app.db.schema import RULES

router = APIRouter(prefix="/api/v1/payrollguard", tags=["PayrollGuard AI"])

@router.get("/health")
def health():
    try:
        ping_database(); return {"status":"ok","database":"connected"}
    except Exception as exc:
        return {"status":"degraded","database":"disconnected","detail":str(exc)}

@router.get("/dashboard")
def dashboard():
    try:
        db=get_database(); ping_database()
        names=["employees","pay_groups","pay_periods","time_entries","leave_records","allowance_components","deduction_components","employee_allowance_eligibility","employee_deduction_eligibility","allowance_transactions","deduction_transactions","payroll_inputs","exceptions","approvals","payroll_exports","payroll_export_items","audit_events","payroll_calculation_runs","payroll_calculations","payroll_reconciliations"]
        counts={n:db[n].count_documents({}) for n in names}
        return {"database":"connected","counts":counts,"open_exceptions":db.exceptions.count_documents({"status":{"$in":["OPEN","IN_REVIEW"]}}),"rules":len(RULES),"database_name":db.name}
    except Exception as exc:
        raise HTTPException(status_code=503,detail=f"MongoDB unavailable: {exc}")

@router.get("/rules")
def rules():
    return [{"rule_id":a,"code":b,"description":c,"severity":d} for a,b,c,d in RULES]

@router.post("/generate")
def generate(seed: int=20261022):
    # Intended for local assessment/dev use only; never expose this endpoint publicly.
    root=Path(__file__).resolve().parents[2]
    script=root/"scripts"/"generate_synthetic_data.py"
    try:
        result=subprocess.run(
            [sys.executable,str(script),"--reset","--seed",str(seed)],
            cwd=root.parent, capture_output=True, text=True, timeout=900,
            encoding="utf-8", errors="replace",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504,detail="Synthetic data generation exceeded 15 minutes. Check MongoDB performance and backend logs, then retry.")
    if result.returncode:
        detail=(result.stderr or result.stdout or "Generator exited without diagnostic output.")[-5000:]
        raise HTTPException(status_code=500,detail=detail)
    try:
        payload=json.loads(result.stdout)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=500,detail="Generator finished but returned an invalid JSON summary. Check backend terminal output.")
    return payload

# Phase 4: exception triage and auditable review workflow.
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class ExceptionUpdate(BaseModel):
    action: str = Field(pattern="^(IN_REVIEW|RESOLVE|REOPEN)$")
    note: str = Field(default="", max_length=1000)
    reviewed_by: str = Field(default="Payroll Admin", max_length=120)

@router.get("/exceptions")
def list_exceptions(status: Optional[str] = None, severity: Optional[str] = None,
                   pay_period_id: Optional[str] = None, limit: int = 100, skip: int = 0):
    try:
        ping_database(); db = get_database()
        query = {}
        if status and status.upper() != "ALL": query["status"] = status.upper()
        if severity and severity.upper() != "ALL": query["severity"] = severity.upper()
        if pay_period_id: query["pay_period_id"] = pay_period_id
        limit = max(1, min(limit, 500)); skip = max(0, skip)
        rows = list(db.exceptions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit))
        for row in rows:
            if isinstance(row.get("created_at"), datetime): row["created_at"] = row["created_at"].isoformat()
            if isinstance(row.get("updated_at"), datetime): row["updated_at"] = row["updated_at"].isoformat()
        return {"items": rows, "total": db.exceptions.count_documents(query), "limit": limit, "skip": skip}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Unable to load exceptions: {exc}")

@router.patch("/exceptions/{exception_id}")
def update_exception(exception_id: str, payload: ExceptionUpdate):
    try:
        ping_database(); db = get_database()
        row = db.exceptions.find_one({"exception_id": exception_id})
        if not row: raise HTTPException(status_code=404, detail="Exception not found")
        now = datetime.now(timezone.utc)
        action = payload.action
        new_status = {"IN_REVIEW": "IN_REVIEW", "RESOLVE": "RESOLVED", "REOPEN": "OPEN"}[action]
        update = {"status": new_status, "updated_at": now, "reviewed_by": payload.reviewed_by}
        if payload.note.strip(): update["review_note"] = payload.note.strip()
        if action == "RESOLVE": update["resolved_at"] = now
        if action == "REOPEN": update["resolved_at"] = None
        db.exceptions.update_one({"exception_id": exception_id}, {"$set": update})
        db.audit_events.insert_one({
            "audit_event_id": f"AUD-{now.strftime('%Y%m%d%H%M%S%f')}",
            "event_type": "EXCEPTION_" + action,
            "entity_type": "exception", "entity_id": exception_id,
            "employee_id": row.get("employee_id"), "pay_period_id": row.get("pay_period_id"),
            "actor": payload.reviewed_by, "note": payload.note.strip(),
            "previous_status": row.get("status"), "new_status": new_status,
            "created_at": now,
        })
        return {"exception_id": exception_id, "status": new_status, "message": f"Exception {new_status.lower().replace('_',' ')} and audit event recorded."}
    except HTTPException: raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Unable to update exception: {exc}")

@router.get("/exception-summary")
def exception_summary(pay_period_id: Optional[str] = None):
    try:
        ping_database(); db = get_database()
        match = {"pay_period_id": pay_period_id} if pay_period_id else {}
        statuses = ["OPEN", "IN_REVIEW", "RESOLVED"]
        result = {s: db.exceptions.count_documents({**match, "status": s}) for s in statuses}
        result["total"] = sum(result.values())
        result["by_severity"] = {s: db.exceptions.count_documents({**match, "severity": s, "status": {"$in": ["OPEN", "IN_REVIEW"]}}) for s in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]}
        return result
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Unable to summarize exceptions: {exc}")
