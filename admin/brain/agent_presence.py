"""
Agent Presence - Real-Time Agent Status Tracking

Inspired by Discord's Rich Presence feature.
Tracks what each agent is currently doing and enables real-time visibility.
"""

import os
import json
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum

logger = logging.getLogger("AgentPresence")


class AgentStatus(Enum):
    """Status states for agents."""
    IDLE = "idle"
    WORKING = "working"
    QUEUED = "queued"
    ERROR = "error"
    OFFLINE = "offline"


class AgentPresence:
    """
    Tracks what each agent is currently doing.
    Enables real-time visibility into the AI team.
    
    Inspired by Discord's Rich Presence - shows live activity status.
    """
    
    def __init__(self):
        self.name = "Agent Presence"
        self.presence_file = os.path.join(
            os.path.dirname(__file__), 'agent_presence.json'
        )
        self.presence: Dict[str, Dict] = self._load_presence()
        self._lock = threading.Lock()
        
        # Initialize all known agents
        self._init_agents()
        
        logger.info(f"[{self.name}] Initialized presence tracking")
    
    def _load_presence(self) -> Dict:
        """Load saved presence state from disk."""
        if os.path.exists(self.presence_file):
            try:
                with open(self.presence_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {}
    
    def _save_presence(self):
        """Persist presence state to disk."""
        with open(self.presence_file, 'w') as f:
            json.dump(self.presence, f, indent=2, default=str)
    
    def _init_agents(self):
        """Initialize presence for known agents."""
        known_agents = [
            # Orchestration
            ("Architect", "Solutions Designer", "🏗️", "Orchestration"),
            ("Operator", "System Manager", "⚙️", "Orchestration"),
            ("Visionary", "Strategic Planner", "🔮", "Orchestration"),
            ("Creative Director", "Creative Lead", "🎬", "Orchestration"),
            ("Scheduler", "Calendar Manager", "📅", "Orchestration"),
            ("Time Keeper", "System Historian", "⏳", "Orchestration"),
            ("System Architect", "Infrastructure Designer", "🏗️", "Orchestration"),
            ("The Sovereign", "Metacognitive Principal", "👑", "Orchestration"),
            
            # Content
            ("Alchemist", "Content Generator", "🧪", "Content"),
            ("Editor", "Style & Quality", "✏️", "Content"),
            ("Designer", "Visual Creator", "🎨", "Content"),
            ("Narrator", "Voice Creator", "🎙️", "Content"),
            ("Curator", "Content Curator", "🖼️", "Content"),
            ("Broadcaster", "Social Media", "📢", "Content"),
            ("Preview Generator", "Visual Validator", "👁️", "Content"),
            ("Workshop Manager", "Template Curator", "🛠️", "Content"),
            
            # Intelligence
            ("Analyst", "Data Expert", "📊", "Intelligence"),
            ("Librarian", "Knowledge Keeper", "📚", "Intelligence"),
            ("Translator", "Language Expert", "🌍", "Intelligence"),
            ("MLEngineer", "ML & Optimization", "🧠", "Intelligence"),
            ("Achievement Tracker", "Gamification Engine", "🏆", "Intelligence"),
            ("Communication Analyzer", "Conversation Intelligence", "📡", "Intelligence"),
            
            # Research
            ("Researcher", "Trend Analyst", "🔍", "Research"),
            ("Web Scout", "Research Intelligence", "🌐", "Research"),
            ("Harvester", "AI Web Scraper", "🕸️", "Research"),
            ("Collector", "AI Data Scraper", "🗄️", "Research"),
            ("Research Assistant", "Technical Support", "🧪", "Research"),
            
            # Safety
            ("Guardian", "Safety Officer", "🛡️", "Safety"),
            ("White Hat", "Security Researcher", "💻", "Safety"),
            ("Refiner", "High-Precision Editor", "💎", "Safety"),
            ("Classifier", "Intent Decoder", "🏷️", "Safety"),
            
            # Infra
            ("Network Engineer", "Systems Reliability", "🌐", "Infra"),
            ("Lattice Architect", "Interface Reliability", "🕸️", "Infra"),
        ]
        
        for name, role, emoji, category in known_agents:
            if name not in self.presence:
                self.presence[name] = {
                    "status": AgentStatus.IDLE.value,
                    "role": role,
                    "emoji": emoji,
                    "category": category,
                    "current_task": None,
                    "progress": 0,
                    "started_at": None,
                    "last_active": None,
                    "tasks_completed": 0,
                    "errors": 0,
                    "latency_ms": 42,
                    "eval_pass_rate": 0.98,
                    "risk_posture": "stable"
                }
            else:
                # Update metadata for existing agents to ensure categories are applied
                self.presence[name]["role"] = role
                self.presence[name]["emoji"] = emoji
                self.presence[name]["category"] = category
        
        self._save_presence()
    
    def update_presence(
        self, 
        agent_name: str, 
        status: AgentStatus,
        current_task: Optional[str] = None,
        progress: int = 0,
        details: Optional[Dict] = None
    ):
        """
        Update an agent's presence status.
        
        Args:
            agent_name: Name of the agent
            status: Current status (IDLE, WORKING, QUEUED, ERROR)
            current_task: Description of what the agent is doing
            progress: Percentage complete (0-100)
            details: Additional context
        """
        with self._lock:
            if agent_name not in self.presence:
                self.presence[agent_name] = {
                    "role": "Unknown",
                    "emoji": "🤖",
                    "tasks_completed": 0,
                    "errors": 0
                }
            
            agent = self.presence[agent_name]
            
            # Track state transitions
            was_working = agent.get("status") == AgentStatus.WORKING.value
            now_working = status == AgentStatus.WORKING
            
            if now_working and not was_working:
                # Just started working
                agent["started_at"] = datetime.now().isoformat()
            elif was_working and not now_working:
                # Just finished working
                if status == AgentStatus.IDLE:
                    agent["tasks_completed"] = agent.get("tasks_completed", 0) + 1
                elif status == AgentStatus.ERROR:
                    agent["errors"] = agent.get("errors", 0) + 1
                agent["started_at"] = None
            
            agent["status"] = status.value
            agent["current_task"] = current_task
            agent["progress"] = min(100, max(0, progress))
            agent["last_active"] = datetime.now().isoformat()
            
            if details:
                agent["details"] = details
            
            self._save_presence()
            
            logger.debug(f"[Presence] {agent_name}: {status.value} - {current_task}")
    
    def start_task(self, agent_name: str, task_description: str):
        """Convenience method to mark an agent as starting a task."""
        self.update_presence(
            agent_name,
            AgentStatus.WORKING,
            current_task=task_description,
            progress=0
        )
    
    def update_progress(self, agent_name: str, progress: int, task_update: Optional[str] = None):
        """Convenience method to update task progress."""
        with self._lock:
            if agent_name in self.presence:
                agent = self.presence[agent_name]
                agent["progress"] = min(100, max(0, progress))
                if task_update:
                    agent["current_task"] = task_update
                agent["last_active"] = datetime.now().isoformat()
                self._save_presence()
    
    def complete_task(self, agent_name: str, success: bool = True):
        """Convenience method to mark a task as complete."""
        status = AgentStatus.IDLE if success else AgentStatus.ERROR
        self.update_presence(
            agent_name,
            status,
            current_task=None,
            progress=0
        )
    
    def queue_task(self, agent_name: str, task_description: str):
        """Mark an agent as queued for a task."""
        self.update_presence(
            agent_name,
            AgentStatus.QUEUED,
            current_task=f"Queued: {task_description}",
            progress=0
        )
    
    def get_presence(self, agent_name: str) -> Optional[Dict]:
        """Get presence info for a single agent."""
        return self.presence.get(agent_name)
    
    def get_team_presence(self) -> List[Dict]:
        """Get presence info for all agents, formatted for display."""
        team = []
        now = datetime.now()
        
        for name, data in self.presence.items():
            # Calculate how long since last active
            last_active = data.get("last_active")
            if last_active:
                try:
                    last_dt = datetime.fromisoformat(last_active)
                    idle_time = now - last_dt
                    idle_str = self._format_duration(idle_time)
                except:
                    idle_str = "unknown"
            else:
                idle_str = "never"
            
            # Calculate current task duration
            started_at = data.get("started_at")
            if started_at and data.get("status") == AgentStatus.WORKING.value:
                try:
                    start_dt = datetime.fromisoformat(started_at)
                    duration = now - start_dt
                    duration_str = self._format_duration(duration)
                except:
                    duration_str = None
            else:
                duration_str = None
            
            team.append({
                "name": name,
                "role": data.get("role", "Agent"),
                "emoji": data.get("emoji", "🤖"),
                "category": data.get("category", "General"),
                "status": data.get("status", "unknown"),
                "current_task": data.get("current_task"),
                "progress": data.get("progress", 0),
                "duration": duration_str,
                "idle_since": idle_str if data.get("status") == AgentStatus.IDLE.value else None,
                "tasks_completed": data.get("tasks_completed", 0),
                "errors": data.get("errors", 0),
                "latency_ms": data.get("latency_ms", 42),
                "eval_pass_rate": data.get("eval_pass_rate", 0.98),
                "risk_posture": data.get("risk_posture", "stable")
            })
        
        # Sort: working first, then queued, then idle, then error/offline
        status_order = {
            AgentStatus.WORKING.value: 0,
            AgentStatus.QUEUED.value: 1,
            AgentStatus.IDLE.value: 2,
            AgentStatus.ERROR.value: 3,
            AgentStatus.OFFLINE.value: 4
        }
        team.sort(key=lambda x: status_order.get(x["status"], 5))
        
        return team
    
    def _format_duration(self, delta: timedelta) -> str:
        """Format a timedelta into a human-readable string."""
        total_seconds = int(delta.total_seconds())
        
        if total_seconds < 60:
            return f"{total_seconds}s"
        elif total_seconds < 3600:
            minutes = total_seconds // 60
            return f"{minutes}m"
        elif total_seconds < 86400:
            hours = total_seconds // 3600
            return f"{hours}h"
        else:
            days = total_seconds // 86400
            return f"{days}d"
    
    def get_status_summary(self) -> Dict:
        """Get a summary of team status."""
        statuses = {}
        for name, data in self.presence.items():
            status = data.get("status", "unknown")
            statuses[status] = statuses.get(status, 0) + 1
        
        total_completed = sum(
            d.get("tasks_completed", 0) for d in self.presence.values()
        )
        total_errors = sum(
            d.get("errors", 0) for d in self.presence.values()
        )
        
        return {
            "total_agents": len(self.presence),
            "by_status": statuses,
            "total_tasks_completed": total_completed,
            "total_errors": total_errors,
            "working_agents": [
                name for name, data in self.presence.items()
                if data.get("status") == AgentStatus.WORKING.value
            ]
        }
    
    def format_for_display(self) -> str:
        """Format presence as a human-readable string for terminal/logs."""
        lines = ["╭─── Agent Status ───╮"]
        
        for agent in self.get_team_presence():
            status = agent["status"]
            emoji = agent["emoji"]
            name = agent["name"]
            
            if status == AgentStatus.WORKING.value:
                indicator = "🟢"
                detail = f"{agent['current_task']} ({agent['progress']}%)"
                if agent.get("duration"):
                    detail += f" [{agent['duration']}]"
            elif status == AgentStatus.QUEUED.value:
                indicator = "🟡"
                detail = agent.get("current_task", "Waiting...")
            elif status == AgentStatus.ERROR.value:
                indicator = "🔴"
                detail = "Error"
            else:
                indicator = "💤"
                detail = f"Idle since {agent.get('idle_since', 'unknown')}"
            
            lines.append(f"│ {indicator} {emoji} {name:15} │ {detail}")
        
        lines.append("╰────────────────────╯")
        return "\n".join(lines)


# Singleton instance
_presence = None

def get_agent_presence() -> AgentPresence:
    """Get the global agent presence instance."""
    global _presence
    if _presence is None:
        _presence = AgentPresence()
    return _presence


# Context manager for tracking agent tasks
class AgentTask:
    """
    Context manager for tracking agent task execution.
    
    Usage:
        with AgentTask("Alchemist", "Writing blog post about AI"):
            # do work
            pass
    """
    
    def __init__(self, agent_name: str, task_description: str):
        self.agent_name = agent_name
        self.task_description = task_description
        self.presence = get_agent_presence()
    
    def __enter__(self):
        self.presence.start_task(self.agent_name, self.task_description)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        success = exc_type is None
        self.presence.complete_task(self.agent_name, success=success)
        return False  # Don't suppress exceptions
    
    def update(self, progress: int, task_update: Optional[str] = None):
        """Update progress during task execution."""
        self.presence.update_progress(self.agent_name, progress, task_update)


if __name__ == "__main__":
    presence = AgentPresence()
    
    # Simulate some agent activity
    print("Initial state:")
    print(presence.format_for_display())
    
    # Start a task
    presence.start_task("Alchemist", "Writing 'AI Ethics' post")
    presence.update_progress("Alchemist", 30)
    
    presence.queue_task("Guardian", "Audit pending content")
    
    print("\nAfter starting tasks:")
    print(presence.format_for_display())
    
    print("\nStatus Summary:")
    print(presence.get_status_summary())
