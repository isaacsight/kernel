import logging
import os
import json
from datetime import datetime
from admin.brain.agent_base import BaseAgent
from admin.engineers.system_monitor import Systemmonitor
from admin.engineers.lab_scientist import LabScientist

logger = logging.getLogger("HealthScout")

class HealthScout(BaseAgent):
    """
    The Health Scout monitors the overall state of the Studio OS agents.
    It coordinates between hardware telemetry and cognitive reasoning audits.
    """
    def __init__(self):
        super().__init__(agent_id="health_scout")
        self.monitor = Systemmonitor()
        self.scientist = LabScientist()

    def execute(self, action: str = "check_health", **params):
        """Standard execution entry point."""
        if action == "check_health":
            return self.perform_full_audit()
        else:
            raise NotImplementedError(f"Action {action} not supported by Health Scout.")

    def perform_full_audit(self):
        """Runs both telemetry and reasoning audits."""
        logger.info(f"[{self.agent_id}] Starting Comprehensive Studio Health Audit...")
        
        # 1. Hardware & Cognitive Telemetry
        telemetry = self.monitor.execute()
        
        # 2. Reasoning Entailment Audit (Experiment 9)
        reasoning = self.scientist.run_experiment("9")
        
        # 3. Synthesize Status
        status = "HEALTHY"
        recommendations = []
        
        if telemetry.get('cognitive_fatigue', 0) > 7.0:
            status = "STRESSED"
            recommendations.append("Trigger context flush for active agents.")
            
        if reasoning.get('felt_alignment_score', 10) < 6.0:
            status = "DEGRADED"
            recommendations.append("High hallucination risk detected. Review recent drafts manually.")
            
        final_report = {
            "timestamp": datetime.now().isoformat(),
            "status": status,
            "telemetry": telemetry,
            "reasoning_audit": reasoning,
            "recommendations": recommendations
        }
        
        print(f"\n🩺 STUDIO OS HEALTH REPORT: {status}")
        for rec in recommendations:
            print(f"- RECOMMENDATION: {rec}")
            
        return final_report

if __name__ == "__main__":
    # Test Mode
    logging.basicConfig(level=logging.INFO)
    scout = HealthScout()
    scout.perform_full_audit()
