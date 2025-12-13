from fastapi import APIRouter
from app.api.v1.endpoints import workflows, login, stripe

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
api_router.include_router(stripe.router, prefix="/stripe", tags=["stripe"])
