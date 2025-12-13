from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.v1.api import api_router
from app.models import *  # noqa: F401, F403

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: could connect db here if needed
    print("Reliability Engine Starting...")
    yield
    # Shutdown
    print("Reliability Engine Shutting Down...")

from app.api.v1.api import api_router

app = FastAPI(
    title="Reliability Engine",
    description="Guaranteed outcomes engine.",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def health_check():
    return {"status": "ok", "service": "Reliability Engine"}
