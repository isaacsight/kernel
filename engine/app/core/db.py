from sqlmodel import SQLModel, create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from .config import settings

# Async Engine (for API)
engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)

async def get_session() -> AsyncSession:
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session

# Sync Engine (for Alembic/Workers if needed)
# Ensure to replace +asyncpg with standard driver if using sync
# sync_engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
