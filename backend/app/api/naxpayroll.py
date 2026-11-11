"""
Naxpayroll API router connecting frontend services with MongoDB.
Provides endpoints for auth, employees, salary structures, payruns, organizations, documents, audit, and dashboards.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from app.db.session import get_database, ping_database

router = APIRouter(prefix="/api/v1", tags=["Naxpayroll Core API"])

# --- Helper functions ---

def clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Removes MongoDB _id and formats datetime fields to ISO strings."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

# --- Seed Initial Data if empty ---

DEFAULT_STRUCTURES = [
    {
        "id": "SS-001",
        "name": "Senior Engineer",
        "basic": 60000,
        "hra": 24000,
        "fixed_allowance": 12000,
        "special_allowance": 14000,
        "gross": 110000,
        "active": True,
    },
    {
        "id": "SS-002",
        "name": "Junior Engineer",
        "basic": 30000,
        "hra": 12000,
        "fixed_allowance": 6000,
        "special_allowance": 7000,
        "gross": 55000,
        "active": True,
    },
    {
        "id": "SS-003",
        "name": "Lead Engineer",
        "basic": 90000,
        "hra": 36000,
        "fixed_allowance": 18000,
        "special_allowance": 16000,
        "gross": 160000,
        "active": True,
    },
    {
        "id": "SS-004",
        "name": "QA Engineer",
        "basic": 35000,
        "hra": 14000,
        "fixed_allowance": 7000,
        "special_allowance": 9000,
        "gross": 65000,
        "active": True,
    },
    {
        "id": "SS-005",
        "name": "Product Designer",
        "basic": 50000,
        "hra": 20000,
        "fixed_allowance": 10000,
        "special_allowance": 10000,
        "gross": 90000,
        "active": True,
    },
]

DEFAULT_ORGS = [
    {
        "id": "ORG-001",
        "name": "Naxrita Solutions Pvt. Ltd.",
        "code": "GTS",
        "legal_name": "Naxrita Solutions Private Limited",
        "country": "India",
        "currency": "INR",
        "financial_year": "April-March",
        "status": "Active",
        "employees": 3000,
        "admin": "Meena Iyer",
        "admin_email": "meena.iyer@naxrita.com",
    },
    {
        "id": "ORG-002",
        "name": "NovaSoft Technologies",
        "code": "NST",
        "legal_name": "NovaSoft Technologies India Pvt. Ltd.",
        "country": "India",
        "currency": "INR",
        "financial_year": "April-March",
        "status": "Active",
        "employees": 150,
        "admin": "Arun Prasad",
        "admin_email": "arun.prasad@novasoft.com",
    },
]

DEFAULT_DOCUMENTS = [
    {
        "id": "DOC-001",
        "title": "Employee Handbook 2026",
        "category": "Policy",
        "assigned_to": "All Employees",
        "assigned_count": 3000,
        "owner": "Meena Iyer",
        "created_on": "2026-08-05",
        "status": "Published",
        "description": "Company policy, leave, conduct, and workplace guidelines.",
        "file_name": "employee_handbook_2026.pdf",
    },
    {
        "id": "DOC-002",
        "title": "PF Declaration Guide",
        "category": "Compliance",
        "assigned_to": "All Employees",
        "assigned_count": 3000,
        "owner": "Meena Iyer",
        "created_on": "2026-07-20",
        "status": "Published",
        "description": "Form 11 instructions, UAN linking, and PF transfer steps.",
        "file_name": "pf_declaration_guide.pdf",
    },
    {
        "id": "DOC-003",
        "title": "IT Declaration Form (Form 12BB)",
        "category": "Tax",
        "assigned_to": "All Employees",
        "assigned_count": 3000,
        "owner": "Kavita Nair",
        "created_on": "2026-06-15",
        "status": "Published",
        "description": "Template for investment proof submission under Section 80C, 80D, HRA.",
        "file_name": "form_12bb_template.pdf",
    },
]

DEMO_EMPLOYEES = [
    {
        "id": "EMP-001",
        "employee_id": "EMP-001",
        "name": "Priya Nair",
        "first_name": "Priya",
        "last_name": "Nair",
        "email": "priya.nair@globaltech.in",
        "department": "Engineering",
        "designation": "Senior Software Engineer",
        "doj": "2021-03-15",
        "emp_type": "Full-Time",
        "manager": "Rajesh Kumar",
        "location": "Bangalore",
        "mobile": "+91 98765 43210",
        "status": "Active",
        "employment_status": "ACTIVE",
        "portalStatus": "Enabled",
        "salary_structure": "Senior Engineer",
        "monthly_salary": 110000,
        "gross_salary": 110000,
        "bank_account_token": "SYNTH-BANK-000001",
        "tax_identifier": "SYNTH-TAX-000001",
    },
    {
        "id": "EMP-002",
        "employee_id": "EMP-002",
        "name": "Arjun Sharma",
        "first_name": "Arjun",
        "last_name": "Sharma",
        "email": "arjun.sharma@globaltech.in",
        "department": "Engineering",
        "designation": "Junior Software Engineer",
        "doj": "2023-06-01",
        "emp_type": "Full-Time",
        "manager": "Priya Nair",
        "location": "Bangalore",
        "status": "Active",
        "employment_status": "ACTIVE",
        "portalStatus": "Enabled",
        "salary_structure": "Junior Engineer",
        "monthly_salary": 55000,
        "gross_salary": 55000,
    },
    {
        "id": "EMP-003",
        "employee_id": "EMP-003",
        "name": "Meena Iyer",
        "first_name": "Meena",
        "last_name": "Iyer",
        "email": "meena.iyer@globaltech.in",
        "department": "HR",
        "designation": "HR Manager",
        "doj": "2020-01-10",
        "emp_type": "Full-Time",
        "manager": "Rajesh Kumar",
        "location": "Mumbai",
        "status": "Active",
        "employment_status": "ACTIVE",
        "portalStatus": "Enabled",
        "salary_structure": "Manager",
        "monthly_salary": 150000,
        "gross_salary": 150000,
    },
]

def ensure_initial_seed():
    db = get_database()
    if db.salary_structures.count_documents({}) == 0:
        db.salary_structures.insert_many(DEFAULT_STRUCTURES)
    if db.organizations.count_documents({}) == 0:
        db.organizations.insert_many(DEFAULT_ORGS)
    if db.documents.count_documents({}) == 0:
        db.documents.insert_many(DEFAULT_DOCUMENTS)
    for emp in DEMO_EMPLOYEES:
        db.employees.update_one(
            {"$or": [{"id": emp["id"]}, {"employee_id": emp["id"]}]},
            {"$setOnInsert": emp},
            upsert=True
        )

# --- Auth Endpoints ---

@router.post("/auth/login")
def login(payload: Dict[str, Any]):
    email = payload.get("email", "admin@naxpayroll.com")
    persona = payload.get("persona", "org_admin")
    return {
        "access_token": "mock-jwt-token-naxpayroll-live-session",
        "token_type": "bearer",
        "user": {
            "id": "USR-001",
            "name": "Meena Iyer" if persona == "org_admin" else "System Administrator",
            "email": email,
            "role": persona,
            "organization": "Naxrita Solutions Pvt. Ltd.",
        },
    }

@router.get("/auth/me")
def get_me():
    return {
        "id": "USR-001",
        "name": "Meena Iyer",
        "email": "meena.iyer@naxrita.com",
        "role": "org_admin",
        "organization": "Naxrita Solutions Pvt. Ltd.",
    }

@router.post("/auth/change-password")
def change_password(data: Dict[str, Any]):
    return {"status": "success", "message": "Password updated successfully"}

@router.post("/auth/reset-password")
def reset_password(data: Dict[str, Any]):
    return {"status": "success", "message": "Password reset instructions sent"}

@router.post("/auth/mfa-toggle")
def toggle_mfa(data: Dict[str, Any]):
    return {"status": "success", "mfa_enabled": data.get("enabled", True)}

# --- Dashboard Endpoints ---

@router.get("/dashboard/org-admin")
def org_admin_dashboard():
    db = get_database()
    emp_count = db.employees.count_documents({})
    open_exceptions = db.exceptions.count_documents({"status": {"$in": ["OPEN", "IN_REVIEW"]}})
    periods_count = db.pay_periods.count_documents({})
    return {
        "totalEmployees": emp_count,
        "activeEmployees": db.employees.count_documents({"employment_status": "ACTIVE"}),
        "openExceptions": open_exceptions,
        "payPeriods": periods_count,
        "lastPayrollRun": "Completed",
        "currency": "INR",
    }

@router.get("/dashboard/platform-admin")
def platform_admin_dashboard():
    db = get_database()
    return {
        "organizations": db.organizations.count_documents({}),
        "totalEmployees": db.employees.count_documents({}),
        "systemHealth": "Operational",
        "database": "Connected",
    }

@router.get("/dashboard/employee")
def employee_dashboard():
    return {
        "payslipsAvailable": 3,
        "leavesRemaining": 18,
        "taxDeclarationStatus": "Submitted",
    }

# --- Employee Endpoints ---

@router.get("/employees")
def list_employees(
    department: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(500, ge=1, le=5000),
    skip: int = Query(0, ge=0),
):
    db = get_database()
    query: Dict[str, Any] = {}
    if department and department != "All":
        query["department"] = department
    if status_filter and status_filter != "All":
        query["$or"] = [{"status": status_filter}, {"employment_status": status_filter.upper()}]
    if search:
        s = search.strip()
        query["$or"] = [
            {"name": {"$regex": s, "$options": "i"}},
            {"first_name": {"$regex": s, "$options": "i"}},
            {"last_name": {"$regex": s, "$options": "i"}},
            {"email": {"$regex": s, "$options": "i"}},
            {"employee_id": {"$regex": s, "$options": "i"}},
            {"id": {"$regex": s, "$options": "i"}},
        ]

    docs = list(db.employees.find(query).skip(skip).limit(limit))
    formatted = []
    for d in docs:
        c = clean_doc(d)
        # Harmonize id and name
        emp_id = c.get("id") or c.get("employee_id") or ""
        name = c.get("name")
        if not name:
            fn = c.get("first_name", "")
            ln = c.get("last_name", "")
            name = f"{fn} {ln}".strip() or emp_id
        gross = c.get("grossSalary") or c.get("gross_salary") or c.get("monthly_salary") or 0
        status = c.get("status")
        if not status:
            estatus = c.get("employment_status", "ACTIVE")
            status = "Active" if estatus == "ACTIVE" else estatus.capitalize()
        
        c["id"] = emp_id
        c["name"] = name
        c["grossSalary"] = gross
        c["status"] = status
        c["salaryStructure"] = c.get("salaryStructure") or c.get("salary_structure") or "Junior Engineer"
        c["designation"] = c.get("designation") or "Software Engineer"
        c["empType"] = c.get("empType") or c.get("emp_type") or "Full-Time"
        formatted.append(c)

    return formatted

@router.get("/employees/{emp_id}")
def get_employee(emp_id: str):
    db = get_database()
    doc = db.employees.find_one({"$or": [{"id": emp_id}, {"employee_id": emp_id}]})
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")
    c = clean_doc(doc)
    c["id"] = c.get("id") or c.get("employee_id") or emp_id
    if not c.get("name"):
        c["name"] = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip() or emp_id
    c["grossSalary"] = c.get("grossSalary") or c.get("gross_salary") or c.get("monthly_salary") or 0
    return c

@router.post("/employees")
def create_employee(payload: Dict[str, Any]):
    db = get_database()
    emp_id = payload.get("id") or payload.get("employee_id") or f"EMP-{datetime.now().strftime('%y%m%d%H%M%S')}"
    payload["id"] = emp_id
    payload["employee_id"] = emp_id
    payload["created_at"] = datetime.now(timezone.utc)
    payload["updated_at"] = datetime.now(timezone.utc)
    db.employees.insert_one(payload)
    return clean_doc(payload)

@router.put("/employees/{emp_id}")
def update_employee(emp_id: str, payload: Dict[str, Any]):
    db = get_database()
    payload["updated_at"] = datetime.now(timezone.utc)
    result = db.employees.update_one({"$or": [{"id": emp_id}, {"employee_id": emp_id}]}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    doc = db.employees.find_one({"$or": [{"id": emp_id}, {"employee_id": emp_id}]})
    return clean_doc(doc)

@router.delete("/employees/{emp_id}")
def delete_employee(emp_id: str):
    db = get_database()
    result = db.employees.delete_one({"$or": [{"id": emp_id}, {"employee_id": emp_id}]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"status": "success", "message": f"Employee {emp_id} deleted"}

# --- Salary Structures Endpoints ---

@router.get("/salary/structures")
def list_salary_structures():
    db = get_database()
    ensure_initial_seed()
    docs = list(db.salary_structures.find({}))
    return [clean_doc(d) for d in docs]

@router.post("/salary/structures")
def create_salary_structure(payload: Dict[str, Any]):
    db = get_database()
    struct_id = payload.get("id") or f"SS-{datetime.now().strftime('%M%S')}"
    payload["id"] = struct_id
    db.salary_structures.insert_one(payload)
    return clean_doc(payload)

@router.put("/salary/structures/{struct_id}")
def update_salary_structure(struct_id: str, payload: Dict[str, Any]):
    db = get_database()
    result = db.salary_structures.update_one({"id": struct_id}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    doc = db.salary_structures.find_one({"id": struct_id})
    return clean_doc(doc)

@router.delete("/salary/structures/{struct_id}")
def delete_salary_structure(struct_id: str):
    db = get_database()
    result = db.salary_structures.delete_one({"id": struct_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Salary structure not found")
    return {"status": "success", "message": f"Salary structure {struct_id} deleted"}

@router.get("/salary/components")
def list_salary_components():
    return [
        {"id": "COMP-01", "name": "Basic", "type": "Earning", "taxable": True},
        {"id": "COMP-02", "name": "HRA", "type": "Earning", "taxable": False},
        {"id": "COMP-03", "name": "Fixed Allowance", "type": "Earning", "taxable": True},
        {"id": "COMP-04", "name": "Special Allowance", "type": "Earning", "taxable": True},
        {"id": "COMP-05", "name": "Provident Fund (PF)", "type": "Deduction", "statutory": True},
        {"id": "COMP-06", "name": "Professional Tax (PT)", "type": "Deduction", "statutory": True},
    ]

@router.post("/salary/assign")
def assign_salary_structure(payload: Dict[str, Any]):
    db = get_database()
    emp_ids = payload.get("emp_ids", [])
    structure = payload.get("salary_structure", "")
    db.employees.update_many(
        {"$or": [{"id": {"$in": emp_ids}}, {"employee_id": {"$in": emp_ids}}]},
        {"$set": {"salary_structure": structure, "salaryStructure": structure}},
    )
    return {"status": "success", "assigned_count": len(emp_ids)}

# --- Payruns Endpoints ---

@router.get("/payruns")
def list_payruns():
    db = get_database()
    # Also check if runs exist in payroll_calculation_runs
    runs = list(db.payroll_calculation_runs.find({}, {"_id": 0}))
    stored_payruns = list(db.payruns.find({}, {"_id": 0}))
    
    # Merge calculation runs into payrun view
    merged = list(stored_payruns)
    for r in runs:
        if not any(p.get("id") == r.get("run_id") for p in merged):
            merged.append({
                "id": r.get("run_id"),
                "period": r.get("pay_period_id"),
                "month": int(r.get("pay_period_id", "PP-2026-01").split("-")[-1]) if "-" in r.get("pay_period_id", "") else 1,
                "year": 2026,
                "status": "Paid" if r.get("reconciliation_status") == "PASS" else "Draft",
                "scope": "All Employees",
                "totalEmployees": r.get("employee_count", 0),
                "grossPayroll": float(r.get("gross_total", 0)),
                "totalDeductions": float(r.get("deductions_total", 0)),
                "netPayroll": float(r.get("net_total", 0)),
                "generatedBy": "PayrollGuard Engine",
                "generatedOn": str(r.get("created_at", datetime.now().date())),
                "payrunType": "Regular",
                "rows": [],
            })
    return merged

@router.post("/payruns")
def create_payrun(payload: Dict[str, Any]):
    db = get_database()
    run_id = payload.get("id") or f"PR-{datetime.now().strftime('%Y-%m')}"
    payload["id"] = run_id
    payload["created_at"] = datetime.now(timezone.utc)
    db.payruns.insert_one(payload)
    return clean_doc(payload)

@router.get("/payruns/{run_id}")
def get_payrun(run_id: str):
    db = get_database()
    doc = db.payruns.find_one({"id": run_id})
    if doc:
        return clean_doc(doc)
    calc_run = db.payroll_calculation_runs.find_one({"run_id": run_id}, {"_id": 0})
    if calc_run:
        return {
            "id": run_id,
            "period": calc_run.get("pay_period_id"),
            "status": "Paid",
            "totalEmployees": calc_run.get("employee_count", 0),
            "grossPayroll": float(calc_run.get("gross_total", 0)),
            "totalDeductions": float(calc_run.get("deductions_total", 0)),
            "netPayroll": float(calc_run.get("net_total", 0)),
            "rows": [],
        }
    raise HTTPException(status_code=404, detail="Payrun not found")

@router.put("/payruns/{run_id}")
def update_payrun(run_id: str, payload: Dict[str, Any]):
    db = get_database()
    db.payruns.update_one({"id": run_id}, {"$set": payload}, upsert=True)
    doc = db.payruns.find_one({"id": run_id})
    return clean_doc(doc)

@router.delete("/payruns/{run_id}")
def delete_payrun(run_id: str):
    db = get_database()
    db.payruns.delete_one({"id": run_id})
    return {"status": "success", "message": f"Payrun {run_id} deleted"}

# --- Organizations Endpoints ---

@router.get("/organizations")
def list_organizations():
    db = get_database()
    ensure_initial_seed()
    docs = list(db.organizations.find({}))
    return [clean_doc(d) for d in docs]

@router.post("/organizations")
def create_organization(payload: Dict[str, Any]):
    db = get_database()
    org_id = payload.get("id") or f"ORG-{datetime.now().strftime('%M%S')}"
    payload["id"] = org_id
    db.organizations.insert_one(payload)
    return clean_doc(payload)

@router.put("/organizations/{org_id}")
def update_organization(org_id: str, payload: Dict[str, Any]):
    db = get_database()
    result = db.organizations.update_one({"id": org_id}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    doc = db.organizations.find_one({"id": org_id})
    return clean_doc(doc)

@router.delete("/organizations/{org_id}")
def delete_organization(org_id: str):
    db = get_database()
    result = db.organizations.delete_one({"id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"status": "success", "message": f"Organization {org_id} deleted"}

# --- Documents Endpoints ---

@router.get("/documents")
@router.get("/documents/my-documents")
def list_documents():
    db = get_database()
    ensure_initial_seed()
    docs = list(db.documents.find({}))
    return [clean_doc(d) for d in docs]

@router.post("/documents")
def create_document(payload: Dict[str, Any]):
    db = get_database()
    doc_id = payload.get("id") or f"DOC-{datetime.now().strftime('%M%S')}"
    payload["id"] = doc_id
    payload["created_on"] = datetime.now().strftime("%Y-%m-%d")
    db.documents.insert_one(payload)
    return clean_doc(payload)

@router.put("/documents/{doc_id}")
def update_document(doc_id: str, payload: Dict[str, Any]):
    db = get_database()
    result = db.documents.update_one({"id": doc_id}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = db.documents.find_one({"id": doc_id})
    return clean_doc(doc)

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    db = get_database()
    result = db.documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "success", "message": f"Document {doc_id} deleted"}

# --- Audit Logs Endpoints ---

@router.get("/audit/logs")
def list_audit_logs():
    db = get_database()
    docs = list(db.audit_events.find({}).sort("created_at", -1).limit(100))
    logs = []
    for d in docs:
        c = clean_doc(d)
        logs.append({
            "id": c.get("event_id") or c.get("audit_event_id") or "AUD-001",
            "user": c.get("actor") or c.get("actor_id") or "System",
            "org": "Naxrita Solutions",
            "action": c.get("event_type", "System Activity"),
            "module": c.get("entity_type", "General"),
            "oldValue": c.get("previous_status", "-"),
            "newValue": c.get("new_status", "-"),
            "timestamp": str(c.get("created_at", "")),
        })
    return logs

@router.get("/audit/error-logs")
def list_error_logs():
    return []

# --- Access and Roles Endpoints ---

@router.get("/access/users")
def list_access_users():
    return [
        {"id": "USR-001", "name": "Meena Iyer", "email": "meena.iyer@naxrita.com", "role": "Organization Admin", "status": "Active", "mfa": True},
        {"id": "USR-002", "name": "Rajesh Kumar", "email": "rajesh.k@naxrita.com", "role": "Payroll Specialist", "status": "Active", "mfa": True},
        {"id": "USR-003", "name": "Kavita Nair", "email": "kavita.n@naxrita.com", "role": "HR Manager", "status": "Active", "mfa": False},
    ]

@router.get("/roles")
def list_roles():
    return [
        {"id": "ROLE-01", "name": "Organization Admin", "description": "Full access to organization configuration, payroll and user accounts"},
        {"id": "ROLE-02", "name": "Payroll Specialist", "description": "Manage payruns, calculate salaries, approve exceptions and export payouts"},
        {"id": "ROLE-03", "name": "HR Manager", "description": "Manage employee directories, onboarding, documents and leave approvals"},
    ]
