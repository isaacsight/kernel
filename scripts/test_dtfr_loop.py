import asyncio
import json
from admin.engineers.dtfr_loop_manager import DTFRLoopManager


async def test_loop():
    print("🚀 TESTING FORMALIZED DTFR LOOP")
    manager = DTFRLoopManager()

    task = "Scan for broken links in projekts.html"  # Intentionally misspelled to see if planner corrects it or search handles it

    print(f"\nTask: {task}")
    print("-" * 40)

    try:
        report = await manager.run_loop(task)

        print("\n✅ LOOP COMPLETE")
        print(f"Mission: {report.plan.mission}")
        print(f"Critique: {report.critique}")
        print("\nActions Trajectory:")
        for action in report.actions:
            print(f"- [{action.status.upper()}] {action.action} -> {action.target}")

    except Exception as e:
        print(f"\n❌ LOOP FAILED: {e}")


if __name__ == "__main__":
    asyncio.run(test_loop())
