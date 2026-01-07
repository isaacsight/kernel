import asyncio
import logging
import os
import time
from typing import List, Optional, Callable, Awaitable
from datetime import datetime
from pydantic import BaseModel

from core.dtfr_schemas import DTFRPlan, ExecutionResult, DTFRLoopReport
from admin.engineers.metacognitive_principal import MetacognitivePrincipal
from doe_workspace_bundle.engineers.antigravity_engineer import AntigravityEngineer
from admin.brain.agents.metacognition.cognitive_ledger import get_cognitive_ledger

logger = logging.getLogger("DTFRLoopManager")


class DTFRLoopManager:
    """
    Orchestrates the formal DTFR "Think → Act → Critique" pipeline.
    """

    def __init__(self):
        self.principal = MetacognitivePrincipal()
        self.kernel = AntigravityEngineer()

    async def run(
        self,
        prompt: str,
        on_step: Optional[Callable[[str, str, dict], Awaitable[None]]] = None
    ) -> DTFRLoopReport:
        """
        Runs the full loop: Planning → Execution → Critique.

        Args:
            prompt: Task description.
            on_step: Optional async callable for real-time updates.
                     Signature: async def on_step(step_id: str, status: str, data: dict) -> None
        """
        logger.info(f"[DTFRLoopManager] Initiating loop for task: {prompt}")

        # 1. Planning Phase
        logger.info("[DTFRLoopManager] Phase 1: Planning...")
        plan = await self.principal.think_plan(prompt)

        # 2. Execution Phase
        logger.info("[DTFRLoopManager] Phase 2: Execution...")

        # We wrap execution to provide pulses
        results = []
        for step in plan.steps:
            if on_step:
                await on_step(
                    step.id, "executing", {"tool": step.tool_name, "rationale": step.rationale}
                )

            # Execute single step
            # Note: AntigravityEngineer.execute_plan executes the whole plan,
            # so we should probably update it to execute a single step or pass the callback down.
            # For now, let's update AntigravityEngineer to take a callback too.
            step_results = await self.kernel.execute_plan(
                DTFRPlan(
                    mission=plan.mission,
                    context=plan.context,
                    steps=[step],
                    success_criteria=plan.success_criteria,
                )
            )
            results.extend(step_results)

            if on_step:
                status = (
                    "success" if step_results and step_results[0].status == "success" else "failure"
                )
                await on_step(
                    step.id,
                    status,
                    {"output": step_results[0].output if step_results else "No result"},
                )

            if step_results and step_results[0].status == "failure":
                break

        # 3. Critique Phase
        logger.info("[DTFRLoopManager] Phase 3: Critique...")
        critique = await self.principal.critique(plan, results)

        # 4. Status Determination
        all_success = all(r.status == "success" for r in results)
        status = "COMPLETED" if all_success else "PARTIAL_FAILURE"

        # 5. Synthesize Report
        report = DTFRLoopReport(
            task=prompt,
            plan=plan,
            actions=results,
            critique=critique,
            status=status,
            next_steps=["Verify changes manually", "Review Decision Log"],
        )

        # 6. Log to Unified Cognitive Ledger
        self._log_to_cognitive_ledger(report)

        # 7. Log to Decision Log (MD)
        self._log_to_decision_ledger(report)

        return report

    def _log_to_cognitive_ledger(self, report: DTFRLoopReport):
        """Records loop outcome as a Case Study in the Unified Cognitive Ledger."""
        try:
            ledger = get_cognitive_ledger()
            ledger.record_case_study(
                agent_id="dtfr_loop",
                outcome=report.status,
                reasoning=report.critique,
                success=(report.status == "COMPLETED"),
                metadata={
                    "mission": report.plan.mission,
                    "task": report.task,
                    "steps_count": len(report.actions),
                    "execution_time": sum(a.duration for a in report.actions),
                },
            )
        except (ImportError, AttributeError) as e:
            logger.debug(f"Cognitive ledger not available: {e}")
        except Exception as e:
            logger.error(f"Failed to record cognitive case study: {e}", exc_info=True)

    def _log_to_decision_ledger(self, report: DTFRLoopReport):
        """
        Persists the loop outcome to the Studio OS Decision Ledger.
        """
        try:
            # In a real implementation, this would call admin.brain.decision_ledger
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "mission": report.plan.mission,
                "status": report.status,
                "summary": report.critique[:500],
                "steps_taken": len(report.actions),
            }
            logger.info(f"[DTFRLoopManager] Logged to Decision Ledger: {log_entry}")

            # For verification, we also write a markdown file if possible
            log_dir = "logs/decisions"
            os.makedirs(log_dir, exist_ok=True)
            log_file = os.path.join(log_dir, f"loop_{int(time.time())}.md")

            with open(log_file, "w", encoding="utf-8") as f:
                f.write(f"# DTFR Loop Report: {report.plan.mission}\n\n")
                f.write(f"**Status**: {report.status}\n\n")
                f.write(f"## Plan\n{report.plan.model_dump_json(indent=2)}\n\n")
                f.write(f"## Execution\n")
                for r in report.actions:
                    f.write(f"- **Step {r.step_id}** ({r.tool_name}): {r.status}\n")
                f.write(f"\n## Critique\n{report.critique}\n")

            # Also append to root decision-log.md
            root_log = "decision-log.md"
            entry = f"""
## [LOOP] {datetime.now().isoformat()} - {report.plan.mission}
- **Task**: {report.task}
- **Status**: {report.status}
- **Critique**: {report.critique[:500]}...
- **Steps**: {len(report.actions)}

---
"""
            with open(root_log, "a", encoding="utf-8") as rf:
                rf.write(entry)
            logger.info(f"[DTFRLoopManager] Appended to {root_log}")

        except OSError as e:
            logger.error(f"Failed to write decision log files: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"Failed to log decision: {e}", exc_info=True)
