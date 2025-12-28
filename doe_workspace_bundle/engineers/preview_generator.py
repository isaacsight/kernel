"""
Preview Generator - Live Preview URL Generation

Inspired by GitHub Spark's instant preview feature.
Generates preview URLs for content before publishing.
"""

import os
import json
import shutil
import logging
import subprocess
import threading
import http.server
import socketserver
from datetime import datetime
from typing import Dict, List, Optional, Any
import tempfile

logger = logging.getLogger("PreviewGenerator")


class PreviewGenerator:
    """
    The Preview Generator (Visual Validator)
    
    Mission: Provide instant visual previews of content changes
    before they go live.
    
    Inspired by GitHub Spark's live preview feature.
    
    Responsibilities:
    - Generate preview builds
    - Serve preview URLs
    - Create shareable preview links
    - Capture screenshots of previews
    """
    
    def __init__(self):
        self.name = "The Preview Generator"
        self.role = "Visual Validator"
        self.emoji = "👁️"
        
        # Paths
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.preview_dir = os.path.join(self.base_dir, '.previews')
        self.docs_dir = os.path.join(self.base_dir, 'docs')
        
        # Server state
        self.server = None
        self.server_thread = None
        self.current_port = None
        
        # Preview history
        self.history_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'brain', 'preview_history.json'
        )
        self.history = self._load_history()
        
        logger.info(f"[{self.name}] Initialized")
    
    def _load_history(self) -> list:
        """Load preview history."""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return []
    
    def _save_history(self):
        """Save preview history."""
        os.makedirs(os.path.dirname(self.history_file), exist_ok=True)
        # Keep last 50 previews
        with open(self.history_file, 'w') as f:
            json.dump(self.history[-50:], f, indent=2)
    
    def build_preview(self, changes: Dict = None) -> Dict:
        """
        Build a preview version of the site.
        
        Args:
            changes: Optional dict with specific changes to preview
            
        Returns: Build result with preview path
        """
        logger.info(f"[{self.name}] Building preview...")
        
        preview_id = f"preview-{int(datetime.now().timestamp())}"
        preview_path = os.path.join(self.preview_dir, preview_id)
        os.makedirs(preview_path, exist_ok=True)
        
        try:
            # Run the build script
            build_script = os.path.join(self.base_dir, 'build.py')
            
            if os.path.exists(build_script):
                result = subprocess.run(
                    ['python3', build_script],
                    cwd=self.base_dir,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                if result.returncode != 0:
                    logger.warning(f"[{self.name}] Build had warnings: {result.stderr[:200]}")
            
            # Copy docs to preview directory
            if os.path.exists(self.docs_dir):
                for item in os.listdir(self.docs_dir):
                    src = os.path.join(self.docs_dir, item)
                    dst = os.path.join(preview_path, item)
                    if os.path.isdir(src):
                        shutil.copytree(src, dst, dirs_exist_ok=True)
                    else:
                        shutil.copy2(src, dst)
            
            # Record in history
            preview_record = {
                "id": preview_id,
                "created_at": datetime.now().isoformat(),
                "path": preview_path,
                "changes": changes,
                "status": "ready"
            }
            self.history.append(preview_record)
            self._save_history()
            
            logger.info(f"[{self.name}] Preview built: {preview_id}")
            
            return {
                "success": True,
                "preview_id": preview_id,
                "path": preview_path,
                "message": "Preview built successfully"
            }
            
        except Exception as e:
            logger.error(f"[{self.name}] Build failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def serve_preview(self, preview_id: str = None, port: int = 8080) -> Dict:
        """
        Start a local server to serve the preview.
        
        Args:
            preview_id: ID of preview to serve (latest if None)
            port: Port to serve on
            
        Returns: Server info with URL
        """
        # Find preview to serve
        if preview_id:
            preview_path = os.path.join(self.preview_dir, preview_id)
        elif self.history:
            preview_path = self.history[-1]["path"]
        else:
            # Serve docs directly
            preview_path = self.docs_dir
        
        if not os.path.exists(preview_path):
            return {"success": False, "error": "Preview not found"}
        
        # Stop existing server
        if self.server:
            self.stop_preview()
        
        # Find available port
        import socket
        for p in range(port, port + 100):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.bind(('localhost', p))
                sock.close()
                port = p
                break
            except:
                continue
        
        # Start server
        os.chdir(preview_path)
        
        handler = http.server.SimpleHTTPRequestHandler
        self.server = socketserver.TCPServer(("", port), handler)
        self.current_port = port
        
        self.server_thread = threading.Thread(target=self.server.serve_forever)
        self.server_thread.daemon = True
        self.server_thread.start()
        
        url = f"http://localhost:{port}"
        
        logger.info(f"[{self.name}] Preview serving at {url}")
        
        return {
            "success": True,
            "url": url,
            "port": port,
            "preview_path": preview_path
        }
    
    def stop_preview(self):
        """Stop the preview server."""
        if self.server:
            self.server.shutdown()
            self.server = None
            self.server_thread = None
            self.current_port = None
            logger.info(f"[{self.name}] Preview server stopped")
    
    def get_preview_url(self, post_slug: str = None) -> str:
        """
        Get the preview URL for a specific post.
        
        Args:
            post_slug: Optional slug to navigate to specific post
            
        Returns: Preview URL
        """
        if not self.current_port:
            result = self.serve_preview()
            if not result.get("success"):
                return None
        
        base_url = f"http://localhost:{self.current_port}"
        
        if post_slug:
            return f"{base_url}/posts/{post_slug}.html"
        
        return base_url
    
    def quick_preview(self, content: str = None, post_slug: str = None) -> Dict:
        """
        Quick preview for a single piece of content without full build.
        """
        # Build and serve in one step
        build_result = self.build_preview()
        
        if not build_result.get("success"):
            return build_result
        
        serve_result = self.serve_preview(build_result["preview_id"])
        
        if not serve_result.get("success"):
            return serve_result
        
        url = self.get_preview_url(post_slug)
        
        return {
            "success": True,
            "url": url,
            "preview_id": build_result["preview_id"],
            "message": f"Preview available at {url}"
        }
    
    def cleanup_old_previews(self, keep_last: int = 5):
        """Remove old preview directories."""
        if len(self.history) <= keep_last:
            return
        
        old_previews = self.history[:-keep_last]
        
        for preview in old_previews:
            path = preview.get("path")
            if path and os.path.exists(path):
                try:
                    shutil.rmtree(path)
                    logger.debug(f"[{self.name}] Cleaned up {preview['id']}")
                except:
                    pass
        
        self.history = self.history[-keep_last:]
        self._save_history()
        
        logger.info(f"[{self.name}] Cleaned up {len(old_previews)} old previews")
    
    def list_previews(self, limit: int = 10) -> List[Dict]:
        """List recent previews."""
        return list(reversed(self.history[-limit:]))
    
    def get_status(self) -> Dict:
        """Get preview generator status."""
        return {
            "server_running": self.server is not None,
            "current_port": self.current_port,
            "current_url": f"http://localhost:{self.current_port}" if self.current_port else None,
            "total_previews": len(self.history),
            "preview_dir": self.preview_dir
        }


# Singleton
_generator = None

def get_preview_generator() -> PreviewGenerator:
    """Get the global preview generator instance."""
    global _generator
    if _generator is None:
        _generator = PreviewGenerator()
    return _generator


if __name__ == "__main__":
    gen = PreviewGenerator()
    
    print("=== Preview Generator Test ===\n")
    print(f"Status: {gen.get_status()}")
    
    print("\nBuilding preview...")
    result = gen.build_preview()
    print(f"Build result: {result}")
    
    print("\nStarting server...")
    serve_result = gen.serve_preview()
    print(f"Server: {serve_result}")
    
    input("\nPress Enter to stop server...")
    gen.stop_preview()
