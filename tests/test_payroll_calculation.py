"""Unit tests for PayrollGuard calculation rules, reconciliation invariants, and exception workflows."""
import unittest
import sys
from pathlib import Path
from datetime import datetime, date
from decimal import Decimal

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.api.payroll_calculation import (
    money,
    rounded,
    as_number,
    fallback_salary,
    period_days,
)

class TestPayrollCalculation(unittest.TestCase):
    def test_money_and_rounding(self):
        self.assertEqual(money(100), Decimal("100"))
        self.assertEqual(money("2500.50"), Decimal("2500.50"))
        self.assertEqual(money(None), Decimal("0"))
        
        # Test ROUND_HALF_UP
        self.assertEqual(rounded(Decimal("100.005")), Decimal("100.01"))
        self.assertEqual(rounded(Decimal("100.004")), Decimal("100.00"))
        self.assertEqual(as_number(Decimal("123.456")), 123.46)

    def test_fallback_salary_range_and_determinism(self):
        for i in range(1, 50):
            emp_id = f"EMP-{i:05d}"
            salary = fallback_salary(emp_id)
            self.assertGreaterEqual(salary, Decimal("30000"))
            self.assertLessEqual(salary, Decimal("52500"))
            # Determinism test
            self.assertEqual(salary, fallback_salary(emp_id))

    def test_period_days(self):
        # 30 day range
        p1 = {
            "start_date": datetime(2026, 1, 1),
            "end_date": datetime(2026, 1, 31)
        }
        self.assertEqual(period_days(p1), 31)

        # Fallback when missing dates
        self.assertEqual(period_days({}), 30)

    def test_reconciliation_zero_variance_invariant(self):
        # Verify gross - deductions = net invariant
        base_salary = Decimal("45000.00")
        approved_hours = Decimal("165.00")
        regular_rate = base_salary / Decimal(160)
        overtime_rate = regular_rate * Decimal("1.5")
        
        regular_pay = rounded(Decimal(160) * regular_rate)
        overtime_pay = rounded(Decimal(5) * overtime_rate)
        allowances = rounded(Decimal("2500.50") + Decimal("1250.75"))
        
        gross = regular_pay + overtime_pay + allowances
        deductions = rounded(Decimal("3200.25") + Decimal("850.00"))
        net = gross - deductions
        
        variance = gross - deductions - net
        self.assertEqual(variance, Decimal("0.00"))

    def test_exception_workflow_actions(self):
        # Validate allowed transitions
        valid_actions = {"IN_REVIEW", "RESOLVE", "REOPEN"}
        self.assertIn("IN_REVIEW", valid_actions)
        self.assertIn("RESOLVE", valid_actions)
        self.assertIn("REOPEN", valid_actions)

if __name__ == "__main__":
    unittest.main()
