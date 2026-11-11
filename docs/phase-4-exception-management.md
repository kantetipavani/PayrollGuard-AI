# Phase 4 – Validation exceptions and review workflow

## Included

- Exception inbox with status and severity filters, scoped to the selected pay period.
- Exception details include rule, employee, pay period, severity, source run and creation time.
- `OPEN → IN_REVIEW → RESOLVED` workflow, with a `REOPEN` action for follow-up.
- Resolution notes and reviewer identity are stored on the exception record.
- Every status change creates an immutable `audit_events` record containing the actor, previous/new status, note, entity and timestamp.
- Summary endpoint provides counts by status and open severity.

## API

- `GET /api/v1/payrollguard/exceptions?status=OPEN&severity=HIGH&pay_period_id=PP-2026-01&limit=100&skip=0`
- `PATCH /api/v1/payrollguard/exceptions/{exception_id}` with JSON such as `{"action":"IN_REVIEW","note":"Investigating source entry","reviewed_by":"Payroll Admin"}`.
- Supported actions: `IN_REVIEW`, `RESOLVE`, `REOPEN`.
- `GET /api/v1/payrollguard/exception-summary?pay_period_id=PP-2026-01`

## Controls and limitations

- Exception generation is driven by the deterministic Phase 3 validation findings. Phase 4 does not read `data/ground_truth/ground_truth.csv` or any ground-truth fixture.
- Resolving an exception records a human review decision; it does not rewrite source payroll inputs or calculation history.
- Reopening preserves the previous audit event and moves the current exception status back to `OPEN`.
- This is a local synthetic assessment workflow, not a statutory payroll approval system. Authentication/role-based reviewer identity must be added before production use.

## Run

Start MongoDB and the FastAPI backend as documented in the project README, then open PayrollGuard AI. Calculate a pay period to generate validation exceptions, select status/severity filters, and use the review actions in the Phase 4 panel.
