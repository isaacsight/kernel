#!/usr/bin/env python3
"""
Finalize Task - Ship a task from admin/tasks/ to content/
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.operator import Operator

async def main(task_id):
    operator = Operator()
    print(f"🚀 Finalizing task {task_id}...")
    
    result = await operator.execute("ship", task_id=task_id, commit=True, run_qa=True)
    
    if result["status"] == "success":
        print(f"✅ Success! {result['message']}")
        print(f"📍 Post shipped to: {result['target']}")
        print(f"🛡️ QA Status: {result['qa_status']}")
    else:
        print(f"❌ Failed: {result['message']}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python finalize_task.py <task_id>")
        sys.exit(1)
        
    task_id = sys.argv[1]
    asyncio.run(main(task_id))
