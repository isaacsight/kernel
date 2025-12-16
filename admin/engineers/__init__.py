"""
Studio OS AI Engineering Team

Original Team (9 agents):
- Alchemist, Architect, Editor, Operator, Librarian, Visionary, Guardian, Broadcaster, NetworkEngineer

New Team (8 agents):
- Analyst, Curator, Socialite, Researcher, Scheduler, Translator, Designer, Narrator

Design Team (2 agents):
- WebDesigner, DesignEngineer

Leadership:
- Creative Director
"""

# Original Team
from .alchemist import Alchemist
from .architect import Architect
from .editor import Editor
from .strategist import Strategist
from .librarian import Librarian
from .visionary import Visionary
from .guardian import Guardian
from .broadcaster import Broadcaster
from .network_engineer import NetworkEngineer

# New Team
from .analyst import Analyst
from .curator import Curator
from .socialite import Socialite
from .researcher import Researcher
from .scheduler import Scheduler
from .translator import Translator
from .designer import Designer
from .narrator import Narrator

# Design Team
from .web_designer import WebDesigner
from .design_engineer import DesignEngineer

# Leadership
from .creative_director import CreativeDirector

# Frontier Team
from .frontier_researcher import FrontierResearcher
from .infrastructure_engineer import InfrastructureEngineer
from .principal_engineer import PrincipalEngineer
from .quant_researcher import QuantResearcher
from .robotics_engineer import RoboticsEngineer
from .security_architect import SecurityArchitect
from .engineering_manager import EngineeringManager
from .reality_engineer import RealityEngineer
from .kernel_engineer import KernelEngineer
from .product_engineer import ProductEngineer
from .system_monitor import Systemmonitor

from .bio_engineer import BioEngineer
from .quantum_engineer import QuantumEngineer
from .ml_engineer import MLEngineer
from .motion_designer import MotionDesigner
from .video_editor import VideoEditor
from .graphic_designer import GraphicDesigner
from .vector_designer import VectorDesigner
from .prompt_engineer import PromptEngineer

# Remote Resource
from .remote_worker import RemoteWorker

__all__ = [
    # Original Team
    'Alchemist',
    'Architect',
    'Editor',
    'Strategist',
    'Librarian',
    'Visionary',
    'Guardian',
    'Broadcaster',
    'NetworkEngineer',
    # New Team
    'Analyst',
    'Curator',
    'Socialite',
    'Researcher',
    'Scheduler',
    'Translator',
    'Designer',
    'Narrator',
    # Design Team
    'WebDesigner',
    'DesignEngineer',
    # Leadership
    'CreativeDirector',

    # Frontier Team
    'FrontierResearcher',
    'InfrastructureEngineer',
    'PrincipalEngineer',
    'QuantResearcher',
    'RoboticsEngineer',
    'SecurityArchitect',
    'EngineeringManager',
    'RealityEngineer',
    'KernelEngineer',
    'ProductEngineer',
    'Systemmonitor',
    'BioEngineer',
    'QuantumEngineer',
    'MLEngineer',
    'MotionDesigner',
    'VideoEditor',
    'GraphicDesigner',
    'VectorDesigner',
    'PromptEngineer',
    
    # Remote
    'RemoteWorker'
]