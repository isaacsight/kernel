from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class Post(BaseModel):
    title: str
    date: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    content: str
    filename: Optional[str] = None

class AgentAction(BaseModel):
    agent_name: str
    action: str
    parameters: dict = {}
class VaultInput(BaseModel):
    key_name: str
    key_value: str
