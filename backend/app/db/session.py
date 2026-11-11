from pymongo import MongoClient
from pymongo.database import Database
from app.core.config import settings

client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000, appname="NaxpayrollPayrollGuard")
database: Database = client[settings.mongodb_database]

def get_database() -> Database:
    return database

def ping_database() -> None:
    client.admin.command("ping")
