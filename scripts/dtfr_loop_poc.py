import asyncio
import os
import sys
import logging
import json
from typing import List, Optional, Any
from pydantic import BaseModel, ValidationError

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.metacognitive_principal import MetacognitivePrincipal
from doe_workspace_bundle.engineers.antigravity_engineer import AntigravityEngineer

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("DTFR-Loop-POC")

# --- Structured Schemas ---


class Step(BaseModel):
    id: int
    action: str  # e.g., "read", "write", "search", "run_command"
    target: str  # path or command
    params: Optional[dict[str, Any]] = None
    dependency: Optional[int] = None


class DTFRPlan(BaseModel):
    mission: str
    steps: List[Step]
    success_criteria: str


# --- Refined Loop ---


async def dtfr_loop(prompt: str):
    """
    Standardize DTFR Loop: Planner (Sovereign) -> Executor (Antigravity) -> Reporter
    Uses structured Pydantic schemas for safe handoff.
    """
    planner = MetacognitivePrincipal()
    executor = AntigravityEngineer()

    print("\n" + "=" * 60)
    print(f"🚀 STARTING REFINED DTFR LOOP")
    print(f"Task: {prompt}")
    print("=" * 60 + "\n")

    # Phase 1: Planning (System 2 Thinking)
    print(f"🧠 [PHASE 1: PLANNING] {planner.name} is reasoning...")

    # We ask the Sovereign to produce a JSON plan matching our schema
    planner_prompt = f"""
    TASK: {prompt}
    
    Produce a structured DTFRPlan in JSON format.
    The schema is:
    {{
        "mission": "overall goal",
        "steps": [
            {{"id": 1, "action": "read|write|search|run_command", "target": "path/cmd", "params": {{}}, "dependency": null}}
        ],
        "success_criteria": "how to verify"
    }}
    
    ENSURE the output is ONLY the raw JSON.
    """

    # Using depth=1 for speed in POC, but it still triggers recursive thinking if prompted
    plan_raw = await planner.think_recursive(planner_prompt, depth=1)

    try:
        # Clean potential markdown from response
        clean_json = plan_raw.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json.split("```json")[1].split("```")[0].strip()
        elif clean_json.startswith("```"):
            clean_json = clean_json.split("```")[1].split("```")[0].strip()

        plan_data = json.loads(clean_json)
        validated_plan = DTFRPlan(**plan_data)
        print(f"✅ PLAN VALIDATED: {validated_plan.mission}\n")
    except (ValidationError, json.JSONDecodeError) as e:
        logger.error(f"Failed to parse validated plan: {e}")
        print(f"❌ FALLING BACK TO UNSTRUCTURED PLAN")
        validated_plan = plan_raw

    # Phase 2: Execution (Core Kernel Tools)
    print(f"🛠️ [PHASE 2: EXECUTION] {executor.name} is implementing...")

    results = []
    if isinstance(validated_plan, DTFRPlan):
        # Structured Execution
        for step in validated_plan.steps:
            print(f"  [STEP {step.id}] {step.action}: {step.target}")
            # Map Step to Antigravity tools
            # Note: In a full implementation, we'd use _execute_tool directly
            # For this POC, we use the higher-level .execute() with the step description
            step_desc = f"Perform {step.action} on {step.target} with params {step.params}"
            res = await executor.execute(step_desc)
            results.append({"step": step.id, "result": res})
    else:
        # Unstructured fallback
        res = await executor.execute(validated_plan)
        results.append({"unstructured_result": res})

    print(f"\n✅ EXECUTION COMPLETE\n")

    # Phase 3: Reporting (Synthesis)
    print(f"📊 [PHASE 3: REPORTING] Final Synthesis")
    final_report = {
        "original_task": prompt,
        "plan": validated_plan.dict() if isinstance(validated_plan, DTFRPlan) else validated_plan,
        "execution_results": results,
        "timestamp": __import__("datetime").datetime.now().isoformat(),
    }

    print("\n" + "=" * 60)
    print("🏁 DTFR LOOP FINAL REPORT")
    print(f"Status: SUCCESS")
    print(
        f"Mission: {validated_plan.mission if isinstance(validated_plan, DTFRPlan) else 'General Task'}"
    )
    print("=" * 60 + "\n")

    return final_report


if __name__ == "__main__":
    task = "Scan the codebase for technical debt and propose a refactor for the memory module."
    if len(sys.argv) > 1:
        task = " ".join(sys.argv[1:])

    try:
        asyncio.run(dtfr_loop(task))
    except KeyboardInterrupt:
        print("\nLoop interrupted by user.")
    except Exception as e:
        logger.error(f"Loop failed: {e}")
        import traceback

        traceback.print_exc()
