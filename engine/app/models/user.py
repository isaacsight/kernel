from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, SQLModel
from .base import BaseTable

class UserRole(str, Enum):
    ADMIN = "admin"
    CLIENT = "client"

class User(BaseTable, table=True):
    __tablename__ = "users"

    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: UserRole = Field(default=UserRole.CLIENT)
    
    # Client users are bound to a tenant. Admin users *can* be bound or null (global).
    # Since BaseTable requires tenant_id, for global admins we might use a specific "system" tenant_id 
    # OR we allow tenant_id to be nullable for Users specifically if we override it, 
    # but BaseTable enforces it. 
    # DECISION: For simplicity in the 'Scale' architecture, even Admins belong to the "System" tenant.
    # Or we override BaseTable?
    # Let's keep it consistent: Everyone has a tenant. Admins have the "System" tenant.
    
    is_active: bool = Field(default=True)
