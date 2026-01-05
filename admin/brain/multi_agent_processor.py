import asyncio
import logging
import time
from typing import List, Dict, Any, Tuple, Optional
import traceback
from admin.brain.council_protocol import get_council_prompt, get_critique_prompt

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

    def _classify_intent(self, inquiry: str) -> str:
        """
        Classify inquiry intent for agent routing.
        
        Returns one of: 'research', 'generate', 'analyze', 'general'
        """
        inquiry_lower = inquiry.lower()
        
        # Research patterns
        research_keywords = ['research', 'find', 'search', 'what is', 'how does', 'explain', 'learn about']
        for kw in research_keywords:
            if kw in inquiry_lower:
                return 'research'
        
        # Generation patterns
        generate_keywords = ['create', 'write', 'generate', 'draft', 'compose', 'make a', 'build']
        for kw in generate_keywords:
            if kw in inquiry_lower:
                return 'generate'
        
        # Analysis patterns
        analyze_keywords = ['analyze', 'review', 'evaluate', 'compare', 'assess', 'audit', 'check']
        for kw in analyze_keywords:
            if kw in inquiry_lower:
                return 'analyze'
        
        return 'general'

    def _select_agents_for_intent(
        self, 
        intent: str, 
        agents: Dict[str, Any]
    ) -> Tuple[Optional[Any], Optional[Any]]:
        """
        Select primary and critique agents based on intent.
        
        Args:
            intent: The classified intent type
            agents: Dict mapping agent names to agent instances
            
        Returns:
            Tuple of (primary_agent, critique_agent) - critique may be None
        """
        # Agent routing table
        routing = {
            'research': ('researcher', 'alchemist'),
            'generate': ('alchemist', 'editor'),
            'analyze': ('research_engineer', 'alchemist'),
            'general': ('alchemist', None),
        }
        
        primary_name, critique_name = routing.get(intent, ('alchemist', None))
        
        primary = agents.get(primary_name)
        critique = agents.get(critique_name) if critique_name else None
        
        # Fallback: use first available agent
        if not primary and agents:
            primary = list(agents.values())[0]
            logger.warning(f"Primary agent '{primary_name}' not found, using fallback: {primary}")
        
        return primary, critique

    async def council_dispatch(
        self, 
        inquiry: str, 
        agents: Dict[str, Any],
        run_critique: bool = True
    ) -> Dict[str, Any]:
        """
        Sovereign-grade dispatch: routes inquiry to appropriate agent(s).
        
        This extends run_parallel with intelligent agent selection based on
        inquiry classification. Optionally runs a critique agent in parallel.
        
        Args:
            inquiry: The user's inquiry or task description
            agents: Dict mapping agent names to agent instances
            run_critique: Whether to run critique agent in parallel
            
        Returns:
            Dict containing:
                - intent: The classified intent
                - primary_result: Result from primary agent
                - critique_result: Result from critique agent (if run)
                - conflicts: Any detected conflicts between results
                - duration_seconds: Total execution time
        """
        start_time = time.time()
        
        # Step 1: Classify intent
        intent = self._classify_intent(inquiry)
        logger.info(f"🎯 Council dispatch: intent={intent} for: {inquiry[:80]}...")
        
        # Step 2: Select agents
        primary_agent, critique_agent = self._select_agents_for_intent(intent, agents)
        
        if not primary_agent:
            return {
                "intent": intent,
                "error": "No suitable agent found",
                "primary_result": None,
                "critique_result": None,
                "conflicts": [],
                "duration_seconds": time.time() - start_time
            }
        
        # Step 3: Get council prompt for intent
        council_prompt = get_council_prompt(intent, inquiry)
        
        # Step 4: Prepare tasks with council prompts
        tasks = [{
            "agent": primary_agent,
            "action": intent if intent != 'general' else "chat",
            "params": {
                "topic": inquiry,
                "council_prompt": council_prompt
            } if intent in ('research', 'generate') else {
                "message": inquiry,
                "council_prompt": council_prompt
            },
            "id": "primary"
        }]
        
        if run_critique and critique_agent:
            # Critique gets a placeholder for now - will be enhanced after primary completes
            critique_prompt = get_council_prompt('analyze', f"Review this inquiry: {inquiry}")
            tasks.append({
                "agent": critique_agent,
                "action": "analyze" if hasattr(critique_agent, 'analyze') else "chat",
                "params": {"message": f"Review this inquiry and provide critical perspective: {inquiry}"},
                "id": "critique"
            })
        
        # Step 4: Execute in parallel
        result = await self.run_parallel(tasks)
        
        # Step 5: Detect conflicts
        conflicts = []
        primary_result = result['results'].get('primary')
        critique_result = result['results'].get('critique')
        
        if primary_result and critique_result:
            # Simple conflict detection: check for contradiction keywords
            if isinstance(critique_result, dict):
                critique_text = str(critique_result.get('response', critique_result))
            else:
                critique_text = str(critique_result)
            
            contradiction_keywords = ['however', 'but', 'disagree', 'incorrect', 'wrong', 'issue']
            for kw in contradiction_keywords:
                if kw in critique_text.lower():
                    conflicts.append(f"Critique contains '{kw}' - possible disagreement")
                    break
        
        duration = time.time() - start_time
        logger.info(f"🏛️ Council dispatch complete in {duration:.2f}s (conflicts: {len(conflicts)})")
        
        return {
            "intent": intent,
            "primary_result": primary_result,
            "critique_result": critique_result,
            "conflicts": conflicts,
            "errors": result.get('errors', {}),
            "duration_seconds": duration
        }

# Singleton instance
_orchestrator = None

def get_orchestrator() -> AgentOrchestrator:
    """Get the global agent orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
