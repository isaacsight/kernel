"""
Verification Script for System Prompts Integration

This script verifies that:
1. The SystemPrompts class correctly generates the 5 key prompts.
2. The BaseAgent class can access these prompts via the get_metacognitive_prompt() method.
"""

import sys
import os
import unittest
from unittest.mock import MagicMock

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from admin.brain.system_prompts import SystemPrompts
from admin.brain.agent_base import BaseAgent

class TestSystemPrompts(unittest.TestCase):
    
    def setUp(self):
        # Mock dependencies for BaseAgent since we don't want to load full brain/skills
        self.original_get_memory_store = os.sys.modules.get('admin.brain.memory_store')
        
    def test_direct_prompt_access(self):
        """Verify we can call SystemPrompts methods directly."""
        print("\n[TEST] Verifying Direct Prompt Access...")
        
        council = SystemPrompts.get_grand_council_prompt()
        self.assertIn("Grand Council Protocol", council)
        print("  ✅ Grand Council Prompt")
        
        delta = SystemPrompts.get_intelligence_delta_audit_prompt()
        self.assertIn("Intelligence Delta Audit", delta)
        print("  ✅ Intelligence Delta Prompt")
        
        ledger = SystemPrompts.get_cognitive_ledger_post_mortem_prompt()
        self.assertIn("Cognitive Ledger", ledger)
        print("  ✅ Cognitive Ledger Prompt")
        
        alignment = SystemPrompts.get_sovereign_alignment_check_prompt()
        self.assertIn("Sovereign Agent Manifesto", alignment)
        print("  ✅ Sovereign Alignment Prompt")
        
        optimization = SystemPrompts.get_recursive_optimization_prompt()
        self.assertIn("Recursive Self-Optimization", optimization)
        print("  ✅ Recursive Optimization Prompt")

        active_inf = SystemPrompts.get_active_inference_ops_prompt()
        self.assertIn("Active Inference Mindset", active_inf)
        print("  ✅ Active Inference Ops Prompt")

        divergent = SystemPrompts.get_divergent_stochastics_prompt()
        self.assertIn("Divergent Stochastics", divergent)
        print("  ✅ Divergent Stochastics Prompt")

        safety = SystemPrompts.get_sovereign_safety_prompt()
        self.assertIn("White Hat Red Teamer", safety)
        print("  ✅ Sovereign Safety Prompt")

        gallery = SystemPrompts.get_gallery_curator_prompt()
        self.assertIn("The Gallery Curator", gallery)
        print("  ✅ Gallery Curator Prompt")

        ux = SystemPrompts.get_ux_heuristic_prompt()
        self.assertIn("Studio UX Heuristic Evaluation", ux)
        print("  ✅ UX Heuristic Prompt")

        weaver = SystemPrompts.get_network_weaver_prompt()
        self.assertIn("The Network Weaver", weaver)
        print("  ✅ Network Weaver Prompt")

        strategy = SystemPrompts.get_strategy_alignment_prompt()
        self.assertIn("Strategy Alignment Check", strategy)
        print("  ✅ Strategy Alignment Prompt")

        alchemist = SystemPrompts.get_alchemist_transmutation_prompt()
        self.assertIn("Alchemist's Transmutation", alchemist)
        print("  ✅ Alchemist Transmutation Prompt")

    def test_agent_integration(self):
        """Verify BaseAgent can access prompts."""
        print("\n[TEST] Verifying Agent Integration...")
        
        # We can't easily instantiate BaseAgent without filesystem artifacts, 
        # so we'll mock the __init__ to bypass loading.
        original_init = BaseAgent.__init__
        BaseAgent.__init__ = lambda self, agent_id: None
        BaseAgent.name = "TestAgent"
        
        agent = BaseAgent("test_agent")
        
        # Restore __init__ for safety
        BaseAgent.__init__ = original_init
        
        # Test helper method
        council = agent.get_metacognitive_prompt('grand_council')
        self.assertIn("Grand Council Protocol", council)
        print("  ✅ Agent successfully retrieved 'grand_council'")
        
        delta = agent.get_metacognitive_prompt('intelligence_delta', code_or_plan="print('hello')")
        self.assertIn("print('hello')", delta)
        print("  ✅ Agent successfully retrieved 'intelligence_delta' with context")
        
        unknown = agent.get_metacognitive_prompt('invalid_type')
        self.assertEqual(unknown, "")
        print("  ✅ Agent handled invalid prompt type gracefully")

if __name__ == '__main__':
    unittest.main()
