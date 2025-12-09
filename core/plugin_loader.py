import os
import importlib.util
import sys
import logging
from typing import Dict, Type
from .agent_interface import BaseAgent

logger = logging.getLogger("PluginLoader")

class PluginRegistry:
    def __init__(self):
        self._agents: Dict[str, BaseAgent] = {}
        self._loaded = False

    def discover_plugins(self, directories: list[str]):
        """
        Scans directories for python files potentially containing BaseAgent implementations.
        """
        for directory in directories:
            if not os.path.isdir(directory):
                continue
                
            sys.path.append(directory)
            
            for filename in os.listdir(directory):
                if filename.endswith(".py") and not filename.startswith("__"):
                    module_name = filename[:-3]
                    filepath = os.path.join(directory, filename)
                    self._load_module(module_name, filepath)

    def _load_module(self, module_name: str, filepath: str):
        try:
            spec = importlib.util.spec_from_file_location(module_name, filepath)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = module
                spec.loader.exec_module(module)
                
                # Scan for BaseAgent subclasses
                for attribute_name in dir(module):
                    attribute = getattr(module, attribute_name)
                    if (isinstance(attribute, type) and 
                        issubclass(attribute, BaseAgent) and 
                        attribute is not BaseAgent):
                        
                        try:
                            # Instantiate and register
                            agent = attribute()
                            self.register_agent(agent)
                            logger.info(f"Loaded plugin agent: {agent.name}")
                        except Exception as e:
                            logger.error(f"Failed to instantiate {attribute_name}: {e}")
                            
        except Exception as e:
            logger.error(f"Failed to load module {module_name}: {e}")

    def register_agent(self, agent: BaseAgent):
        self._agents[agent.name] = agent

    def get_agent(self, name: str) -> BaseAgent:
        return self._agents.get(name)

    def list_agents(self) -> Dict[str, str]:
        return {name: agent.role for name, agent in self._agents.items()}

# Global Registry
registry = PluginRegistry()
