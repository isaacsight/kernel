import os
import sys
import glob
import json
import logging
from typing import List, Optional
from mcp.server.fastmcp import FastMCP

# Configuration
KNOWLEDGE_BASE_PATH = "/Users/isaachernandez/.gemini/antigravity/knowledge/studio_os"
SERVER_NAME = "StudioOS-ContextBridge"

# Initialize FastMCP Server
mcp = FastMCP(SERVER_NAME)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(SERVER_NAME)

@mcp.tool()
def list_knowledge_artifacts() -> List[str]:
    """
    Lists all available markdown artifacts in the Studio OS Knowledge Base.
    Returns relative paths to the artifacts.
    """
    artifacts_dir = os.path.join(KNOWLEDGE_BASE_PATH, "artifacts")
    if not os.path.exists(artifacts_dir):
        return ["Error: Artifacts directory not found."]
    
    files = []
    # Recursive search for .md files
    for root, _, filenames in os.walk(artifacts_dir):
        for filename in filenames:
            if filename.endswith(".md"):
                full_path = os.path.join(root, filename)
                rel_path = os.path.relpath(full_path, artifacts_dir)
                files.append(rel_path)
    
    return sorted(files)

@mcp.tool()
def read_knowledge_artifact(artifact_path: str) -> str:
    """
    Reads the content of a specific knowledge artifact.
    Args:
        artifact_path: The relative path to the artifact (e.g., 'master_framework.md')
    """
    # Security check: Prevent path traversal
    if ".." in artifact_path or artifact_path.startswith("/"):
        return "Error: Invalid artifact path. Use relative paths only."

    full_path = os.path.join(KNOWLEDGE_BASE_PATH, "artifacts", artifact_path)
    
    if not os.path.exists(full_path):
        return f"Error: Artifact not found at {artifact_path}"
        
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content
    except Exception as e:
        return f"Error reading artifact: {str(e)}"

@mcp.resource("studio://knowledge/summary")
def get_knowledge_summary() -> str:
    """
    Returns a high-level summary of the knowledge base structure.
    """
    return f"""
    # Studio OS Knowledge Base
    Location: {KNOWLEDGE_BASE_PATH}
    
    This is the authoritative source for the Studio OS architecture (Hub-and-Spoke),
    Sovereign Governance models, and the Antigravity System.
    
    Available Sections:
    - Implementation Plans
    - Operational Manuals
    - Architectural Whitepapers
    """

if __name__ == "__main__":
    # Standard MCP entry point
    mcp.run()
