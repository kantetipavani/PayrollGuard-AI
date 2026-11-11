from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db.session import ping_database
from app.db.schema import ensure_database_schema

if __name__ == "__main__":
    ping_database(); ensure_database_schema()
    print("PayrollGuard collections, indexes, and validation rules are ready.")
