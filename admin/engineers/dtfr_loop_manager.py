import asyncio
import logging
import json
from datetime import datetime
from typing import List, Optional
from admin.schemas import DTFRPlan, ExecutionResult, DTFRReport
from admin.engineers.metacognitive_principal import MetacognitivePrincipal
from admin.engineers.antigravity_engineer import AntigravityEngineer

logger = logging.getLogger("DTFRLoopManager")


class DTFRLoopManager:
    """
    Orchestrates the formal DTFR Loop:
    Planner (Sovereign) -> Executor (Antigravity) -> Reporter -> Critique (Sovereign)
    """

    def __init__(self):
        self.planner = MetacognitivePrincipal()
        self.executor = AntigravityEngineer()

    async def run_loop(self, task: str) -> DTFRReport:
        logger.info(f"[DTFRLoop] Starting loop for task: {task}")

        # Phase 1: Planning
        logger.info("[DTFRLoop] Phase 1: Planning...")
        plan = await self.planner.think_plan(task)
        logger.info(f"[DTFRLoop] Plan generated: {plan.mission}")

        # Phase 2: Execution
        logger.info("[DTFRLoop] Phase 2: Execution...")
        actions = await self.executor.execute_plan(plan)
        logger.info(f"[DTFRLoop] Execution complete. {len(actions)} steps performed.")

        # Phase 3: Critique (The Sovereign Reviews the Trajectory)
        logger.info("[DTFRLoop] Phase 3: Sovereign Critique...")

        trajectory_json = json.dumps([a.dict() for a in actions], indent=2)
        critique_prompt = f"""
        TASK: {task}
        PLAN: {plan.json()}
        TRAJECTORY:
        {trajectory_json}
        
        Evaluate the execution against the success criteria: "{plan.success_criteria}".
        Did the agent succeed? What logic gaps or risks remain?
        """

        critique = await self.planner.think_recursive(critique_prompt, depth=1)

        # Phase 4: Reporting
        report = DTFRReport(
            task=task,
            plan=plan,
            actions=actions,
            critique=critique,
            timestamp=datetime.now().isoformat(),
        )

        await self._log_to_decision_ledger(report)
        return report

    async def _log_to_decision_ledger(self, report: DTFRReport):
        """
        Logs the loop run to the decision-log.md artifact.
        """
        import os
        from admin.config import config

        log_path = os.path.join(config.PROJECT_ROOT, "decision-log.md")

        entry = f"""
## [LOOP] {report.timestamp} - {report.plan.mission}
- **Task**: {report.task}
- **Status**: {"SUCCESS" if all(a.status == "success" for a in report.actions) else "PARTIAL/FAILURE"}
- **Critique**: {report.critique[:500]}...
- **Steps**: {len(report.actions)}

---
"""
        try:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(entry)
            logger.info(f"[DTFRLoop] Logged to {log_path}")
        except Exception as e:
            logger.error(f"[DTFRLoop] Failed to log decision: {e}")


if __name__ == "__main__":

    async def test():
        manager = DTFRLoopManager()
        report = await manager.run_loop("Scan for broken links in index.html")
        print(f"Report Critique: {report.critique}")

    asyncio.run(test())
