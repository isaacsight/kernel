from typing import Optional
from uuid import UUID
from enum import Enum
from sqlmodel import Field, SQLModel
from datetime import datetime
from .base import BaseTable

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    INCOMPLETE = "incomplete"
    TRIALING = "trialing"

class Subscription(BaseTable, table=True):
    __tablename__ = "subscriptions"
    
    stripe_subscription_id: str = Field(index=True, unique=True)
    stripe_customer_id: str = Field(index=True)
    status: SubscriptionStatus = Field(default=SubscriptionStatus.INCOMPLETE)
    current_period_end: Optional[datetime] = None

class LedgerType(str, Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    ADJUSTMENT = "adjustment"

class Ledger(BaseTable, table=True):
    __tablename__ = "ledger"
    
    amount: int = Field(description="Credit amount in cents/units. Can be negative.")
    entry_type: LedgerType
    description: str
    reference_id: Optional[str] = Field(description="Stripe Charge ID or Workflow Run ID")
