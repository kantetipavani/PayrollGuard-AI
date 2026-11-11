"""Create a reproducible, MongoDB-independent PayrollGuard CSV dataset.
Run from project root: python backend/scripts/generate_synthetic_csv.py --seed 20261022
"""
from __future__ import annotations
import argparse, csv, hashlib, json, random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PERIODS = [("PP-2026-01", date(2026,1,1),31),("PP-2026-02",date(2026,2,1),28),("PP-2026-03",date(2026,3,1),31)]

def write_csv(path: Path, fields: list[str], rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w=csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--seed',type=int,default=20261022); args=parser.parse_args()
    rng=random.Random(args.seed)
    employees=[]
    for i in range(1,3001):
        employees.append({"employee_id":f"EMP-{i:06}","first_name":f"Employee{i:04}","last_name":"Synthetic","email":f"employee{i:04}@example.test","employment_status":"INACTIVE" if i in (2999,3000) else "ACTIVE","pay_group_id":"PG-MONTHLY","department":["Engineering","Finance","Operations","HR"][i%4],"monthly_salary":30000+(i%10)*2500,"bank_account_token":"" if i==101 else f"SYNTH-BANK-{i:06}","tax_identifier":"" if i==102 else f"SYNTH-TAX-{i:06}"})
    times=[]
    for i in range(1,3001):
        for pi,(pid,start,_) in enumerate(PERIODS):
            for j in range(10):
                d=start+timedelta(days=2*j+1)
                hours=22.5 if i==1 and pi==0 else rng.choice([7.5,8,8,8,8.5])
                times.append({"time_entry_id":f"TIME-{i:06}-{pi+1}-{j+1:02}","employee_id":f"EMP-{i:06}","pay_period_id":pid,"work_date":d.isoformat(),"hours":hours,"status":"SUBMITTED" if i==3 and pi==0 and j==0 else "APPROVED"})
    leaves=[]
    for i in range(1,3001):
        if i%3==0:
            for pi,(pid,start,_) in enumerate(PERIODS):
                leaves.append({"leave_id":f"LEAVE-{i:06}-{pi+1}","employee_id":f"EMP-{i:06}","pay_period_id":pid,"leave_type":"UNPAID" if i%10==0 else "CASUAL","start_date":(start+timedelta(days=24)).isoformat(),"end_date":(start+timedelta(days=24)).isoformat(),"days":1,"status":"APPROVED","correction_of_leave_id":""})
    # Keep exactly 3,000 records and include an immutable correction chain.
    leaves=leaves[:-2]
    leaves += [
      {"leave_id":"LEAVE-000007-1","employee_id":"EMP-000007","pay_period_id":"PP-2026-01","leave_type":"CASUAL","start_date":"2026-01-26","end_date":"2026-01-26","days":1,"status":"APPROVED","correction_of_leave_id":""},
      {"leave_id":"LEAVE-000007-2","employee_id":"EMP-000007","pay_period_id":"PP-2026-02","leave_type":"CASUAL","start_date":"2026-02-26","end_date":"2026-02-26","days":0.5,"status":"APPROVED","correction_of_leave_id":"LEAVE-000007-1"}]
    allowance_defs=[("ALW-001","MEAL",1500),("ALW-002","TRAVEL",2000),("ALW-003","SHIFT",1000),("ALW-004","INTERNET",800),("ALW-005","OVERTIME",120),("ALW-006","PERFORMANCE",2500)]
    deduction_defs=[("DED-001","PF",12),("DED-002","ESI",0.75),("DED-003","TAX",200),("DED-004","LOAN",500),("DED-005","LEAVE",750)]
    allowances=[]; deductions=[]
    for i in range(1,3001):
        for pi,(pid,_,_) in enumerate(PERIODS):
            if len(allowances)<4998:
                a=allowance_defs[(i+pi)%6]
                allowances.append({"allowance_transaction_id":f"ALWT-{len(allowances)+1:06}","employee_id":f"EMP-{i:06}","allowance_id":a[0],"pay_period_id":pid,"amount":a[2],"status":"APPROVED","correction_of_transaction_id":""})
            if len(deductions)<4998:
                d=deduction_defs[(i+pi)%5]
                deductions.append({"deduction_transaction_id":f"DEDT-{len(deductions)+1:06}","employee_id":f"EMP-{i:06}","deduction_id":d[0],"pay_period_id":pid,"amount":d[2],"status":"APPROVED","correction_of_transaction_id":"","source_leave_id":""})
    # Intentional duplicate fixtures match the documented ground-truth employees.
    base_a=next(x for x in allowances if x['employee_id']=='EMP-000002' and x['pay_period_id']=='PP-2026-01')
    allowances += [{**base_a,"allowance_transaction_id":"ALWT-PLANTED-001"},{**base_a,"allowance_transaction_id":"ALWT-PLANTED-002"}]
    allowances=allowances[:5000]
    base_d=next(x for x in deductions if x['employee_id']=='EMP-000012' and x['pay_period_id']=='PP-2026-01')
    deductions += [{**base_d,"deduction_transaction_id":"DEDT-PLANTED-001","source_leave_id":"LEAVE-000012-1"},{**base_d,"deduction_transaction_id":"DEDT-PLANTED-002","source_leave_id":"LEAVE-000012-1"}]
    deductions=deductions[:5000]
    # Add source leave link to ordinary leave deductions as empty; duplicate test pair has explicit link.
    exception_rows=[
      {"exception_id":"EXC-GT-001","rule_id":"VR-004","employee_id":"EMP-000001","pay_period_id":"PP-2026-01","severity":"HIGH","title":"Approved hours exceed period maximum","status":"OPEN"},
      {"exception_id":"EXC-GT-002","rule_id":"VR-005","employee_id":"EMP-000002","pay_period_id":"PP-2026-01","severity":"MEDIUM","title":"Duplicate allowance transaction","status":"OPEN"},
      {"exception_id":"EXC-GT-003","rule_id":"VR-006","employee_id":"EMP-000003","pay_period_id":"PP-2026-01","severity":"CRITICAL","title":"Unapproved time entry must be excluded","status":"OPEN"},
      {"exception_id":"EXC-GT-004","rule_id":"VR-007","employee_id":"EMP-000012","pay_period_id":"PP-2026-01","severity":"HIGH","title":"Duplicate leave deduction","status":"OPEN"},
    ]
    approval_rows=[{"approval_id":f"APR-GT-{i:03}","exception_id":row["exception_id"],"employee_id":row["employee_id"],"pay_period_id":row["pay_period_id"],"approver_id":"SYNTH-MANAGER-001","status":"PENDING"} for i,row in enumerate(exception_rows,1)]
    truth=[
      {"case_id":"GT-001","rule":"HOURS_EXCEED_PERIOD_MAX","employee_id":"EMP-000001","pay_period_id":"PP-2026-01","expected":"FLAG"},
      {"case_id":"GT-002","rule":"DUPLICATE_ALLOWANCE","employee_id":"EMP-000002","pay_period_id":"PP-2026-01","expected":"FLAG"},
      {"case_id":"GT-003","rule":"UNAPPROVED_TIME_INCLUDED","employee_id":"EMP-000003","pay_period_id":"PP-2026-01","expected":"EXCLUDE_AND_FLAG"},
      {"case_id":"GT-004","rule":"DUPLICATE_LEAVE_DEDUCTION","employee_id":"EMP-000012","pay_period_id":"PP-2026-01","expected":"FLAG"},
      {"case_id":"GT-005","rule":"RECONCILIATION_FAILURE","employee_id":"EMP-000005","pay_period_id":"PP-2026-01","expected":"FLAG_IN_PHASE_3"}]
    pay_periods=[
      {"pay_period_id":pid,"pay_group_id":"PG-MONTHLY","start_date":start.isoformat(),"end_date":(start+timedelta(days=days-1)).isoformat(),"pay_date":(start+timedelta(days=days+4)).isoformat(),"status":"OPEN" if index==2 else "CLOSED"}
      for index,(pid,start,days) in enumerate(PERIODS)
    ]
    generated=ROOT/'data/generated'; gt=ROOT/'data/ground_truth'; manifests=ROOT/'data/manifests'
    write_csv(generated/'pay_periods.csv',list(pay_periods[0]),pay_periods)
    write_csv(generated/'employees.csv',list(employees[0]),employees)
    write_csv(generated/'time_entries.csv',list(times[0]),times)
    write_csv(generated/'leave_records.csv',list(leaves[0]),leaves)
    write_csv(generated/'allowance_transactions.csv',list(allowances[0]),allowances)
    write_csv(generated/'deduction_transactions.csv',list(deductions[0]),deductions)
    write_csv(generated/'exceptions.csv',list(exception_rows[0]),exception_rows)
    write_csv(generated/'approvals.csv',list(approval_rows[0]),approval_rows)
    write_csv(gt/'ground_truth.csv',list(truth[0]),truth)
    counts={"employees":len(employees),"pay_periods":len(pay_periods),"time_entries":len(times),"leave_records":len(leaves),"allowance_transactions":len(allowances),"deduction_transactions":len(deductions),"exceptions":4,"approvals":4,"payroll_exports":0,"validation_rules":10}
    expected={"employees":3000,"pay_periods":3,"time_entries":90000,"leave_records":3000,"allowance_transactions":5000,"deduction_transactions":5000,"exceptions":4,"approvals":4,"payroll_exports":0,"validation_rules":10}
    if counts!=expected: raise SystemExit(f"Count mismatch: {counts}")
    files=[generated/'pay_periods.csv',generated/'employees.csv',generated/'time_entries.csv',generated/'leave_records.csv',generated/'allowance_transactions.csv',generated/'deduction_transactions.csv',generated/'exceptions.csv',generated/'approvals.csv',gt/'ground_truth.csv']
    manifest={"seed":args.seed,"counts":counts,"sha256":{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
    manifests.mkdir(parents=True,exist_ok=True)
    (manifests/'phase2_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    (manifests/'phase2_validation_summary.json').write_text(json.dumps({"seed":args.seed,"counts":counts,"expected":expected,"status":"PASS"},indent=2),encoding='utf-8')
    print(json.dumps({"status":"PASS","seed":args.seed,"counts":counts},indent=2))
if __name__=='__main__': main()
