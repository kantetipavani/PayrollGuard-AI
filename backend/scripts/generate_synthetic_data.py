"""Generate deterministic, wholly synthetic PayrollGuard test data.
Run from repository root: python backend/scripts/generate_synthetic_data.py --reset --seed 20261022
"""
from __future__ import annotations
import argparse, csv, hashlib, json, random, sys
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Iterable
from bson.decimal128 import Decimal128
from pymongo.errors import BulkWriteError

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db.session import get_database, ping_database
from app.db.schema import ensure_database_schema

NOW = datetime(2026, 10, 22, tzinfo=timezone.utc)

def bson_date(value: date) -> datetime:
    """Convert date-only values to BSON-compatible UTC midnight datetimes."""
    return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
PERIODS = [("PP-2026-01", date(2026,1,1), date(2026,1,31), date(2026,2,5)), ("PP-2026-02", date(2026,2,1), date(2026,2,28), date(2026,3,5)), ("PP-2026-03", date(2026,3,1), date(2026,3,31), date(2026,4,5))]
ALLOWANCES = [(f"ALW-{i:03}", c, n, t, a) for i,(c,n,t,a) in enumerate([("MEAL","Meal Allowance","FIXED",1500),("TRAVEL","Travel Allowance","FIXED",2000),("SHIFT","Shift Allowance","FIXED",1000),("INTERNET","Internet Allowance","FIXED",800),("OVERTIME","Overtime Allowance","PER_HOUR",120),("PERFORMANCE","Performance Allowance","FIXED",2500)],1)]
DEDUCTIONS = [(f"DED-{i:03}", c, n, t, a) for i,(c,n,t,a) in enumerate([("PF","Provident Fund","PERCENTAGE",12),("ESI","Employee State Insurance","PERCENTAGE",0.75),("TAX","Professional Tax","FIXED",200),("LOAN","Loan Recovery","FIXED",500),("LEAVE","Unpaid Leave","FIXED",750)],1)]

def chunks(items: list, size: int=2000):
    for i in range(0,len(items),size): yield items[i:i+size]

def write_csv(path: Path, rows: list[dict]):
    path.parent.mkdir(parents=True,exist_ok=True)
    if not rows: path.write_text("",encoding="utf-8"); return
    fields=list(dict.fromkeys(k for row in rows for k in row.keys()))
    with path.open("w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
        for row in rows:
            w.writerow({k: (v.isoformat() if isinstance(v,(date,datetime)) else str(v.to_decimal()) if isinstance(v,Decimal128) else str(v) if isinstance(v,Decimal) else v) for k,v in row.items()})

def insert_many(db, name, rows):
    for batch in chunks(rows):
        if batch: db[name].insert_many(batch, ordered=False)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--reset",action="store_true"); parser.add_argument("--seed",type=int,default=20261022); args=parser.parse_args()
    rng=random.Random(args.seed); ping_database(); ensure_database_schema(); db=get_database()
    generated=["employees","pay_groups","pay_periods","time_entries","leave_records","allowance_components","deduction_components","employee_allowance_eligibility","employee_deduction_eligibility","allowance_transactions","deduction_transactions","payroll_inputs","exceptions","approvals","payroll_exports","payroll_export_items","audit_events","payroll_calculation_runs","payroll_calculations","payroll_reconciliations"]
    if args.reset:
        for name in generated: db[name].delete_many({})
    # Shared payroll group and three closed/open periods.
    db.pay_groups.insert_one({"pay_group_id":"PG-MONTHLY","name":"Monthly Payroll","currency":"INR","frequency":"MONTHLY","created_at":NOW})
    db.pay_periods.insert_many([{"pay_period_id":pid,"pay_group_id":"PG-MONTHLY","start_date":bson_date(s),"end_date":bson_date(e),"pay_date":bson_date(p),"status":"OPEN" if i==2 else "CLOSED","created_at":NOW} for i,(pid,s,e,p) in enumerate(PERIODS)])
    employees=[]
    for i in range(1,3001):
        status="INACTIVE" if i in (2999,3000) else "ACTIVE"
        employees.append({"employee_id":f"EMP-{i:06}","first_name":f"Employee{i:04}","last_name":"Synthetic","email":f"employee{i:04}@example.test","employment_status":status,"pay_group_id":"PG-MONTHLY","department":["Engineering","Finance","Operations","HR"][i%4],"monthly_salary":30000+(i%10)*2500,"bank_account_token":None if i==101 else f"SYNTH-BANK-{i:06}","tax_identifier":None if i==102 else f"SYNTH-TAX-{i:06}","created_at":NOW,"updated_at":NOW})
    insert_many(db,"employees",employees)
    for collection, defs in [("allowance_components",ALLOWANCES),("deduction_components",DEDUCTIONS)]:
        docs=[]
        for cid,code,name,typ,amount in defs:
            key="allowance_id" if collection.startswith("allowance") else "deduction_id"
            docs.append({key:cid,"code":code,"name":name,"calculation_type":typ,"default_amount":Decimal128(str(amount)),"effective_from":bson_date(date(2026,1,1)),"effective_to":None,"created_at":NOW})
        db[collection].insert_many(docs)
    allow_elig=[]; deduct_elig=[]
    for i in range(1,3001):
        emp=f"EMP-{i:06}"
        allow_elig.extend([{"employee_id":emp,"allowance_id":a[0],"eligible":True,"effective_from":bson_date(date(2026,1,1))} for a in ALLOWANCES])
        deduct_elig.extend([{"employee_id":emp,"deduction_id":d[0],"eligible":True,"effective_from":bson_date(date(2026,1,1))} for d in DEDUCTIONS])
    insert_many(db,"employee_allowance_eligibility",allow_elig); insert_many(db,"employee_deduction_eligibility",deduct_elig)
    times=[]; leaves=[]; allowances=[]; deductions=[]
    for i in range(1,3001):
        emp=f"EMP-{i:06}"
        for pi,(pid,start,end,_) in enumerate(PERIODS):
            # Ten dated work entries per employee/month (90,000 total).
            for j in range(10):
                work_date=start+timedelta(days=2*j+1)
                hours=Decimal("22.5") if (i==1 and pi==0) else Decimal(str(rng.choice([7.5,8,8,8,8.5])))
                status="SUBMITTED" if (i==3 and pi==0 and j==0) else "APPROVED"
                times.append({"time_entry_id":f"TIME-{i:06}-{pi+1}-{j+1:02}","employee_id":emp,"pay_period_id":pid,"work_date":bson_date(work_date),"hours":float(hours),"status":status,"approved_by":None if status!="APPROVED" else "SYNTH-MANAGER-001","approved_at":None if status!="APPROVED" else NOW,"correction_of_time_entry_id":None,"created_at":NOW})
            if i%3==0 and i<=3000:
                leave_id=f"LEAVE-{i:06}-{pi+1}"
                leaves.append({"leave_id":leave_id,"employee_id":emp,"pay_period_id":pid,"leave_type":"UNPAID" if i%10==0 else "CASUAL","start_date":bson_date(start+timedelta(days=24)),"end_date":bson_date(start+timedelta(days=24)),"days":1.0,"status":"APPROVED","approved_by":"SYNTH-MANAGER-001","approved_at":NOW,"correction_of_leave_id":None,"created_at":NOW})
            # Distributed transactions, deterministic total 5k each.
            if len(allowances)<4998:
                a=ALLOWANCES[(i+pi)%len(ALLOWANCES)]
                allowances.append({"allowance_transaction_id":f"ALWT-{len(allowances)+1:06}","employee_id":emp,"allowance_id":a[0],"pay_period_id":pid,"amount":Decimal128(str(a[4])),"status":"APPROVED","correction_of_transaction_id":None,"created_at":NOW})
            if len(deductions)<4998:
                d=DEDUCTIONS[(i+pi)%len(DEDUCTIONS)]
                deductions.append({"deduction_transaction_id":f"DEDT-{len(deductions)+1:06}","employee_id":emp,"deduction_id":d[0],"pay_period_id":pid,"amount":Decimal128(str(d[4])),"status":"APPROVED","correction_of_transaction_id":None,"source_leave_id":None,"created_at":NOW})
    # Add deliberately planted duplicate fixtures without duplicate primary keys.
    allowances += [{**allowances[3],"allowance_transaction_id":"ALWT-PLANTED-001"},{**allowances[3],"allowance_transaction_id":"ALWT-PLANTED-002"}]
    # Ensure the requested 5,000 allowance records exactly.
    allowances=allowances[:5000]
    deductions += [{**deductions[33],"deduction_transaction_id":"DEDT-PLANTED-001","source_leave_id":"LEAVE-000012-1"},{**deductions[33],"deduction_transaction_id":"DEDT-PLANTED-002","source_leave_id":"LEAVE-000012-1"}]
    deductions=deductions[:5000]
    # Exactly 3,000 leave records: create deterministic remaining records if sparse.
    while len(leaves)<3000:
        i=len(leaves)+1; emp=f"EMP-{i:06}"; pid=PERIODS[(i-1)%3][0]; start=PERIODS[(i-1)%3][1]
        leaves.append({"leave_id":f"LEAVE-{i:06}-{(i-1)%3+1}","employee_id":emp,"pay_period_id":pid,"leave_type":"UNPAID" if i%10==0 else "CASUAL","start_date":bson_date(start+timedelta(days=25)),"end_date":bson_date(start+timedelta(days=25)),"days":1.0,"status":"APPROVED","approved_by":"SYNTH-MANAGER-001","approved_at":NOW,"correction_of_leave_id":None,"created_at":NOW})
    leaves=leaves[:3000]
    # Preserve an immutable correction chain for a synthetic employee (EMP-000007).
    leaves=leaves[:-2]
    leaves.extend([
        {"leave_id":"LEAVE-000007-1","employee_id":"EMP-000007","pay_period_id":"PP-2026-01","leave_type":"CASUAL","start_date":bson_date(date(2026,1,26)),"end_date":bson_date(date(2026,1,26)),"days":1.0,"status":"APPROVED","approved_by":"SYNTH-MANAGER-001","approved_at":NOW,"correction_of_leave_id":None,"created_at":NOW},
        {"leave_id":"LEAVE-000007-2","employee_id":"EMP-000007","pay_period_id":"PP-2026-02","leave_type":"CASUAL","start_date":bson_date(date(2026,2,26)),"end_date":bson_date(date(2026,2,26)),"days":0.5,"status":"APPROVED","approved_by":"SYNTH-MANAGER-001","approved_at":NOW,"correction_of_leave_id":"LEAVE-000007-1","created_at":NOW},
    ])
    insert_many(db,"time_entries",times); insert_many(db,"leave_records",leaves); insert_many(db,"allowance_transactions",allowances); insert_many(db,"deduction_transactions",deductions)

    # Seed actionable exception and approval records so the dashboard is not
    # limited to raw source counts. Ground truth remains outside MongoDB.
    exception_fixtures = [
        ("EXC-GT-001", "VR-004", "EMP-000001", "PP-2026-01", "HIGH", "Approved hours exceed period maximum"),
        ("EXC-GT-002", "VR-005", "EMP-000002", "PP-2026-01", "MEDIUM", "Duplicate allowance transaction"),
        ("EXC-GT-003", "VR-006", "EMP-000003", "PP-2026-01", "CRITICAL", "Unapproved time entry must be excluded"),
        ("EXC-GT-004", "VR-007", "EMP-000012", "PP-2026-01", "HIGH", "Duplicate leave deduction"),
    ]
    exception_docs = [{
        "exception_id": eid, "rule_id": rid, "employee_id": emp,
        "pay_period_id": period, "severity": severity, "title": title,
        "status": "OPEN", "created_at": NOW,
        "details": "Deterministic synthetic validation fixture; review before payroll export.",
    } for eid, rid, emp, period, severity, title in exception_fixtures]
    db.exceptions.insert_many(exception_docs)
    approval_docs = [{
        "approval_id": f"APR-GT-{i:03}", "exception_id": fixture[0],
        "employee_id": fixture[2], "pay_period_id": fixture[3],
        "requested_by": "SYNTH-PAYROLL-ADMIN", "approver_id": "SYNTH-MANAGER-001",
        "status": "PENDING", "created_at": NOW,
    } for i, fixture in enumerate(exception_fixtures, start=1)]
    db.approvals.insert_many(approval_docs)
    db.audit_events.insert_many([{
        "event_id": f"AUD-GT-{i:03}", "event_type": "SYNTHETIC_EXCEPTION_CREATED",
        "entity_type": "exception", "entity_id": fixture[0],
        "actor_id": "SYSTEM-SEED", "created_at": NOW,
    } for i, fixture in enumerate(exception_fixtures, start=1)])

    # Test ground truth is separate from application collections.
    truth=[
      {"case_id":"GT-001","rule":"HOURS_EXCEED_PERIOD_MAX","employee_id":"EMP-000001","pay_period_id":"PP-2026-01","expected":"FLAG"},
      {"case_id":"GT-002","rule":"DUPLICATE_ALLOWANCE","employee_id":"EMP-000002","pay_period_id":"PP-2026-01","expected":"FLAG"},
      {"case_id":"GT-003","rule":"UNAPPROVED_TIME_INCLUDED","employee_id":"EMP-000003","pay_period_id":"PP-2026-01","expected":"EXCLUDE_AND_FLAG"},
      {"case_id":"GT-004","rule":"DUPLICATE_LEAVE_DEDUCTION","employee_id":"EMP-000012","pay_period_id":"PP-2026-01","expected":"FLAG"},
      {"case_id":"GT-005","rule":"RECONCILIATION_FAILURE","employee_id":"EMP-000005","pay_period_id":"PP-2026-01","expected":"FLAG_IN_PHASE_3"},
    ]
    pay_period_rows=[{"pay_period_id":pid,"pay_group_id":"PG-MONTHLY","start_date":start,"end_date":end,"pay_date":pay_date,"status":"OPEN" if index==2 else "CLOSED"} for index,(pid,start,end,pay_date) in enumerate(PERIODS)]
    write_csv(ROOT/"data/generated/pay_periods.csv",pay_period_rows)
    write_csv(ROOT/"data/generated/employees.csv",employees)
    write_csv(ROOT/"data/generated/time_entries.csv",times)
    write_csv(ROOT/"data/generated/leave_records.csv",leaves)
    write_csv(ROOT/"data/generated/allowance_transactions.csv",allowances)
    write_csv(ROOT/"data/generated/deduction_transactions.csv",deductions)
    write_csv(ROOT/"data/generated/exceptions.csv",exception_docs)
    write_csv(ROOT/"data/generated/approvals.csv",approval_docs)
    write_csv(ROOT/"data/ground_truth/ground_truth.csv",truth)
    counts={name:db[name].count_documents({}) for name in ["employees","pay_groups","pay_periods","time_entries","leave_records","allowance_transactions","deduction_transactions","exceptions","approvals","payroll_exports","validation_rules"]}
    summary={"seed":args.seed,"generated_at":NOW.isoformat(),"counts":counts,"expected":{"employees":3000,"pay_groups":1,"pay_periods":3,"time_entries":90000,"leave_records":3000,"allowance_transactions":5000,"deduction_transactions":5000,"exceptions":4,"approvals":4,"payroll_exports":0,"validation_rules":10}}
    if any(counts[k]!=v for k,v in summary["expected"].items()): raise RuntimeError(f"Record count mismatch: {summary}")
    files=[ROOT/"data/generated/pay_periods.csv",ROOT/"data/generated/employees.csv",ROOT/"data/generated/time_entries.csv",ROOT/"data/generated/leave_records.csv",ROOT/"data/generated/allowance_transactions.csv",ROOT/"data/generated/deduction_transactions.csv",ROOT/"data/generated/exceptions.csv",ROOT/"data/generated/approvals.csv",ROOT/"data/ground_truth/ground_truth.csv"]
    manifest={"seed":args.seed,"counts":counts,"sha256":{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
    (ROOT/"data/manifests").mkdir(parents=True,exist_ok=True)
    (ROOT/"data/manifests/phase2_manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    (ROOT/"data/manifests/phase2_validation_summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    print(json.dumps({"status":"PASS","message":"Synthetic dataset generated and database record counts verified.",**summary},indent=2))

if __name__=="__main__": main()
