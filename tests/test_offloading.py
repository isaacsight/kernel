import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
# Add admin directory to path for direct imports if needed, but root is better for 'admin.x' imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../admin')))

from admin.engineers.alchemist import Alchemist
from admin.engineers.guardian import Guardian

class TestOffloading(unittest.TestCase):
    def setUp(self):
        # Mock environment variables
        self.env_patcher = patch.dict(os.environ, {
            "STUDIO_NODE_URL": "http://mock-node:8000",
            "GEMINI_API_KEY": "mock-key"
        })
        self.env_patcher.start()

    def tearDown(self):
        self.env_patcher.stop()

    @patch('requests.post')
    def test_alchemist_remote_embedding(self, mock_post):
        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": [0.1, 0.2, 0.3]}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        alchemist = Alchemist()
        # We need to mock build_memory's file reading part or just test the embedding logic directly if possible.
        # Since build_memory is complex, let's test the retrieval logic which also uses embeddings.
        
        # Test retrieve (query embedding)
        with patch('google.generativeai.embed_content') as mock_local_embed, \
             patch.object(Alchemist, 'load_memory') as mock_load_memory:
            
            # Mock memory with matching dimension (3)
            mock_load_memory.return_value = [{
                'title': 'Test Post',
                'embedding': [0.1, 0.2, 0.3],
                'excerpt': 'test'
            }]

            alchemist.retrieve("test query")
            
            # Should have called requests.post, NOT local embed
            mock_post.assert_called()
            args, kwargs = mock_post.call_args
            self.assertEqual(kwargs['json']['model'], 'nomic-embed-text')
            self.assertEqual(kwargs['json']['prompt'], 'test query')
            
            mock_local_embed.assert_not_called()

    @patch('requests.post')
    def test_guardian_remote_audit(self, mock_post):
        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "audit": {
                "safe": False, 
                "issues": ["Mock Issue"]
            }
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        guardian = Guardian()
        issues = guardian.audit_content("suspicious content")
        
        # Should have called requests.post
        mock_post.assert_called()
        
        # Should have found the remote issue
        self.assertTrue(any(i['rule'] == 'AI Safety (Remote)' for i in issues))
        self.assertTrue(any('Mock Issue' in i['message'] for i in issues))

if __name__ == '__main__':
    unittest.main()
