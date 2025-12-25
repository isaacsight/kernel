"""
Antigravity Engineer - Core Kernel & Intelligence Engineer

The central orchestrator of the Studio OS agent swarm. Responsible for 
high-level reasoning, system coordination, and automated research & development.
Inspired by the Antigravity VS Code extension architecture.

"""

import os
import sys
import logging
import asyncio
import subprocess
from typing import Dict, Any, List, Optional

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    import google.generativeai as genai
except ImportError:
    genai = None

from admin.brain.agent_base import BaseAgent
from admin.config import config

logger = logging.getLogger("AntigravityEngineer")


# ============================================================================
# Tool Definitions for Gemini Function Calling
# These are defined as functions that will be passed to Gemini
# ============================================================================

def read_file_tool(path: str) -> dict:
    """Read the contents of a file at the given path.
    
    Args:
        path: The absolute or relative path to the file
    """
    pass  # Implementation is in the class


def write_file_tool(path: str, content: str) -> dict:
    """Write content to a file. Creates the file if it doesn't exist.
    
    Args:
        path: The path to the file
        content: The content to write to the file
    """
    pass


def list_directory_tool(path: str) -> dict:
    """List the contents of a directory.
    
    Args:
        path: The path to the directory
    """
    pass


def run_command_tool(command: str, cwd: str = None) -> dict:
    """Execute a shell command and return the output.
    
    Args:
        command: The shell command to execute
        cwd: Optional working directory for the command
    """
    pass


def search_codebase_tool(pattern: str, path: str = None) -> dict:
    """Search for a pattern in the codebase using grep.
    
    Args:
        pattern: The search pattern (regex supported)
        path: Directory to search in (defaults to project root)
    """
    pass


def task_complete_tool(summary: str) -> dict:
    """Signal that the task is complete and provide a summary.
    
    Args:
        summary: A summary of what was accomplished
    """
    pass


# Tool list for Gemini
TOOL_FUNCTIONS = [
    read_file_tool,
    write_file_tool,
    list_directory_tool,
    run_command_tool,
    search_codebase_tool,
    task_complete_tool
]


class AntigravityEngineer(BaseAgent):
    """
    Core Kernel Agent and Intelligence Engineer.
    
    Acts as the orchestrator of the Studio OS swarm, using Gemini function 
    calling to execute multi-step coding, research, and system tasks.
    """
    
    MAX_ITERATIONS = 20  # Safety limit on execution loops
    
    def __init__(self):
        try:
            super().__init__(agent_id="antigravity")
        except ValueError:
            # Fallback if profile doesn't exist
            self.name = "Antigravity"
            self.role = "Autonomous Coding Agent"
            self.system_prompt = "You are an autonomous coding agent."
            self.enabled_skills = []
            logger.warning("[AntigravityEngineer] Profile not found, using fallback.")
        
        self.project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self._configure_gemini()
        
    def _configure_gemini(self):
        """Configure the Gemini SDK with API key."""
        if not genai:
            logger.error("[AntigravityEngineer] google-generativeai not installed")
            self.model = None
            return
            
        api_key = config.GEMINI_API_KEY if hasattr(config, 'GEMINI_API_KEY') else os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.error("[AntigravityEngineer] GEMINI_API_KEY not configured")
            self.model = None
            return
            
        genai.configure(api_key=api_key)
        
        # Use gemini-1.5-flash for speed and cost efficiency
        model_name = getattr(config, 'GEMINI_MODEL', 'gemini-1.5-flash')
        
        try:
            self.model = genai.GenerativeModel(
                model_name=model_name,
                tools=TOOL_FUNCTIONS,
                system_instruction=self.get_system_prompt() if hasattr(self, 'get_system_prompt') else self.system_prompt
            )
            logger.info(f"[{self.name}] Configured with {model_name}")
        except Exception as e:
            logger.error(f"[AntigravityEngineer] Failed to configure model: {e}")
            self.model = None
    
    # ========================================================================
    # Tool Implementations
    # ========================================================================
    
    def _resolve_path(self, path: str) -> str:
        """Resolve relative paths to absolute paths."""
        if os.path.isabs(path):
            return path
        return os.path.join(self.project_root, path)
    
    def _read_file(self, path: str) -> Dict[str, Any]:
        """Read contents of a file."""
        full_path = self._resolve_path(path)
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return {"success": True, "content": content, "path": full_path}
        except FileNotFoundError:
            return {"success": False, "error": f"File not found: {full_path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _write_file(self, path: str, content: str) -> Dict[str, Any]:
        """Write content to a file."""
        full_path = self._resolve_path(path)
        try:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            logger.info(f"[{self.name}] Wrote to {full_path}")
            return {"success": True, "path": full_path, "bytes_written": len(content)}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _list_directory(self, path: str) -> Dict[str, Any]:
        """List contents of a directory."""
        full_path = self._resolve_path(path)
        try:
            entries = []
            for entry in os.listdir(full_path):
                entry_path = os.path.join(full_path, entry)
                entries.append({
                    "name": entry,
                    "type": "directory" if os.path.isdir(entry_path) else "file"
                })
            return {"success": True, "path": full_path, "entries": entries}
        except FileNotFoundError:
            return {"success": False, "error": f"Directory not found: {full_path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _run_command(self, command: str, cwd: Optional[str] = None) -> Dict[str, Any]:
        """Execute a shell command."""
        work_dir = self._resolve_path(cwd) if cwd else self.project_root
        
        # Safety check - block dangerous commands
        dangerous_patterns = ['rm -rf /', 'rm -rf ~', '> /dev/sda', 'mkfs', ':(){:|:&};:']
        if any(pattern in command for pattern in dangerous_patterns):
            return {"success": False, "error": "Command blocked for safety reasons"}
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=60  # 60 second timeout
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout[:5000],  # Limit output size
                "stderr": result.stderr[:2000],
                "exit_code": result.returncode
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Command timed out after 60 seconds"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _search_codebase(self, pattern: str, path: Optional[str] = None) -> Dict[str, Any]:
        """Search for a pattern in the codebase."""
        search_path = self._resolve_path(path) if path else self.project_root
        try:
            result = subprocess.run(
                ["grep", "-rn", "--include=*.py", "--include=*.js", "--include=*.ts", 
                 "--include=*.html", "--include=*.css", "--include=*.md", pattern, search_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            matches = result.stdout.strip().split('\n')[:20]  # Limit to 20 matches
            return {
                "success": True,
                "matches": [m for m in matches if m],
                "count": len([m for m in matches if m])
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _execute_tool(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name with given arguments."""
        tool_map = {
            "read_file": lambda: self._read_file(args.get("path", "")),
            "write_file": lambda: self._write_file(args.get("path", ""), args.get("content", "")),
            "list_directory": lambda: self._list_directory(args.get("path", ".")),
            "run_command": lambda: self._run_command(args.get("command", ""), args.get("cwd")),
            "search_codebase": lambda: self._search_codebase(args.get("pattern", ""), args.get("path")),
            "task_complete": lambda: {"success": True, "complete": True, "summary": args.get("summary", "Task complete")}
        }
        
        executor = tool_map.get(tool_name)
        if not executor:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
        
        return executor()
    
    # ========================================================================
    # Main Execution Loop
    # ========================================================================
    
    async def execute(self, task: str) -> str:
        """
        Execute a coding task using the agentic loop.
        
        Args:
            task: Natural language description of what to accomplish
            
        Returns:
            Summary of what was done
        """
        if not self.model:
            return "Error: Gemini model not configured. Check GEMINI_API_KEY."
        
        logger.info(f"[{self.name}] Starting task: {task[:100]}...")
        
        # Start a chat with the task
        chat = self.model.start_chat()
        
        try:
            response = chat.send_message(f"Execute this task: {task}")
        except Exception as e:
            return f"Error starting task: {e}"
        
        iterations = 0
        
        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            
            # Check if model wants to call a function
            if not response.candidates:
                return "No response from model"
            
            candidate = response.candidates[0]
            
            # Check for function calls
            if candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        fc = part.function_call
                        tool_name = fc.name
                        args = dict(fc.args) if fc.args else {}
                        
                        logger.info(f"[{self.name}] Calling tool: {tool_name}")
                        
                        # Execute the tool
                        result = self._execute_tool(tool_name, args)
                        
                        # Check if task is complete
                        if result.get("complete"):
                            logger.info(f"[{self.name}] Task complete!")
                            return result.get("summary", "Task completed successfully")
                        
                        # Send result back to model
                        try:
                            response = chat.send_message(
                                genai.protos.Content(
                                    parts=[genai.protos.Part(
                                        function_response=genai.protos.FunctionResponse(
                                            name=tool_name,
                                            response={"result": result}
                                        )
                                    )]
                                )
                            )
                        except Exception as e:
                            return f"Error sending tool result: {e}"
                        
                        break  # Process one tool at a time
                    
                    elif hasattr(part, 'text') and part.text:
                        # Model provided a text response - might be done
                        text = part.text
                        if "complete" in text.lower() or "finished" in text.lower() or "done" in text.lower():
                            return text
                        # Otherwise keep going
                        break
            else:
                # No parts, might be done
                break
        
        return f"Task execution stopped after {iterations} iterations"
    
    def run(self, input_text: str) -> str:
        """Synchronous entry point."""
        return asyncio.run(self.execute(input_text))


# ============================================================================
# Module Test
# ============================================================================

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    agent = AntigravityEngineer()
    
    # Simple test
    result = agent.run("List the files in the scripts directory")
    print(f"Result: {result}")
