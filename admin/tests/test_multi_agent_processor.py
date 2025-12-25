import asyncio
import unittest
import time
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from admin.brain.multi_agent_processor import AgentOrchestrator

class MockAgent:
    def __init__(self, name, delay=1.0):
        self.name = name
        self.delay = delay
        self.call_count = 0

    async def execute(self, action, **params):
        self.call_count += 1
        await asyncio.sleep(self.delay)
        return {"status": "success", "agent": self.name, "action": action}

class TestMultiAgentProcessor(unittest.IsolatedAsyncioTestCase):
    async def test_parallel_execution(self):
        orchestrator = AgentOrchestrator()
        
        agent_a = MockAgent("AgentA", delay=1.0)
        agent_b = MockAgent("AgentB", delay=1.0)
        agent_c = MockAgent("AgentC", delay=1.0)
        
        tasks = [
            {"agent": agent_a, "action": "test", "id": "A"},
            {"agent": agent_b, "action": "test", "id": "B"},
            {"agent": agent_c, "action": "test", "id": "C"}
        ]
        
        start_time = time.time()
        result_data = await orchestrator.run_parallel(tasks)
        duration = time.time() - start_time
        
        # Verify results
        self.assertEqual(len(result_data['results']), 3)
        self.assertEqual(result_data['results']['A']['agent'], "AgentA")
        self.assertEqual(result_data['results']['B']['agent'], "AgentB")
        self.assertEqual(result_data['results']['C']['agent'], "AgentC")
        
        # Verify parallelism: 3 tasks of 1s each should take ~1s in parallel, not 3s
        self.assertLess(duration, 1.5, f"Execution took too long: {duration:.2f}s (should be ~1s)")
        self.assertGreater(duration, 0.9, f"Execution was too fast: {duration:.2f}s (should be >1s)")
        
        # Verify call counts
        self.assertEqual(agent_a.call_count, 1)
        self.assertEqual(agent_b.call_count, 1)
        self.assertEqual(agent_c.call_count, 1)

    async def test_mixed_sync_async(self):
        orchestrator = AgentOrchestrator()
        
        class SyncAgent:
            def __init__(self):
                self.name = "SyncAgent"
            def execute(self, action, **params):
                time.sleep(1.0)
                return "sync_result"
                
        async_agent = MockAgent("AsyncAgent", delay=1.0)
        sync_agent = SyncAgent()
        
        tasks = [
            {"agent": async_agent, "action": "test", "id": "async"},
            {"agent": sync_agent, "action": "test", "id": "sync"}
        ]
        
        start_time = time.time()
        result_data = await orchestrator.run_parallel(tasks)
        duration = time.time() - start_time
        
        self.assertEqual(result_data['results']['async']['status'], "success")
        self.assertEqual(result_data['results']['sync'], "sync_result")
        
        # Both should run in ~1s since sync is in a thread
        self.assertLess(duration, 1.5)

    async def test_error_handling(self):
        orchestrator = AgentOrchestrator()
        
        class FailingAgent:
            def __init__(self): self.name = "FailingAgent"
            async def execute(self, action, **params):
                raise ValueError("Planned failure")
                
        agent_ok = MockAgent("OkAgent", delay=0.5)
        agent_fail = FailingAgent()
        
        tasks = [
            {"agent": agent_ok, "action": "test", "id": "ok"},
            {"agent": agent_fail, "action": "test", "id": "fail"}
        ]
        
        result_data = await orchestrator.run_parallel(tasks)
        
        self.assertIsNotNone(result_data['results']['ok'])
        self.assertIsNone(result_data['results']['fail'])
        self.assertIn("Planned failure", result_data['errors']['fail'])

if __name__ == "__main__":
    unittest.main()
