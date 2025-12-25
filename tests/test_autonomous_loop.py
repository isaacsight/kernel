import unittest
from unittest.mock import MagicMock, patch
import os
import sys
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin import core

class TestAutonomousLoop(unittest.IsolatedAsyncioTestCase):
    @patch('admin.engineers.alchemist.Alchemist')
    @patch('admin.engineers.guardian.Guardian')
    @patch('admin.engineers.editor.Editor')
    @patch('admin.engineers.librarian.Librarian')
    @patch('admin.core.save_post')
    @patch('admin.core.get_posts')
    async def test_generate_ai_post_flow(self, mock_get_posts, mock_save_post, MockLibrarian, MockEditor, MockGuardian, MockAlchemist):
        # Setup Mocks
        mock_alchemist_instance = MockAlchemist.return_value
        mock_alchemist_instance.generate = unittest.mock.AsyncMock(return_value=("This is a safe test post content.", {}))
        mock_alchemist_instance.memory_file = "dummy_memory.json"
        
        mock_guardian_instance = MockGuardian.return_value
        mock_guardian_instance.audit_content.return_value = [] # No issues
        
        mock_editor_instance = MockEditor.return_value
        mock_editor_instance.audit = unittest.mock.AsyncMock(return_value=[]) # No style issues
        
        mock_librarian_instance = MockLibrarian.return_value
        
        mock_save_post.return_value = "ai-test-topic.md"
        mock_get_posts.return_value = [{'title': 'Test', 'slug': 'test'}]

        # Execute
        filename = await core.generate_ai_post("Test Topic")
        
        # Verify Alchemist called
        mock_alchemist_instance.generate.assert_called()
        
        # Verify Guardian called
        mock_guardian_instance.audit_content.assert_called_with("This is a safe test post content.")
        
        # Verify Editor called
        mock_editor_instance.audit.assert_called_with("This is a safe test post content.")
        
        # Verify Librarian called
        mock_librarian_instance.build_graph.assert_called()
        mock_librarian_instance.export_graph.assert_called()
        
        print("Autonomous Loop Verification Passed!")

if __name__ == '__main__':
    unittest.main()
