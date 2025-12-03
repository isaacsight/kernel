
import sys
import os
import logging

# Add project root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)
print(f"Added {project_root} to sys.path")

# Mocking requests to avoid actual network calls during this specific test if needed,
# but for now let's try to actually run it if the node is available.
# If not, we might need to mock the LLM response.
# Let's assume the node might NOT be available and mock the Architect's LLM call for reliability in this test.

from unittest.mock import MagicMock, patch
from admin.engineers.operator import Operator

# Configure logging to stdout
logging.basicConfig(level=logging.INFO, stream=sys.stdout)

def test_evolution_cycle():
    print("\n--- Starting Evolution Cycle Test ---\n")
    
    # Mock the Architect's network call to return a safe, valid blueprint
    with patch('requests.post') as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": '```json\n{\n    "plan_summary": "Adding a test comment to core.py",\n    "changes": [\n        {\n            "file": "admin/core.py",\n            "action": "modify",\n            "search": "import os",\n            "replace": "import os\\n# Evolution Test Comment"\n        }\n    ]\n}\n```'
        }
        mock_post.return_value = mock_response
        
        operator = Operator()
        # Force a specific mission for the test (mocking Visionary.dream would be cleaner but this works via the loop)
        # Actually, let's just run evolve() and let it use the random mission, 
        # but since we mocked the Architect, the mission doesn't matter much for the *result* of the blueprint.
        
        report = operator.evolve()
        
        print("\n--- Evolution Report ---\n")
        print(report)
        
        if "Evolution Cycle Complete" in report or "System Validation: System integrity verified" in report:
            print("\nSUCCESS: Evolution cycle completed.")
        else:
            print("\nFAILURE: Evolution cycle did not complete as expected.")

if __name__ == "__main__":
    test_evolution_cycle()
