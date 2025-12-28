from dataclasses import dataclass, field, asdict
from typing import List, Optional, Union, Dict, Any
import json

@dataclass
class Element:
    """
    The atomic unit of content (Video, Image, Text, Audio).
    """
    type: str  # 'video', 'image', 'text', 'audio'
    src: Optional[str] = None
    content: Optional[str] = None
    start: float = 0.0
    duration: float = -1.0  # -1 means auto/full length of content
    position: Union[str, Dict[str, Any]] = "center"  # "center" or {'x': 10, 'y': 10}
    width: Optional[Union[int, str]] = None # e.g. 1080 or "50%"
    height: Optional[Union[int, str]] = None
    opacity: float = 1.0
    volume: float = 1.0
    z_index: int = 0
    
    # Styles and effects
    filters: List[str] = field(default_factory=list)  # e.g. ['grayscale', 'contrast(1.2)']
    animation: Optional[str] = None  # 'zoom_in', 'slide_left', 'fade_in'
    style: Dict[str, Any] = field(default_factory=dict) # CSS-like styles for text: { 'font': 'Arial', 'color': 'white' }

    def to_dict(self):
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        return cls(**data)


@dataclass
class Scene:
    """
    A distinct segment of time. Scenes play sequentially.
    """
    elements: List[Element] = field(default_factory=list)
    duration: float = -1.0  # -1 means duration of longest element
    background_color: str = "#000000"
    transition_next: Optional[str] = None  # 'fade', 'wipe', 'crossfade'
    comment: Optional[str] = None

    def add_element(self, element: Element):
        self.elements.append(element)
        # Sort by z_index
        self.elements.sort(key=lambda x: x.z_index)

    def to_dict(self):
        return {
            "duration": self.duration,
            "background_color": self.background_color,
            "transition_next": self.transition_next,
            "elements": [e.to_dict() for e in self.elements]
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        elements_data = data.pop("elements", [])
        elements = [Element.from_dict(e) for e in elements_data]
        return cls(elements=elements, **data)


@dataclass
class Movie:
    """
    The root object containing global settings and the ordered list of scenes.
    """
    width: int = 1080
    height: int = 1920
    fps: int = 30
    background_color: str = "#000000"
    scenes: List[Scene] = field(default_factory=list)
    
    def add_scene(self, scene: Scene):
        self.scenes.append(scene)

    def to_json(self, indent=2):
        data = {
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "background_color": self.background_color,
            "scenes": [s.to_dict() for s in self.scenes]
        }
        return json.dumps(data, indent=indent)

    @classmethod
    def from_json(cls, json_str: str):
        data = json.loads(json_str)
        return cls.from_dict(data)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        scenes_data = data.pop("scenes", [])
        scenes = [Scene.from_dict(s) for s in scenes_data]
        return cls(scenes=scenes, **data)

    def save_json(self, filepath: str):
        with open(filepath, 'w') as f:
            f.write(self.to_json())
