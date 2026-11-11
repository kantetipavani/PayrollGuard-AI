# Phase 3 – Payroll Calculation & Reconciliation

## Run
1. Start MongoDB and the PayrollGuard API.
2. Generate Phase 2 data first (seed `20261022`).
3. In PayrollGuard AI, choose a pay period and select **Calculate & reconcile payroll**.

## Endpoints
- `GET /api/v1/payrollguard/periods` – available pay periods
- `POST /api/v1/payrollguard/calculate?pay_period_id=PP-2026-01` – create an immutable calculation run
- `GET /api/v1/payrollguard/runs` – recent runs
- `GET /api/v1/payrollguard/calculations/{run_id}` – calculation rows (maximum 5,000)
- `GET /api/v1/payrollguard/reconciliation/{run_id}` – reconciliation totals

## Calculation assumptions (assessment/demo only)
- Synthetic monthly salary is INR 30,000–52,500, generated deterministically from employee sequence. Older records without `monthly_salary` use the same deterministic fallback.
- Approved hours up to 160 are paid at monthly salary / 160. Approved hours above 160 are paid at 1.5x. More than 200 approved hours is held under VR-004.
- Only `APPROVED` time, allowances, deductions and leave records are used. Non-approved time is counted as excluded, not paid.
- Duplicate allowance and deduction source keys are counted once and produce exceptions.
- Approved unpaid leave is deducted at monthly salary / calendar days, unless an approved DED-005 transaction already provides that deduction.
- Missing bank token, missing tax identifier, non-ACTIVE employee status and negative net pay place an employee on hold. Held rows are retained for audit but excluded from payable totals.
- Reconciliation verifies `gross_total - deductions_total - net_total = 0`.

## Persistence and audit
Each run writes `payroll_calculation_runs`, immutable `payroll_calculations`, `payroll_reconciliations`, exceptions and an `audit_events` entry. Re-running creates a new run; it does not overwrite earlier calculation records. Phase 2 ground truth remains a separate file and is never read by this calculation service.

This is a deterministic synthetic assessment implementation, not a jurisdiction-certified payroll engine. Tax, statutory deductions, salary structures, rounding policies and overtime rules must be configured and reviewed for a real employer before production use.
