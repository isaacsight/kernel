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
from .operator import Operator
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

__all__ = [
    # Original Team
    'Alchemist',
    'Architect',
    'Editor',
    'Operator',
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
    'CreativeDirector'
]