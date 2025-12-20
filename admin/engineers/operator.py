import logging
import os
import sys
from typing import Dict, Any, List
from admin.brain.agent_base import BaseAgent
from config import config

logger = logging.getLogger("Operator")

class Operator(BaseAgent):
    """
    The Operator (AIGC Operations Engineer)
    Now data-driven via admin/brain/agents/operator/
    """
    def __init__(self):
        super().__init__(agent_id="operator")
        from admin.brain.memory_store import get_memory_store
        self.memory = get_memory_store()
        
    async def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Executes an action via the unified Agent Interface.
        """
        if action == "apply":
            file_path = params.get("file_path")
            content = params.get("content")
            
            if not file_path or content is None:
                raise ValueError("file_path and content are required for apply.")
            
            # Action: Write to file
            try:
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)
                logger.info(f"[{self.name}] Applied changes to {file_path}")
                return {"status": "success", "file": file_path}
            except Exception as e:
                logger.error(f"[{self.name}] Failed to apply changes: {e}")
                return {"status": "error", "message": str(e)}
                
        elif action == "run_command":
            import subprocess
            command = params.get("command")
            if not command:
                raise ValueError("command is required.")
                
            try:
                result = subprocess.run(command, shell=True, capture_output=True, text=True)
                return {
                    "status": "success" if result.returncode == 0 else "error",
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.returncode
                }
            except Exception as e:
                return {"status": "error", "message": str(e)}

        elif action == "bridge_to_mobile":
            """
            Prepares a 'Handover' packet for the mobile app, allowing Google Gemini on mobile
             to pick up the OS's context.
            """
            content = params.get("content")
            title = params.get("title", "Studio OS Handover")
            
            # This logs a special event that the mobile app subscribes to
            from admin.api.connection_manager import get_connection_manager
            import asyncio
            import json
            
            manager = get_connection_manager()
            asyncio.create_task(manager.broadcast(json.dumps({
                "type": "mobile_handover",
                "title": title,
                "content": content,
                "target": "gemini_mobile"
            })))
            
            return {"status": "success", "message": f"Handover for '{title}' broadcasted to mobile."}

        elif action == "system_telemetry":
            """Provides a deep state report for the 'System Integrator' (Antigravity)."""
            from admin.brain.metrics_collector import get_metrics_collector
            metrics = get_metrics_collector()
            
            return {
                "os_status": "operational",
                "intake_queue": "active",
                "metrics": metrics.get_daily_summary(),
                "recent_insights": self.memory.get_insights()[:5]
            }
        
        else:
             raise NotImplementedError(f"Action {action} not supported by Operator.")

    def evolve(self) -> str:
        """
        Simulates a self-improvement cycle (The Evolution Loop).
        In a real scenario, this would analyze system metrics, identify bottlenecks, 
        and propose code changes.
        """
        import time
        
        # 1. Self-Diagnosis
        logger.info("[Evolution] Starting self-diagnosis...")
        diagnostics = "System Health: OK. Bottleneck: None detected." # Simulated
        time.sleep(1) # Thinking
        
        # 2. Strategic Planning (Blueprint)
        logger.info("[Evolution] Formulating improvement plan...")
        plan = "Blueprint: Optimize 'CommandRouter' latency by 10% via caching."
        time.sleep(1)
        
        # 3. Execution (Simulation)
        logger.info("[Evolution] Executing changes...")
        report = f"""
Evolution Cycle Complete.
-------------------------
1. Diagnosis: {diagnostics}
2. Plan: {plan}
3. Status: Blueprint Created (Pending Approval)
        """
        return report
