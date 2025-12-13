from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel

class BaseTable(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(index=True, nullable=False, description="Strict multi-tenancy enforcement")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column_kwargs={"onupdate": datetime.utcnow})
