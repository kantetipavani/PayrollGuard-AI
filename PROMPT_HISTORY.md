# LLM Transparency & Prompt History

In compliance with assessment and submission requirements, this document outlines the prompt evolution, how AI tools were utilized, areas where AI accelerated development versus areas requiring heavy human oversight, and the specific review and validation steps performed.

---

## 1. Executive Summary of AI Usage

| Aspect | Details |
|---|---|
| **AI Assistants Used** | Antigravity / Gemini 3.8 Flash, Claude 3.7 Sonnet |
| **Primary Acceleration** | React 19 UI component layout, Tailwind CSS styling, FastAPI boilerplate, Pydantic model definitions, synthetic CSV generation scripts |
| **Heavy Human Reliance** | Reconciliation math invariants (`gross - deductions = net`), precision rounding via `Decimal`, MongoDB date/datetime BSON compatibility, exception lifecycle state machine (`OPEN -> IN_REVIEW -> RESOLVED -> REOPEN`), ground truth data isolation |
| **Human Validation** | Automated unit tests (`node:test`, `unittest`), compile-time checks, Vite production build, offline CSV validation against SHA-256 manifests |

---

## 2. Chronological Prompt History & Task Progression

### Prompt Stage 1: Problem Definition & Architecture Isolation
> **User / Engineer Prompt:**
> *"We need an intelligent payroll audit and pre-flight validation subsystem for Naxpayroll called PayrollGuard AI. It must validate pre-payroll inputs (time entries, leave records, allowances, deductions, employee status) across 3,000 employees before payroll execution. The subsystem must be strictly isolated: its own FastAPI backend on port 8001, dedicated MongoDB database `naxpayroll_guard`, and an immutable calculation/reconciliation engine. It must not touch or mutate existing Naxpayroll core tables or read synthetic ground truth during calculations."*

- **Where AI accelerated work:**
  - Generating initial project structure, FastAPI application scaffolding, CORS settings, and MongoDB client connection pooling.
- **Where Human Review & Intervention was required:**
  - Enforcing strict data isolation boundaries: ensuring `ground_truth.csv` is segregated under `data/ground_truth/` and never queried by the operational validation rules.
  - Designing the database schema to ensure audit events and calculation runs are append-only / immutable.

---

### Prompt Stage 2: Deterministic Synthetic Data Generation
> **User / Engineer Prompt:**
> *"Create a synthetic data generator producing realistic, reproducible payroll data with a fixed seed `20261022`. Expected counts: 3,000 employees, 3 pay periods, 90,000 time entries, 3,000 leave records, 5,000 allowance transactions, 5,000 deduction transactions, and 10 specific validation rules (VR-001 through VR-010). Also support generating offline CSVs without requiring a live MongoDB server."*

- **Where AI accelerated work:**
  - Writing the procedural data generation loops, synthetic employee name lists, department assignments, and CSV generation scripts (`generate_synthetic_csv.py` and `generate_synthetic_data.py`).
- **Where Human Review & Intervention was required:**
  - **Date storage compatibility fix:** PyMongo cannot encode Python `datetime.date` objects directly into BSON; BSON requires UTC `datetime.datetime`. Human review caught this during MongoDB population and converted all dates to UTC-midnight `datetime`.
  - Deterministic exception injection: Ensuring edge cases (duplicate time entries, overtime exceeding 200 hours, missing synthetic tax/bank tokens, unapproved transactions) were injected deterministically rather than randomly, enabling reproducible assertions against ground truth manifests.

---

### Prompt Stage 3: Payroll Calculation & Zero-Variance Reconciliation Engine
> **User / Engineer Prompt:**
> *"Implement Phase 3 payroll calculation: approved hours up to 160 paid at monthly salary / 160; overtime above 160 paid at 1.5x. Approved unpaid leave deducted based on calendar days. Handle holds for missing bank/tax tokens and non-active employees. Enforce reconciliation formula: `gross_total - deductions_total - net_total = 0` with zero variance using exact decimal arithmetic."*

- **Where AI accelerated work:**
  - Writing FastAPI route handlers for `/api/v1/payrollguard/calculate`, `/runs`, `/calculations/{run_id}`, and `/reconciliation/{run_id}`.
- **Where Human Review & Intervention was required:**
  - Floating-point errors in JavaScript/Python would cause `0.1 + 0.2 != 0.3`. Human review mandated Python `Decimal` with `ROUND_HALF_UP` and cent precision (`Decimal('0.01')`) for all financial totals, and storing values as BSON `Decimal128` in MongoDB to prevent rounding leakage.
  - Ensuring held records (e.g., missing bank account or tax ID) are kept for audit but strictly excluded from payable totals.

---

### Prompt Stage 4: Phase 4 Exception Inbox & Auditable Review Workflow
> **User / Engineer Prompt:**
> *"Build an exception inbox with status and severity filters. Support an auditable status workflow: `OPEN -> IN_REVIEW -> RESOLVED`, with a `REOPEN` action. Every status change must record an immutable audit event with reviewer identity, timestamp, previous status, and notes."*

- **Where AI accelerated work:**
  - Frontend React components for exception filtering, status badges, modal dialogs for entering review notes, and Tailwind CSS layout.
- **Where Human Review & Intervention was required:**
  - Ensuring status updates do not overwrite past audit logs. Every change appends to `audit_events`.
  - Safeguard against mutating source payroll records: resolving an exception signifies an administrative review decision without altering the historical raw timesheets or inputs.

---

### Prompt Stage 5: Verification, Packaging & GitHub Repository
> **User / Engineer Prompt:**
> *"Submit working, executable code with clear steps so another person can install, run, and verify key behavior. Push to public repository kantetipavani/PayrollGuard-AI. Transparently document LLM usage and make architectural reasoning visible."*

- **Where AI accelerated work:**
  - Generating comprehensive documentation templates, updating `package.json` test scripts, and creating unit test suites.
- **Where Human Review & Intervention was required:**
  - Validating cross-platform execution (PowerShell scripts, batch files, standard CLI commands).
  - Executing real test runs (`npm test`, `npm run build`, `python -m compileall`, `generate_synthetic_csv.py`) and verifying zero failures.

---

## 3. Human Review & Validation Checklist

Before submitting and pushing code, the following items were verified by a human developer:

1. **Deterministic Execution:** Ran `generate_synthetic_csv.py --seed 20261022` and verified identical SHA-256 manifests across multiple runs.
2. **Offline Resilience:** Confirmed that the frontend and data generator can function offline or in headless CI without crashing when MongoDB is temporarily disconnected.
3. **Financial Invariant Verification:** Verified that `gross_total - deductions_total - net_total` consistently equals exactly `0.00` with zero variance across all synthetic pay runs.
4. **Security & Secrets Review:** Verified that `.env` and sensitive local files are excluded in `.gitignore`; only `.env.example` is committed.
5. **Test Automation:** Added automated unit tests covering both the TypeScript access-permission matrix (`tests/access-permissions.test.mjs`) and Python calculation rules (`tests/test_payroll_calculation.py`).
