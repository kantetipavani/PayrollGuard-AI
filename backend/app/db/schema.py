from pymongo import ASCENDING, DESCENDING
from app.db.session import get_database

COLLECTIONS = [
    "employees", "pay_groups", "pay_periods", "time_entries", "leave_records",
    "allowance_components", "deduction_components", "employee_allowance_eligibility",
    "employee_deduction_eligibility", "allowance_transactions", "deduction_transactions",
    "payroll_inputs", "validation_rules", "exceptions", "approvals", "payroll_exports",
    "payroll_export_items", "audit_events", "payroll_calculation_runs",
    "payroll_calculations", "payroll_reconciliations",
]

RULES = [
    ("VR-001", "MISSING_BANK_DETAILS", "Employee is missing a synthetic bank token", "HIGH"),
    ("VR-002", "MISSING_TAX_IDENTIFIER", "Employee is missing a synthetic tax identifier", "HIGH"),
    ("VR-003", "DUPLICATE_TIME_ENTRY", "Duplicate time entry for employee and work date", "HIGH"),
    ("VR-004", "HOURS_EXCEED_PERIOD_MAX", "Approved hours exceed period maximum", "HIGH"),
    ("VR-005", "DUPLICATE_ALLOWANCE", "Duplicate allowance transaction", "MEDIUM"),
    ("VR-006", "UNAPPROVED_TIME_INCLUDED", "Unapproved time must not be included in payroll", "CRITICAL"),
    ("VR-007", "DUPLICATE_LEAVE_DEDUCTION", "Duplicate leave deduction", "HIGH"),
    ("VR-008", "RECONCILIATION_FAILURE", "Payroll input does not reconcile", "CRITICAL"),
    ("VR-009", "NEGATIVE_NET_PAY", "Net pay is below zero", "HIGH"),
    ("VR-010", "INVALID_EMPLOYEE_STATUS", "Inactive or terminated employee included", "HIGH"),
]

def ensure_database_schema() -> None:
    db = get_database()
    existing = set(db.list_collection_names())
    for name in COLLECTIONS:
        if name not in existing:
            db.create_collection(name)
    db.employees.create_index([("employee_id", ASCENDING)], unique=True)
    db.payroll_calculation_runs.create_index([("run_id", ASCENDING)], unique=True)
    db.payroll_reconciliations.create_index([("reconciliation_id", ASCENDING)], unique=True)
    db.pay_groups.create_index([("pay_group_id", ASCENDING)], unique=True)
    db.pay_periods.create_index([("pay_period_id", ASCENDING)], unique=True)
    db.pay_periods.create_index([("pay_group_id", ASCENDING), ("start_date", ASCENDING)], unique=True)
    for collection, key in [("time_entries", "time_entry_id"), ("leave_records", "leave_id"), ("allowance_transactions", "allowance_transaction_id"), ("deduction_transactions", "deduction_transaction_id")]:
        db[collection].create_index([(key, ASCENDING)], unique=True)
    db.time_entries.create_index([("employee_id", ASCENDING), ("pay_period_id", ASCENDING), ("work_date", ASCENDING)])
    db.allowance_transactions.create_index([("employee_id", ASCENDING), ("pay_period_id", ASCENDING), ("allowance_id", ASCENDING)])
    db.deduction_transactions.create_index([("employee_id", ASCENDING), ("pay_period_id", ASCENDING), ("deduction_id", ASCENDING)])
    db.exceptions.create_index([("status", ASCENDING), ("severity", DESCENDING)])
    for rid, code, description, severity in RULES:
        db.validation_rules.update_one({"rule_id": rid}, {"$setOnInsert": {"rule_id": rid, "code": code, "description": description, "severity": severity, "enabled": True}}, upsert=True)
