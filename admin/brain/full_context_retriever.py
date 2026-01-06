import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("FullContextRetriever")

class FullContextRetriever:
    """
    Retriever for 'Large-Context Bypassing'.
    Loads raw contents of files and directories for direct ingestion into massive context windows.
    """

    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_context(self, include_paths: List[str], exclude_extensions: Optional[List[str]] = None, max_file_size_kb: int = 1024) -> str:
        """
        Collects text content from specified paths within the base directory.
        """
        exclude_extensions = exclude_extensions or [
            '.pyc', '.png', '.jpg', '.jpeg', '.pdf', '.zip', '.exe', '.bin',
            '.db', '.db-shm', '.db-wal', '.sqlite', '.log', '.tmp', '.json',
            '.pyo', '.so', '.dylib', '.dll', '.woff', '.woff2', '.ttf', '.eot'
        ]
        context_parts = []

        for rel_path in include_paths:
            full_path = os.path.join(self.base_path, rel_path)
            if not os.path.exists(full_path):
                logger.warning(f"Path not found: {full_path}")
                continue

            if os.path.isfile(full_path):
                content = self._read_file(full_path, exclude_extensions, max_file_size_kb)
                if content:
                    context_parts.append(f"--- FILE: {rel_path} ---\n{content}\n")
            elif os.path.isdir(full_path):
                for root, dirs, files in os.walk(full_path):
                    # Filter out noise directories
                    dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['__pycache__', 'node_modules', 'venv', '.env', 'AnimatedDrawings']]
                    
                    for file in files:
                        file_path = os.path.join(root, file)
                        rel_file_path = os.path.relpath(file_path, self.base_path)
                        content = self._read_file(file_path, exclude_extensions, max_file_size_kb)
                        if content:
                            context_parts.append(f"--- FILE: {rel_file_path} ---\n{content}\n")

        return "\n".join(context_parts)

    def _read_file(self, file_path: str, exclude_extensions: List[str], max_file_size_kb: int) -> str:
        if any(file_path.endswith(ext) for ext in exclude_extensions):
            return ""
        
        # Check file size
        try:
            # Skip if file is too large
            if os.path.getsize(file_path) > max_file_size_kb * 1024:
                logger.info(f"Skipping Large File: {file_path}")
                return ""
                
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                # Basic binary check: check if null bytes are present in the first 1KB
                if '\x00' in content[:1024]:
                    logger.info(f"Skipping Binary File: {file_path}")
                    return ""
                return content
        except Exception as e:
            logger.error(f"Failed to read {file_path}: {e}")
            return ""

    def get_system_context(self) -> str:
        """
        Standard 'Deep Research' context for the DTFR project.
        """
        # We target specific core paths but the new logic will protect us from .db files etc.
        core_paths = ['admin/brain', 'admin/engineers', 'dtfr', 'static/css/v2_1_ai_native_specs.md', 'CLAUDE.md']
        return self.get_context(core_paths)
