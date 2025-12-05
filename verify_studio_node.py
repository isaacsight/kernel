"""
Verification script for Studio Node Upgrade.
Tests Model Router in Node mode and simulates Sync.
"""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch
import json
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from admin.brain.model_router import ModelRouter, TaskType, Environment
from admin.brain.collective_intelligence import CollectiveIntelligence
from admin.brain.node_sync import NodeSyncManager

class TestStudioNodeUpgrade(unittest.TestCase):
    
    def test_model_router_node_mode(self):
        """Test that ModelRouter detects Node environment correctly."""
        print("\n--- Testing Model Router (Node Mode) ---")
        
        # Simulate Node Environment
        with patch.dict(os.environ, {"STUDIO_NODE_ROLE": "node"}):
            router = ModelRouter()
            print(f"Detected Environment: {router.env}")
            self.assertEqual(router.env, Environment.NODE)
            
            # Verify it doesn't try to check remote node (recursion prevention)
            # We can't easily check the internal logic without mocking, 
            # but we can check if it prioritizes local models.
            
            # Mock availability
            router.models["mistral"]["available"] = True
            
            selection = router.select_model(TaskType.CHAT, constraints={"prefer_local": True})
            print(f"Selected Model: {selection['selected']}")
            self.assertEqual(selection['type'], "local")

    def test_collective_intelligence_sync(self):
        """Test merging knowledge."""
        print("\n--- Testing Collective Intelligence Sync ---")
        
        ci = CollectiveIntelligence()
        
        # Create dummy external knowledge
        external_knowledge = {
            "shared_insights": [
                {
                    "from_agent": "RemoteAgent",
                    "type": "test_insight",
                    "insight": "Remote works!",
                    "confidence": 0.9,
                    "shared_at": datetime.now().isoformat()
                }
            ],
            "lessons_learned": [],
            "team_decisions": []
        }
        
        # Merge
        added = ci.merge_knowledge(external_knowledge)
        print(f"Added items: {added}")
        
        self.assertEqual(added["insights"], 1)
        
        # Verify it's in the knowledge base
        insights = ci.get_insights("test_insight")
        self.assertTrue(any(i["from_agent"] == "RemoteAgent" for i in insights))

    @patch("requests.post")
    @patch("requests.get")
    def test_node_sync_manager(self, mock_get, mock_post):
        """Test NodeSyncManager logic."""
        print("\n--- Testing Node Sync Manager ---")
        
        # Mock responses
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"added": {"insights": 1}}
        
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "updates": {
                "shared_insights": [{
                    "from_agent": "NodeAgent",
                    "type": "sync_test",
                    "insight": "Sync works",
                    "confidence": 1.0,
                    "shared_at": datetime.now().isoformat()
                }]
            }
        }
        
        manager = NodeSyncManager()
        manager.node_url = "http://mock-node:8000"
        
        results = manager.sync()
        print(f"Sync Results: {results}")
        
        self.assertEqual(results["pushed"]["insights"], 1)
        self.assertIn("insights", results["pulled"])

if __name__ == "__main__":
    unittest.main()
