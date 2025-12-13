import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Reliability Engine"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./reliability.db")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

settings = Settings()
