import sys
import json
import os
import logging
from typing import Any, Dict, Optional

# Configuration
KNOWLEDGE_BASE_PATH = "/Users/isaachernandez/.gemini/antigravity/knowledge/studio_os"
SERVER_NAME = "StudioOS-ContextBridge"

logging.basicConfig(level=logging.ERROR, stream=sys.stderr)
logger = logging.getLogger(SERVER_NAME)

class MCPServer:
    def __init__(self):
        self.tools = {
            "list_knowledge_artifacts": self.list_artifacts,
            "read_knowledge_artifact": self.read_artifact
        }

    def run(self):
        """Main loop: Read line from stdin, process, write line to stdout."""
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                
                request = json.loads(line)
                response = self.handle_request(request)
                if response:
                    print(json.dumps(response), flush=True)

            except json.JSONDecodeError:
                continue
            except Exception as e:
                logger.error(f"Error details: {e}")
                continue

    def handle_request(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        method = request.get("method")
        msg_id = request.get("id")
        params = request.get("params", {})

        # 1. Initialize Handshake
        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {},
                        "resources": {}
                    },
                    "serverInfo": {
                        "name": SERVER_NAME,
                        "version": "1.0.0"
                    }
                }
            }
        
        # 2. Handshake Acknowledgement
        if method == "notifications/initialized":
            return None

        # 3. List Tools
        if method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "tools": [
                        {
                            "name": "list_knowledge_artifacts",
                            "description": "Lists all markdown files in the Studio OS Knowledge Base",
                            "inputSchema": {
                                "type": "object",
                                "properties": {}
                            }
                        },
                        {
                            "name": "read_knowledge_artifact",
                            "description": "Reads a specific markdown artifact",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "artifact_path": {"type": "string", "description": "Relative path to the .md file"}
                                },
                                "required": ["artifact_path"]
                            }
                        }
                    ]
                }
            }

        # 4. Call Tool
        if method == "tools/call":
            tool_name = params.get("name")
            args = params.get("arguments", {})
            
            if tool_name in self.tools:
                try:
                    result_content = self.tools[tool_name](**args)
                    return {
                        "jsonrpc": "2.0",
                        "id": msg_id,
                        "result": {
                            "content": [
                                {"type": "text", "text": str(result_content)}
                            ],
                            "isError": False
                        }
                    }
                except Exception as e:
                    return {
                        "jsonrpc": "2.0",
                        "id": msg_id,
                        "error": {"code": -32000, "message": str(e)}
                    }
            
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {"code": -32601, "message": "Method not found"}
            }

        # 5. List Resources (Optional, but good for MCP)
        if method == "resources/list":
             return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "resources": [] 
                }
            }

        # Default: Method not found
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "error": {"code": -32601, "message": "Method not handled"}
        }

    # --- Tool Implementations ---
    
    def list_artifacts(self) -> str:
        artifacts_dir = os.path.join(KNOWLEDGE_BASE_PATH, "artifacts")
        if not os.path.exists(artifacts_dir):
            return "Error: Artifacts directory not found."
        
        files = []
        for root, _, filenames in os.walk(artifacts_dir):
            for filename in filenames:
                if filename.endswith(".md"):
                    full_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(full_path, artifacts_dir)
                    files.append(rel_path)
        return json.dumps(sorted(files), indent=2)

    def read_artifact(self, artifact_path: str) -> str:
        if ".." in artifact_path or artifact_path.startswith("/"):
            return "Error: Invalid path security violation."
            
        full_path = os.path.join(KNOWLEDGE_BASE_PATH, "artifacts", artifact_path)
        if not os.path.exists(full_path):
            return f"Error: File not found at {artifact_path}"
            
        with open(full_path, 'r', encoding='utf-8') as f:
            return f.read()

if __name__ == "__main__":
    server = MCPServer()
    server.run()
