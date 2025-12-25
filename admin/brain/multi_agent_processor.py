import asyncio
import logging
import time
from typing import List, Dict, Any, Tuple, Optional
import traceback

logger = logging.getLogger("AgentOrchestrator")

class AgentOrchestrator:
    """
    Orchestrates multiple agents to run tasks concurrently.
    """
    def __init__(self):
        self.results = {}
        self.errors = {}

    async def run_parallel(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Runs a list of agent tasks in parallel.
        
        Args:
            tasks: List of task dictionaries, each containing:
                - 'agent': The agent instance
                - 'action': The action to execute (e.g., 'research')
                - 'params': Dict of parameters for the action
                - 'id': Optional unique ID for the task (defaults to agent name + index)
                
        Returns:
            Dict containing results and metadata.
        """
        start_time = time.time()
        logger.info(f"🚀 Starting parallel execution of {len(tasks)} tasks...")
        
        # Prepare coroutines
        coroutines = []
        task_ids = []
        
        for i, task_info in enumerate(tasks):
            agent = task_info.get('agent')
            action = task_info.get('action')
            params = task_info.get('params', {})
            task_id = task_info.get('id', f"{getattr(agent, 'name', 'Agent')}_{i}")
            
            task_ids.append(task_id)
            
            # Use execute if available, otherwise fallback to specific methods if needed
            if hasattr(agent, 'execute'):
                # Check if execute is a coroutine function
                if asyncio.iscoroutinefunction(agent.execute):
                    coroutines.append(self._wrap_coroutine(task_id, agent.execute(action, **params)))
                else:
                    # Wrap synchronous execute in a thread
                    coroutines.append(self._wrap_sync_task(task_id, agent.execute, action, **params))
            else:
                logger.warning(f"Agent {task_id} does not have an 'execute' method.")
                # We could add more flexible fallback logic here if needed
                
        # Gather results
        raw_results = await asyncio.gather(*coroutines, return_exceptions=True)
        
        # Process results
        for task_id, result in zip(task_ids, raw_results):
            if isinstance(result, Exception):
                logger.error(f"❌ Task {task_id} failed: {result}")
                self.errors[task_id] = str(result)
                self.results[task_id] = None
            else:
                self.results[task_id] = result
                
        duration = time.time() - start_time
        logger.info(f"🏁 Parallel execution complete in {duration:.2f}s")
        
        return {
            "results": self.results,
            "errors": self.errors,
            "duration_seconds": duration,
            "task_count": len(tasks)
        }

    async def _wrap_coroutine(self, task_id: str, coro):
        """Wraps a coroutine to add logging and timing."""
        logger.info(f"⏳ Task {task_id} started...")
        step_start = time.time()
        try:
            result = await coro
            logger.info(f"✅ Task {task_id} finished in {time.time() - step_start:.2f}s")
            return result
        except Exception as e:
            logger.error(f"🔥 Task {task_id} crashed: {e}\n{traceback.format_exc()}")
            return e

    async def _wrap_sync_task(self, task_id: str, func, *args, **kwargs):
        """Wraps a synchronous task in a thread."""
        logger.info(f"⏳ Task {task_id} (Sync) started in thread...")
        step_start = time.time()
        try:
            result = await asyncio.to_thread(func, *args, **kwargs)
            logger.info(f"✅ Task {task_id} (Sync) finished in {time.time() - step_start:.2f}s")
            return result
        except Exception as e:
            logger.error(f"🔥 Task {task_id} (Sync) crashed: {e}\n{traceback.format_exc()}")
            return e

# Singleton instance
_orchestrator = None

def get_orchestrator() -> AgentOrchestrator:
    """Get the global agent orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
