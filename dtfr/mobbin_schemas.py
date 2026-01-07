from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class MobbinApp:
    id: str  # URL slug or internal ID
    name: str
    tagline: Optional[str] = None
    platform: str = "iOS"  # iOS, Android, Web
    categories: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    popularity_score: float = 0.0
    rating: Optional[float] = None
    url: str = ""
    logo_url: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MobbinScreen:
    id: str
    app_id: str
    title: str
    image_url: str
    local_path: Optional[str] = None
    flow_id: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    text_content: Optional[str] = None  # OCR or extracted text
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MobbinFlow:
    id: str
    app_id: str
    name: str
    description: Optional[str] = None
    screen_ids: List[str] = field(default_factory=list)
    url: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
