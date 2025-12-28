"""
Directing Loop - Sovereign Orchestration for "Directing vs Typing"

This module implements the high-level orchestration loop that allows the user 
to direct project evolutions using a "Mission" based approach.
"""

import os
import logging
import asyncio
import json
from datetime import datetime
from typing import Dict, Any, List

from admin.engineers.antigravity_engineer import AntigravityEngineer
from admin.engineers.director import Director
from admin.engineers.principal_engineer import PrincipalEngineer
from admin.engineers.operator import Operator
from admin.brain.mission_state import get_mission_manager

logger = logging.getLogger("DirectingLoop")

class DirectingLoop:
    """
    Orchestrates the lifecycle of a high-level "Mission".
    """
    
    def __init__(self):
        self.antigravity = AntigravityEngineer()
        self.director = Director()
        self.principal = PrincipalEngineer()
        self.operator = Operator()
        self.mission_manager = get_mission_manager()
        self.project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
    async def run_mission(self, mission_description: str) -> Dict[str, Any]:
        """
        Runs a full mission lifecycle.
        """
        logger.info(f"[DirectingLoop] Starting Mission: {mission_description}")
        
        # 0. Initialize State
        self.mission_manager.start_mission(mission_description)
        
        report = {
            "mission": mission_description,
            "started_at": datetime.now().isoformat(),
            "steps": [],
            "status": "in_progress"
        }
        
        # 1. PLANNING
        plan_step = {"stage": "planning", "status": "in_progress"}
        report["steps"].append(plan_step)
        self.mission_manager.update_stage("planning", "in_progress")
        
        planning_task = f"""
        MISSION: {mission_description}
        
        TASK: Create a detailed execution plan to achieve this mission.
        You MUST output a JSON object with the following structure:
        {{
            "description": "High level summary",
            "steps": [
                {{
                    "action": "read|write|search",
                    "path": "file path",
                    "content": "new content if write",
                    "description": "why this step"
                }}
            ]
        }}
        """
        
        try:
            # Use single-shot model call for planning (don't use the autonomous loop)
            # This prevents the engineer from trying to execute steps while still planning.
            if hasattr(self.antigravity, 'model') and self.antigravity.model:
                response = self.antigravity.model.generate_content(planning_task)
                plan_response = response.text
            else:
                # Fallback to the slow way if model isn't directly exposed
                plan_response = await self.antigravity.execute(planning_task)
            
            # Find the JSON block in the response
            if "{" in plan_response:
                start = plan_response.find("{")
                end = plan_response.rfind("}") + 1
                json_part = plan_response[start:end]
                plan = json.loads(json_part)
            else:
                plan = {"description": plan_response, "steps": []}
            
            plan_step["plan"] = plan
            plan_step["status"] = "complete"
            self.mission_manager.update_stage("planning", "complete", {"plan": plan})
            logger.info(f"[DirectingLoop] Plan generated: {plan.get('description')}")
            
        except Exception as e:
            plan_step["status"] = "failed"
            plan_step["error"] = str(e)
            report["status"] = "failed"
            self.mission_manager.update_stage("planning", "failed", {"error": str(e)})
            self.mission_manager.complete_mission(f"Mission failed during planning: {e}")
            return report

        # 2. DOCTRINAL AUDIT
        audit_step = {"stage": "doctrinal_audit", "status": "in_progress"}
        report["steps"].append(audit_step)
        self.mission_manager.update_stage("doctrinal_audit", "in_progress")
        
        audit_result = self.director.check_alignment(
            json.dumps(plan, indent=2), 
            context={"mission": mission_description, "type": "technical_plan"}
        )
        
        audit_step["result"] = audit_result
        
        if audit_result.get("veto"):
            audit_step["status"] = "vetoed"
            report["status"] = "vetoed"
            self.mission_manager.update_stage("doctrinal_audit", "vetoed", {"result": audit_result})
            self.mission_manager.complete_mission(f"Mission VETOED by Director: {audit_result.get('reason')}")
            logger.warning(f"[DirectingLoop] Mission VETOED by Director: {audit_result.get('reason')}")
            return report
            
        audit_step["status"] = "approved"
        self.mission_manager.update_stage("doctrinal_audit", "approved", {"result": audit_result})
        logger.info(f"[DirectingLoop] Plan approved by Director (Alignment: {audit_result.get('alignment_score')})")

        # 3. EXECUTION
        exec_step = {"stage": "execution", "status": "in_progress"}
        report["steps"].append(exec_step)
        self.mission_manager.update_stage("execution", "in_progress")
        
        exec_task = f"""
        Execute the following plan precisely. 
        PLAN: {json.dumps(plan, indent=2)}
        """
        
        try:
            exec_result = await self.antigravity.execute(exec_task)
            exec_step["result"] = exec_result
            exec_step["status"] = "complete"
            self.mission_manager.update_stage("execution", "complete", {"result": exec_result})
            logger.info(f"[DirectingLoop] Execution finished.")
        except Exception as e:
            exec_step["status"] = "failed"
            exec_step["error"] = str(e)
            report["status"] = "failed"
            self.mission_manager.update_stage("execution", "failed", {"error": str(e)})
            self.mission_manager.complete_mission(f"Mission failed during execution: {e}")
            return report

        # 4. REVIEW
        review_step = {"stage": "review", "status": "in_progress"}
        report["steps"].append(review_step)
        self.mission_manager.update_stage("review", "in_progress")
        
        # Technical Review
        tech_audit = self.principal.audit_system(f"Verify mission changes: {mission_description}")
        review_step["tech_audit"] = tech_audit
        
        # Aesthetic Review
        aesthetic_check = self.director.check_alignment(
            exec_result,
            context={"mission": mission_description, "type": "technical_result"}
        )
        review_step["aesthetic_check"] = aesthetic_check
        
        if aesthetic_check.get("veto"):
            review_step["status"] = "failed_review"
            report["status"] = "rollback_required"
            self.mission_manager.update_stage("review", "failed_review", {
                "tech_audit": tech_audit, 
                "aesthetic_check": aesthetic_check
            })
            self.mission_manager.complete_mission(f"Mission failed aesthetic review: {aesthetic_check.get('reason')}")
            logger.warning(f"[DirectingLoop] Final implementation failed aesthetic review: {aesthetic_check.get('reason')}")
            return report

        review_step["status"] = "approved"
        self.mission_manager.update_stage("review", "approved", {
            "tech_audit": tech_audit, 
            "aesthetic_check": aesthetic_check
        })
        logger.info(f"[DirectingLoop] Review passed.")
        
        self.mission_manager.update_stage("shipment", "complete")
        self.mission_manager.complete_mission("Mission shipped successfully.")
        
        logger.info(f"[DirectingLoop] Mission Complete: {mission_description}")
        return report

async def main():
    # Simple test run if called directly
    loop = DirectingLoop()
    mission = "Add a docstring to every function in evolution_loop.py"
    result = await loop.run_mission(mission)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
