# PayrollGuard synthetic dataset

Generated with seed `20261022`. All employee names, email addresses, bank tokens and tax identifiers are synthetic.

- `generated/`: pay periods, 3,000 employees, 90,000 time entries, 3,000 leave records, 5,000 allowance transactions, 5,000 deduction transactions, 4 exception fixtures and 4 approval fixtures.
- `ground_truth/`: expected validation outcomes for tests only. Never import this folder into the application database or use it in production validation.
- `manifests/`: deterministic record counts and SHA-256 hashes.

To regenerate CSVs without MongoDB: `python backend/scripts/generate_synthetic_csv.py --seed 20261022`. To populate the local MongoDB database, run `python backend/scripts/init_db.py` followed by `python backend/scripts/generate_synthetic_data.py --reset --seed 20261022` from the repository root with `PYTHONPATH=backend`.
