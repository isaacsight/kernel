import subprocess
import logging
import os
import shutil

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RemoteWorker")

class RemoteWorker:
    def __init__(self, host="100.77.171.23", user="isaachernandez", key_path=None):
        self.host = host
        self.user = user
        self.key_path = key_path
        self.ssh_cmd_base = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5"]
        if self.key_path:
            self.ssh_cmd_base.extend(["-i", self.key_path])
        self.remote_target = f"{self.user}@{self.host}"

    def check_health(self) -> bool:
        """Verifies if the remote host is reachable and accessible."""
        try:
            cmd = self.ssh_cmd_base + [self.remote_target, "echo 'Remote Worker Online'"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                logger.info(f"Health check passed for {self.host}")
                return True
            else:
                logger.warning(f"Health check failed for {self.host}: {result.stderr.strip()}")
                return False
        except Exception as e:
            logger.error(f"Health check exception: {e}")
            return False

    def run_command(self, command: str) -> dict:
        """Executes a shell command on the remote host."""
        if not self.check_health():
             return {"success": False, "error": "Remote host unreachable"}

        logger.info(f"Running remote command: {command}")
        full_ssh_cmd = self.ssh_cmd_base + [self.remote_target, command]
        
        try:
            result = subprocess.run(full_ssh_cmd, capture_output=True, text=True, timeout=300)
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout.strip(),
                "stderr": result.stderr.strip(),
                "exit_code": result.returncode
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Command timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """Uploads a file to the remote host."""
        if not os.path.exists(local_path):
            logger.error(f"Local file not found: {local_path}")
            return False

        logger.info(f"Uploading {local_path} to {self.host}:{remote_path}")
        scp_cmd = ["scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5"]
        if self.key_path:
            scp_cmd.extend(["-i", self.key_path])
        
        scp_cmd.extend([local_path, f"{self.remote_target}:{remote_path}"])

        try:
            result = subprocess.run(scp_cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0:
                return True
            else:
                logger.error(f"Upload failed: {result.stderr.strip()}")
                return False
        except Exception as e:
            logger.error(f"Upload exception: {e}")
            return False

    def download_file(self, remote_path: str, local_path: str) -> bool:
        """Downloads a file from the remote host."""
        logger.info(f"Downloading {self.host}:{remote_path} to {local_path}")
        scp_cmd = ["scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5"]
        if self.key_path:
            scp_cmd.extend(["-i", self.key_path])
            
        scp_cmd.extend([f"{self.remote_target}:{remote_path}", local_path])

        try:
            result = subprocess.run(scp_cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0:
                return True
            else:
                logger.error(f"Download failed: {result.stderr.strip()}")
                return False
        except Exception as e:
            logger.error(f"Download exception: {e}")
            return False

def get_remote_worker():
    return RemoteWorker()
