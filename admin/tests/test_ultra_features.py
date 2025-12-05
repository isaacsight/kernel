
import unittest
from unittest.mock import MagicMock, patch
import sys
import os
import json

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from admin.engineers.communication_analyzer import CommunicationAnalyzer

class TestUltraFeatures(unittest.TestCase):
    
    def setUp(self):
        # Mock config to avoid API key issues
        with patch('admin.engineers.communication_analyzer.config') as mock_config:
            mock_config.GEMINI_API_KEY = "fake_key"
            self.analyzer = CommunicationAnalyzer()
            
            # Mock the model to avoid real calls
            self.analyzer.model = MagicMock()
            
            # Mock data
            self.analyzer.data = {
                "conversations": [
                    {"timestamp": "2023-01-01", "user_input": "hi", "detected_intent": "greeting", "execution_success": True}
                ],
                "analytics": {
                    "ecosystem_stats": {
                        "last_drive_backup": None,
                        "archived_logs_count": 0
                    }
                }
            }

    def test_deep_think_trigger(self):
        """Verify Deep Think calls model and triggers ecosystem sync."""
        
        # Setup mock response
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "deep_thinking_trace": "Thinking...",
            "personality_profile": "Test User",
            "strategic_initiatives": [],
            "predictions": [],
            "health_velocity": 0.5
        })
        self.analyzer.model.generate_content.return_value = mock_response
        
        # Execute
        result = self.analyzer.generate_deep_insights()
        
        # Verify model was called
        self.analyzer.model.generate_content.assert_called_once()
        
        # Verify result structure
        self.assertIn("deep_thinking_trace", result)
        self.assertEqual(result["health_velocity"], 0.5)
        
        # Verify Ecosystem Sync was triggered
        self.assertTrue(self.analyzer.drive_connected)
        self.assertTrue(self.analyzer.docs_connected)
        self.assertIsNotNone(self.analyzer.data["analytics"]["ecosystem_stats"]["last_drive_backup"])
        self.assertIsNotNone(self.analyzer.data["analytics"]["ecosystem_stats"]["last_report_generated"])

    def test_drive_archival(self):
        """Verify drive archival updates stats."""
        initial_count = self.analyzer.data["analytics"]["ecosystem_stats"]["archived_logs_count"]
        self.analyzer.archive_logs_to_drive()
        new_count = self.analyzer.data["analytics"]["ecosystem_stats"]["archived_logs_count"]
        
        self.assertTrue(new_count > initial_count)
        self.assertTrue(self.analyzer.drive_connected)

if __name__ == '__main__':
    unittest.main()
