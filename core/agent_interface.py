from typing import Dict, Any, Optional
import abc

class BaseAgent(abc.ABC):
    """
    Abstract Base Class for all Studio Agents.
    """
    
    @property
    @abc.abstractmethod
    def name(self) -> str:
        """The display name of the agent."""
        pass

    @property
    @abc.abstractmethod
    def role(self) -> str:
        """The role description of the agent."""
        pass

    @abc.abstractmethod
    async def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Unified entry point for agent execution.
        
        Args:
            action: The specific action to perform (e.g., 'generate', 'audit').
            **params: Parameters for the action.
            
        Returns:
            Dict containing the result.
        """
        pass

    async def status(self) -> str:
        """Returns the current status of the agent."""
        return "Ready"
