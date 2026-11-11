"""Phase 3 deterministic payroll calculation and reconciliation service.

Calculation assumptions for this synthetic assessment dataset:
- Monthly salary is stored on each synthetic employee. Older Phase 2 data without
  it uses a deterministic fallback salary (INR 30,000..52,500).
- Approved hours are paid at monthly_salary / 160; hours above 160 are paid at
  1.5x. More than 200 approved hours is held for review (VR-004).
- Only APPROVED transactions and APPROVED leave are considered.
- Duplicate allowance/deduction source keys are counted once and flagged.
- Approved unpaid leave is deducted at monthly_salary / calendar days unless
  an approved DED-005 unpaid-leave transaction already supplies that deduction.
- Missing bank/tax details and non-active employees are held from payment.
"""
from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4
from bson.decimal128 import Decimal128
from fastapi import APIRouter, HTTPException, Query
from pymongo import ASCENDING
from app.db.session import get_database, ping_database

router = APIRouter(prefix="/api/v1/payrollguard", tags=["PayrollGuard AI – Phase 3"])
CENT = Decimal("0.01")

def money(value) -> Decimal:
    if isinstance(value, Decimal128): return value.to_decimal()
    if isinstance(value, Decimal): return value
    return Decimal(str(value or 0))

def rounded(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)

def as_number(value: Decimal) -> float:
    return float(rounded(value))

def fallback_salary(employee_id: str) -> Decimal:
    try: n = int(employee_id.split("-")[-1])
    except (ValueError, IndexError): n = 1
    return Decimal(30000 + (n % 10) * 2500)

def period_days(period: dict) -> int:
    start, end = period.get("start_date"), period.get("end_date")
    if not start or not end: return 30
    return max(1, (end.date() - start.date()).days + 1 if isinstance(start, datetime) else (end-start).days+1)

def _group(rows, key_fn):
    result = {}
    for row in rows: result.setdefault(key_fn(row), []).append(row)
    return result

@router.post("/calculate")
def calculate_payroll(pay_period_id: str = Query(..., min_length=1)):
    """Create an immutable calculation run for one pay period."""
    try:
        ping_database(); db = get_database()
        period = db.pay_periods.find_one({"pay_period_id": pay_period_id})
        if not period: raise HTTPException(status_code=404, detail=f"Pay period {pay_period_id} was not found")
        run_id = f"RUN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        employees = list(db.employees.find({"pay_group_id": period.get("pay_group_id")}, {"_id": 0}))
        if not employees: raise HTTPException(status_code=409, detail="No employees found for this pay group. Generate the Phase 2 dataset first.")
        emp_ids = [e["employee_id"] for e in employees]
        times = list(db.time_entries.find({"pay_period_id": pay_period_id, "employee_id":{"$in":emp_ids}}, {"_id":0}))
        leaves = list(db.leave_records.find({"pay_period_id":pay_period_id,"employee_id":{"$in":emp_ids},"status":"APPROVED"},{"_id":0}))
        allowances = list(db.allowance_transactions.find({"pay_period_id":pay_period_id,"employee_id":{"$in":emp_ids}},{"_id":0}))
        deductions = list(db.deduction_transactions.find({"pay_period_id":pay_period_id,"employee_id":{"$in":emp_ids}},{"_id":0}))
        times_by = _group(times, lambda x:x["employee_id"])
        leaves_by = _group(leaves, lambda x:x["employee_id"])
        allow_by = _group(allowances, lambda x:x["employee_id"])
        deduct_by = _group(deductions, lambda x:x["employee_id"])
        # Existing source exceptions are retained; calculation-specific ones are added per run.
        calc_docs=[]; new_exceptions=[]; totals={"gross":Decimal(0),"deductions":Decimal(0),"net":Decimal(0)}
        eligible_count=0; held_count=0; approved_time_total=Decimal(0); unapproved_excluded=0
        days = period_days(period)
        for emp in employees:
            eid=emp["employee_id"]; issues=[]
            trows=times_by.get(eid,[])
            approved_hours=Decimal(0); seen_work_dates=set(); duplicate_time_count=0
            for entry in trows:
                if entry.get("status")!="APPROVED":
                    unapproved_excluded += 1
                    continue
                work_date=entry.get("work_date")
                date_key=work_date.date().isoformat() if hasattr(work_date,"date") else str(work_date)
                if date_key in seen_work_dates:
                    duplicate_time_count += 1
                    continue
                seen_work_dates.add(date_key); approved_hours += money(entry.get("hours"))
            if duplicate_time_count:
                issues.append(("VR-003","HIGH",f"{duplicate_time_count} duplicate approved time entry date(s) excluded"))
            unapproved_count=sum(1 for t in trows if t.get("status")!="APPROVED")
            if unapproved_count:
                issues.append(("VR-006","CRITICAL",f"{unapproved_count} unapproved time entry/entries excluded from payroll"))
            approved_time_total += approved_hours
            if approved_hours > Decimal(200): issues.append(("VR-004","HIGH",f"Approved hours {approved_hours} exceed 200-hour period maximum"))
            if not emp.get("bank_account_token"): issues.append(("VR-001","HIGH","Missing synthetic bank token"))
            if not emp.get("tax_identifier"): issues.append(("VR-002","HIGH","Missing synthetic tax identifier"))
            if emp.get("employment_status") != "ACTIVE": issues.append(("VR-010","HIGH",f"Employee status is {emp.get('employment_status')}"))
            # Deduplicate allowance source keys; only approved rows can contribute.
            seen_allow=set(); allowance_total=Decimal(0); allowance_ids=[]
            for row in allow_by.get(eid,[]):
                if row.get("status")!="APPROVED": continue
                key=(row.get("allowance_id"),row.get("correction_of_transaction_id") or row.get("allowance_id"))
                if key in seen_allow:
                    issues.append(("VR-005","MEDIUM",f"Duplicate allowance {row.get('allowance_id')} excluded")); continue
                seen_allow.add(key); allowance_total += money(row.get("amount")); allowance_ids.append(row.get("allowance_transaction_id"))
            # Deduplicate deductions by component + leave source. Unapproved rows are ignored.
            seen_deduct=set(); deduction_total=Decimal(0); deduction_ids=[]; has_unpaid_component=False
            for row in deduct_by.get(eid,[]):
                if row.get("status")!="APPROVED": continue
                did=row.get("deduction_id")
                source=row.get("source_leave_id") or did
                key=(did,source)
                if key in seen_deduct:
                    issues.append(("VR-007" if did=="DED-005" or row.get("source_leave_id") else "VR-008","HIGH",f"Duplicate deduction {did} excluded")); continue
                seen_deduct.add(key); deduction_total += money(row.get("amount")); deduction_ids.append(row.get("deduction_transaction_id"))
                if did=="DED-005": has_unpaid_component=True
            salary=money(emp.get("monthly_salary")) or fallback_salary(eid)
            hourly=salary/Decimal(160)
            regular_hours=min(approved_hours,Decimal(160)); overtime_hours=max(Decimal(0),approved_hours-Decimal(160))
            base_pay=regular_hours*hourly; overtime_pay=overtime_hours*hourly*Decimal("1.5")
            unpaid_days=sum((money(l.get("days")) for l in leaves_by.get(eid,[]) if l.get("leave_type")=="UNPAID"),Decimal(0))
            unpaid_leave_deduction=Decimal(0) if has_unpaid_component else salary/Decimal(days)*unpaid_days
            gross=rounded(base_pay+overtime_pay+allowance_total)
            deductions_amount=rounded(deduction_total+unpaid_leave_deduction)
            net=rounded(gross-deductions_amount)
            if net < 0: issues.append(("VR-009","HIGH",f"Calculated net pay {net} is negative"))
            # Held employees are retained as auditable calculation rows but excluded from payable totals.
            held=bool(issues)
            status="ON_HOLD" if held else "CALCULATED"
            if held: held_count+=1
            else:
                eligible_count+=1; totals["gross"]+=gross; totals["deductions"]+=deductions_amount; totals["net"]+=net
            calc_docs.append({"calculation_id":f"{run_id}-{eid}","run_id":run_id,"employee_id":eid,"pay_period_id":pay_period_id,"currency":period.get("currency","INR"),"monthly_salary":Decimal128(str(rounded(salary))),"approved_hours":float(approved_hours),"unapproved_time_excluded":unapproved_count,"regular_pay":Decimal128(str(rounded(base_pay))),"overtime_pay":Decimal128(str(rounded(overtime_pay))),"allowances":Decimal128(str(rounded(allowance_total))),"unpaid_leave_days":float(unpaid_days),"unpaid_leave_deduction":Decimal128(str(rounded(unpaid_leave_deduction))),"other_deductions":Decimal128(str(rounded(deduction_total))),"gross_pay":Decimal128(str(gross)),"total_deductions":Decimal128(str(deductions_amount)),"net_pay":Decimal128(str(net)),"status":status,"hold_reasons":[x[2] for x in issues],"source_time_entry_ids":[t.get("time_entry_id") for t in trows if t.get("status")=="APPROVED"],"source_allowance_ids":allowance_ids,"source_deduction_ids":deduction_ids,"created_at":now})
            for idx,(rule,severity,detail) in enumerate(issues,1):
                new_exceptions.append({"exception_id":f"{run_id}-{eid}-{rule}-{idx}","run_id":run_id,"rule_id":rule,"employee_id":eid,"pay_period_id":pay_period_id,"severity":severity,"title":detail,"details":detail,"status":"OPEN","created_at":now})
        # Store run and immutable rows; unique IDs prevent accidental duplicate inserts.
        db.payroll_calculations.create_index([("calculation_id",ASCENDING)],unique=True)
        if calc_docs: db.payroll_calculations.insert_many(calc_docs,ordered=False)
        if new_exceptions: db.exceptions.insert_many(new_exceptions,ordered=False)
        gross=rounded(totals["gross"]); ded=rounded(totals["deductions"]); net=rounded(totals["net"])
        difference=rounded(gross-ded-net)
        recon_status="PASS" if difference==0 else "FAIL"
        report={"reconciliation_id":f"REC-{run_id}","run_id":run_id,"pay_period_id":pay_period_id,"gross_total":Decimal128(str(gross)),"deductions_total":Decimal128(str(ded)),"net_total":Decimal128(str(net)),"difference":Decimal128(str(difference)),"status":recon_status,"employee_count":eligible_count,"held_employee_count":held_count,"created_at":now}
        db.payroll_reconciliations.insert_one(report)
        db.payroll_calculation_runs.insert_one({"run_id":run_id,"pay_period_id":pay_period_id,"status":"COMPLETED_WITH_HOLDS" if held_count else "COMPLETED","employee_count":len(employees),"eligible_count":eligible_count,"held_count":held_count,"gross_total":Decimal128(str(gross)),"deductions_total":Decimal128(str(ded)),"net_total":Decimal128(str(net)),"reconciliation_status":recon_status,"unapproved_time_excluded":unapproved_excluded,"approved_hours_total":float(approved_time_total),"created_at":now})
        db.audit_events.insert_one({"event_id":f"AUD-{run_id}","event_type":"PAYROLL_CALCULATED","entity_type":"payroll_calculation_run","entity_id":run_id,"actor_id":"LOCAL-PAYROLLGUARD-SYSTEM","created_at":now,"details":{"pay_period_id":pay_period_id,"eligible_count":eligible_count,"held_count":held_count}})
        return {"status":"success","message":"Payroll calculation completed. Held employees require exception review before payment/export.","run_id":run_id,"pay_period_id":pay_period_id,"employee_count":len(employees),"eligible_count":eligible_count,"held_count":held_count,"unapproved_time_excluded":unapproved_excluded,"gross_total":as_number(gross),"deductions_total":as_number(ded),"net_total":as_number(net),"reconciliation":{"status":recon_status,"difference":as_number(difference)}}
    except HTTPException: raise
    except Exception as exc: raise HTTPException(status_code=500,detail=f"Payroll calculation failed: {exc}")

@router.get("/periods")
def get_periods():
    try:
        ping_database(); db=get_database()
        return [{"pay_period_id":p["pay_period_id"],"start_date":p.get("start_date"),"end_date":p.get("end_date"),"pay_date":p.get("pay_date"),"status":p.get("status")} for p in db.pay_periods.find({}, {"_id":0}).sort("start_date",ASCENDING)]
    except Exception as exc: raise HTTPException(status_code=503,detail=f"MongoDB unavailable: {exc}")

@router.get("/runs")
def get_runs(limit: int=Query(20,ge=1,le=100)):
    try:
        ping_database(); db=get_database()
        return list(db.payroll_calculation_runs.find({}, {"_id":0}).sort("created_at",-1).limit(limit))
    except Exception as exc: raise HTTPException(status_code=503,detail=f"MongoDB unavailable: {exc}")

@router.get("/calculations/{run_id}")
def get_calculations(run_id: str, limit: int=Query(100,ge=1,le=5000)):
    try:
        ping_database(); db=get_database()
        rows=list(db.payroll_calculations.find({"run_id":run_id},{"_id":0}).sort("employee_id",ASCENDING).limit(limit))
        for row in rows:
            for key in ("monthly_salary","regular_pay","overtime_pay","allowances","unpaid_leave_deduction","other_deductions","gross_pay","total_deductions","net_pay"):
                if key in row: row[key]=float(money(row[key]))
        return rows
    except Exception as exc: raise HTTPException(status_code=503,detail=f"MongoDB unavailable: {exc}")

@router.get("/reconciliation/{run_id}")
def get_reconciliation(run_id: str):
    try:
        ping_database(); db=get_database(); row=db.payroll_reconciliations.find_one({"run_id":run_id},{"_id":0})
        if not row: raise HTTPException(status_code=404,detail="Reconciliation report not found")
        for key in ("gross_total","deductions_total","net_total","difference"):
            row[key]=float(money(row[key]))
        return row
    except HTTPException: raise
    except Exception as exc: raise HTTPException(status_code=503,detail=f"MongoDB unavailable: {exc}")
