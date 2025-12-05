"""
Command Router - Natural Language to Agent Routing

Inspired by GitHub Spark's natural language interface.
This module parses user commands and routes them to the appropriate agent(s).
"""

import re
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger("CommandRouter")


class CommandRouter:
    """
    Routes natural language commands to the appropriate agent(s).
    
    Inspired by GitHub Spark's natural language interface.
    Enables users to control Studio OS through conversational commands.
    """
    
    def __init__(self):
        self.name = "Command Router"
        
        # Intent patterns - keywords that map to agents and actions
        self.intent_patterns = {
            "generate": {
                "patterns": [
                    r"write\s+(a\s+)?(post|article|blog|essay)\s+(about|on)\s+(.+)",
                    r"create\s+(a\s+)?(post|article|blog|essay)\s+(about|on)\s+(.+)",
                    r"generate\s+(a\s+)?(post|article|blog|essay)\s+(about|on)\s+(.+)",
                    r"draft\s+(a\s+)?(post|article|blog|essay)\s+(about|on)\s+(.+)",
                ],
                "agents": ["Alchemist", "Guardian", "Editor"],
                "action": "generate_post"
            },
            "analyze": {
                "patterns": [
                    r"analyze\s+(.+)",
                    r"review\s+(the\s+)?code\s+(in\s+)?(.+)",
                    r"what('s|\s+is)\s+wrong\s+with\s+(.+)",
                    r"check\s+(.+)"
                ],
                "agents": ["Architect", "Guardian"],
                "action": "analyze"
            },
            "publish": {
                "patterns": [
                    r"publish(\s+the\s+site)?",
                    r"deploy(\s+the\s+site)?",
                    r"push\s+(to\s+)?live",
                    r"go\s+live"
                ],
                "agents": ["Operator"],
                "action": "publish"
            },
            "status": {
                "patterns": [
                    r"(what('s|\s+is)\s+the\s+)?status",
                    r"how('s|\s+is)\s+(the\s+)?system(\s+doing)?",
                    r"health\s+check",
                    r"show\s+me\s+what('s|\s+is)\s+happening"
                ],
                "agents": ["Operator"],
                "action": "status"
            },
            "research": {
                "patterns": [
                    r"research\s+(.+)",
                    r"find\s+(out\s+)?(about\s+)?(.+)",
                    r"what('s|\s+is)\s+trending\s+(in\s+)?(.+)?",
                    r"look\s+up\s+(.+)"
                ],
                "agents": ["Researcher", "Analyst"],
                "action": "research"
            },
            "design": {
                "patterns": [
                    r"redesign\s+(.+)",
                    r"make\s+(.+)\s+(look\s+)?(better|prettier|nicer|modern)",
                    r"update\s+(the\s+)?design\s+(of\s+)?(.+)",
                    r"create\s+(a\s+)?thumbnail\s+(for\s+)?(.+)"
                ],
                "agents": ["Designer", "Architect"],
                "action": "design"
            },
            "evolve": {
                "patterns": [
                    r"evolve",
                    r"self[- ]improve",
                    r"upgrade\s+(the\s+)?system",
                    r"run\s+(an?\s+)?evolution(\s+cycle)?"
                ],
                "agents": ["Operator", "Visionary", "Architect", "Guardian"],
                "action": "evolve"
            },
            "schedule": {
                "patterns": [
                    r"schedule\s+(.+)",
                    r"post\s+(.+)\s+at\s+(.+)",
                    r"queue\s+(.+)",
                    r"plan\s+(the\s+)?content(\s+calendar)?"
                ],
                "agents": ["Scheduler", "Operator"],
                "action": "schedule"
            },
            "translate": {
                "patterns": [
                    r"translate\s+(.+)\s+to\s+(.+)",
                    r"(make|create)\s+(a\s+)?(.+)\s+version"
                ],
                "agents": ["Translator"],
                "action": "translate"
            },
            "help": {
                "patterns": [
                    r"help",
                    r"what\s+can\s+you\s+do",
                    r"list\s+commands",
                    r"show\s+me\s+what('s|\s+is)\s+possible"
                ],
                "agents": [],
                "action": "help"
            }
        }
        
        # Agent registry with capabilities
        self.agents = {
            "Alchemist": {
                "capabilities": ["content generation", "RAG", "memory"],
                "description": "Generates blog posts with context awareness"
            },
            "Guardian": {
                "capabilities": ["safety", "audit", "validation"],
                "description": "Ensures content safety and quality"
            },
            "Editor": {
                "capabilities": ["style", "grammar", "tone"],
                "description": "Refines and improves content"
            },
            "Architect": {
                "capabilities": ["code", "infrastructure", "blueprints"],
                "description": "Manages system architecture and code"
            },
            "Operator": {
                "capabilities": ["deployment", "health", "automation"],
                "description": "Runs autonomous operations"
            },
            "Visionary": {
                "capabilities": ["goals", "strategy", "vision"],
                "description": "Sets direction and proposes missions"
            },
            "Designer": {
                "capabilities": ["visuals", "thumbnails", "branding"],
                "description": "Creates visual assets"
            },
            "Researcher": {
                "capabilities": ["research", "trends", "analysis"],
                "description": "Discovers insights and trends"
            },
            "Analyst": {
                "capabilities": ["data", "metrics", "patterns"],
                "description": "Analyzes performance data"
            },
            "Scheduler": {
                "capabilities": ["scheduling", "calendar", "planning"],
                "description": "Manages content calendar"
            },
            "Translator": {
                "capabilities": ["translation", "localization"],
                "description": "Translates content to other languages"
            },
            "Librarian": {
                "capabilities": ["knowledge", "graph", "connections"],
                "description": "Maintains the knowledge graph"
            }
        }
        
        logger.info(f"[{self.name}] Initialized with {len(self.intent_patterns)} intent patterns")
    
    def route(self, user_input: str) -> Dict[str, Any]:
        """
        Analyzes user input and returns:
        - intent: The detected intent
        - target_agents: List of agents to involve
        - action: The action to perform
        - parameters: Extracted parameters from the input
        - execution_plan: Steps to accomplish the task
        """
        user_input = user_input.strip().lower()
        
        # Try to match against known patterns
        for intent_name, intent_data in self.intent_patterns.items():
            for pattern in intent_data["patterns"]:
                match = re.search(pattern, user_input, re.IGNORECASE)
                if match:
                    # Extract parameters from regex groups
                    params = self._extract_parameters(match, intent_name)
                    
                    return {
                        "success": True,
                        "intent": intent_name,
                        "target_agents": intent_data["agents"],
                        "action": intent_data["action"],
                        "parameters": params,
                        "execution_plan": self._build_plan(intent_name, intent_data["agents"], params),
                        "original_input": user_input,
                        "routed_at": datetime.now().isoformat()
                    }
        
        # No match found - try fuzzy matching or return unknown
        return self._handle_unknown(user_input)
    
    def _extract_parameters(self, match: re.Match, intent: str) -> Dict[str, str]:
        """Extract parameters from regex match based on intent."""
        params = {}
        groups = match.groups()
        
        if intent == "generate" and groups:
            # The topic is usually the last captured group
            params["topic"] = groups[-1].strip() if groups[-1] else ""
            
        elif intent == "translate" and len(groups) >= 2:
            params["content"] = groups[0].strip() if groups[0] else ""
            params["target_language"] = groups[-1].strip() if groups[-1] else ""
            
        elif intent == "research" and groups:
            # Find the first non-None group that looks like a topic
            for g in groups:
                if g and len(g) > 2:
                    params["query"] = g.strip()
                    break
                    
        elif intent == "design" and groups:
            for g in groups:
                if g and len(g) > 2:
                    params["target"] = g.strip()
                    break
        
        return params
    
    def _build_plan(self, intent: str, agents: List[str], params: Dict) -> List[Dict]:
        """Build an execution plan based on intent and agents."""
        plan = []
        
        if intent == "generate":
            plan = [
                {"step": 1, "agent": "Alchemist", "action": "generate", "params": params},
                {"step": 2, "agent": "Guardian", "action": "audit", "depends_on": 1},
                {"step": 3, "agent": "Editor", "action": "refine", "depends_on": 2}
            ]
        elif intent == "publish":
            plan = [
                {"step": 1, "agent": "Guardian", "action": "pre_deploy_check"},
                {"step": 2, "agent": "Operator", "action": "deploy", "depends_on": 1}
            ]
        elif intent == "evolve":
            plan = [
                {"step": 1, "agent": "Visionary", "action": "dream"},
                {"step": 2, "agent": "Architect", "action": "create_blueprint", "depends_on": 1},
                {"step": 3, "agent": "Guardian", "action": "verify_blueprint", "depends_on": 2},
                {"step": 4, "agent": "Architect", "action": "implement", "depends_on": 3},
                {"step": 5, "agent": "Guardian", "action": "validate_system", "depends_on": 4}
            ]
        elif intent == "research":
            plan = [
                {"step": 1, "agent": "Researcher", "action": "search", "params": params},
                {"step": 2, "agent": "Analyst", "action": "synthesize", "depends_on": 1}
            ]
        elif intent == "status":
            plan = [
                {"step": 1, "agent": "Operator", "action": "get_status"}
            ]
        elif intent == "design":
            plan = [
                {"step": 1, "agent": "Designer", "action": "create_design", "params": params},
                {"step": 2, "agent": "Architect", "action": "implement_design", "depends_on": 1}
            ]
        else:
            # Single step for simple intents
            for agent in agents:
                plan.append({"step": len(plan) + 1, "agent": agent, "action": intent, "params": params})
        
        return plan
    
    def _handle_unknown(self, user_input: str) -> Dict[str, Any]:
        """Handle commands that don't match known patterns."""
        # Could integrate AI for fuzzy matching here
        return {
            "success": False,
            "intent": "unknown",
            "target_agents": [],
            "action": None,
            "parameters": {},
            "error": "I didn't understand that command.",
            "suggestion": "Try commands like: 'write a post about AI ethics', 'publish', 'status', or 'help'",
            "original_input": user_input
        }
    
    def get_help(self) -> Dict[str, Any]:
        """Returns help information about available commands."""
        examples = {
            "Content Creation": [
                "Write a post about mindfulness",
                "Draft an article on AI ethics",
                "Generate a blog post about remote work"
            ],
            "Publishing": [
                "Publish the site",
                "Deploy to production",
                "Go live"
            ],
            "System": [
                "What's the status?",
                "Health check",
                "Run evolution cycle"
            ],
            "Research": [
                "What's trending in tech?",
                "Research machine learning",
                "Find out about productivity tools"
            ],
            "Design": [
                "Redesign the about page",
                "Create a thumbnail for my latest post"
            ]
        }
        
        return {
            "available_agents": list(self.agents.keys()),
            "example_commands": examples,
            "agent_details": self.agents
        }
    
    def execute(self, routed_command: Dict) -> Dict[str, Any]:
        """
        Execute a routed command by invoking the appropriate agents.
        Returns the result of the execution.
        """
        if not routed_command.get("success"):
            return {"error": routed_command.get("error", "Command routing failed")}
        
        results = []
        action = routed_command["action"]
        params = routed_command.get("parameters", {})
        
        try:
            if action == "generate_post":
                from admin.engineers.alchemist import Alchemist
                from admin.engineers.guardian import Guardian
                from admin.engineers.editor import Editor
                from admin import core
                
                # Step 1: Generate
                alchemist = Alchemist()
                doctrine = core.get_doctrine()
                content = alchemist.generate(params.get("topic", ""), doctrine)
                results.append({"agent": "Alchemist", "status": "complete", "output": "Content generated"})
                
                # Step 2: Audit
                guardian = Guardian()
                issues = guardian.audit_content(content)
                results.append({"agent": "Guardian", "status": "complete", "issues": issues})
                
                # Step 3: Edit
                editor = Editor()
                edit_issues = editor.audit(content)
                results.append({"agent": "Editor", "status": "complete", "suggestions": edit_issues})
                
                return {
                    "success": True,
                    "action": action,
                    "results": results,
                    "content_preview": content[:500] + "..." if len(content) > 500 else content
                }
                
            elif action == "publish":
                from admin import core
                result = core.publish_git()
                return {"success": True, "action": action, "message": result}
                
            elif action == "status":
                from admin import core
                from admin.brain.collective_intelligence import get_collective_intelligence
                
                server = core.ServerManager()
                ci = get_collective_intelligence()
                
                return {
                    "success": True,
                    "action": action,
                    "server_status": server.get_status(),
                    "team_status": ci.get_team_status()
                }
                
            elif action == "evolve":
                from admin.engineers.operator import Operator
                operator = Operator()
                report = operator.evolve()
                return {"success": True, "action": action, "report": report}
                
            elif action == "help":
                return {"success": True, "action": action, **self.get_help()}
                
            else:
                return {"success": False, "error": f"Action '{action}' not yet implemented"}
                
        except Exception as e:
            logger.error(f"[{self.name}] Execution failed: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
_router = None

def get_command_router() -> CommandRouter:
    """Get the global command router instance."""
    global _router
    if _router is None:
        _router = CommandRouter()
    return _router


if __name__ == "__main__":
    router = CommandRouter()
    
    # Test various commands
    test_commands = [
        "Write a post about AI ethics",
        "Publish the site",
        "What's the status?",
        "Research machine learning trends",
        "Run evolution cycle",
        "Help",
        "Some random gibberish that won't match"
    ]
    
    for cmd in test_commands:
        print(f"\n{'='*50}")
        print(f"Input: {cmd}")
        result = router.route(cmd)
        print(f"Intent: {result.get('intent')}")
        print(f"Agents: {result.get('target_agents')}")
        print(f"Action: {result.get('action')}")
        if result.get('parameters'):
            print(f"Params: {result.get('parameters')}")
