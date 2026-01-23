"""
Phone Controller - AI interface to control Android phone via Termux
Connects over SSH (Tailscale) to execute termux-api commands
"""

import asyncio
import subprocess
import json
import logging
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class PhoneConfig:
    """Configuration for phone connection"""
    host: str  # Tailscale IP of phone
    port: int = 8022  # Termux SSH port
    user: str = "u0_a"  # Termux default user prefix
    ssh_key: Optional[str] = None  # Path to SSH private key
    password: Optional[str] = None  # SSH password (if no key)
    timeout: int = 30  # Command timeout in seconds


class PhoneController:
    """
    Control Android phone via Termux SSH connection.

    Usage:
        phone = PhoneController(PhoneConfig(host="100.x.x.x"))
        await phone.connect()

        # High-level commands
        await phone.notify("AI", "Task completed!")
        await phone.speak("Hello, I am your AI assistant")
        location = await phone.get_location()

        # Or run any command
        result = await phone.execute("sms-list 5")
    """

    def __init__(self, config: PhoneConfig):
        self.config = config
        self._connected = False

    async def connect(self) -> bool:
        """Test connection to phone"""
        try:
            result = await self.execute("status")
            self._connected = "Battery:" in result
            if self._connected:
                logger.info(f"Connected to phone at {self.config.host}")
            return self._connected
        except Exception as e:
            logger.error(f"Failed to connect to phone: {e}")
            return False

    @property
    def is_connected(self) -> bool:
        return self._connected

    def _build_ssh_command(self, remote_cmd: str) -> List[str]:
        """Build SSH command with proper arguments"""
        cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10"]

        if self.config.ssh_key:
            cmd.extend(["-i", self.config.ssh_key])

        cmd.extend([
            "-p", str(self.config.port),
            f"{self.config.user}@{self.config.host}",
            f"~/.termux/scripts/ai-execute.sh {remote_cmd}"
        ])

        return cmd

    async def execute(self, command: str) -> str:
        """Execute a command on the phone via SSH"""
        ssh_cmd = self._build_ssh_command(command)

        try:
            process = await asyncio.create_subprocess_exec(
                *ssh_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.config.timeout
            )

            if process.returncode != 0:
                error = stderr.decode().strip()
                logger.warning(f"Phone command failed: {error}")
                return f"Error: {error}"

            return stdout.decode().strip()

        except asyncio.TimeoutError:
            logger.error(f"Phone command timed out: {command}")
            return "Error: Command timed out"
        except Exception as e:
            logger.error(f"Phone command error: {e}")
            return f"Error: {str(e)}"

    # ==========================================================================
    # High-Level Phone Control Methods
    # ==========================================================================

    async def notify(self, title: str, message: str) -> str:
        """Show a notification on the phone"""
        return await self.execute(f'notify "{title}" "{message}"')

    async def speak(self, text: str) -> str:
        """Text-to-speech on the phone"""
        return await self.execute(f'speak "{text}"')

    async def toast(self, message: str) -> str:
        """Show a toast message"""
        return await self.execute(f'toast "{message}"')

    async def vibrate(self, duration_ms: int = 500) -> str:
        """Vibrate the phone"""
        return await self.execute(f'vibrate {duration_ms}')

    # Clipboard
    async def get_clipboard(self) -> str:
        """Get clipboard contents"""
        return await self.execute('clipboard-get')

    async def set_clipboard(self, text: str) -> str:
        """Set clipboard contents"""
        return await self.execute(f'clipboard-set "{text}"')

    # SMS
    async def send_sms(self, number: str, message: str) -> str:
        """Send an SMS message"""
        return await self.execute(f'sms-send "{number}" "{message}"')

    async def list_sms(self, count: int = 10) -> str:
        """List recent SMS messages"""
        return await self.execute(f'sms-list {count}')

    # Camera
    async def take_photo(self, path: str = "/sdcard/ai-photo.jpg") -> str:
        """Take a photo with the camera"""
        return await self.execute(f'photo "{path}"')

    # Location
    async def get_location(self) -> Dict[str, Any]:
        """Get current GPS location"""
        result = await self.execute('location')
        try:
            # Parse "Lat: X, Lon: Y" format
            parts = result.replace("Lat: ", "").replace("Lon: ", "").split(", ")
            return {"latitude": float(parts[0]), "longitude": float(parts[1])}
        except:
            return {"raw": result}

    # Battery
    async def get_battery(self) -> Dict[str, Any]:
        """Get battery status"""
        result = await self.execute('battery')
        try:
            # Parse "Battery: X% (status)" format
            import re
            match = re.search(r'Battery: (\d+)% \((\w+)\)', result)
            if match:
                return {"percentage": int(match.group(1)), "status": match.group(2)}
        except:
            pass
        return {"raw": result}

    # Volume
    async def set_volume(self, stream: str, level: int) -> str:
        """Set volume level (stream: music, ring, notification, alarm)"""
        return await self.execute(f'volume {stream} {level}')

    # Torch/Flashlight
    async def torch(self, on: bool) -> str:
        """Turn flashlight on or off"""
        return await self.execute(f'torch {"on" if on else "off"}')

    # Open URL/App
    async def open_url(self, url: str) -> str:
        """Open a URL in the default browser"""
        return await self.execute(f'open "{url}"')

    # WiFi
    async def get_wifi_info(self) -> str:
        """Get current WiFi connection info"""
        return await self.execute('wifi')

    # Contacts
    async def list_contacts(self, count: int = 20) -> str:
        """List contacts"""
        return await self.execute(f'contacts {count}')

    # Call
    async def make_call(self, number: str) -> str:
        """Make a phone call"""
        return await self.execute(f'call "{number}"')

    # Share
    async def share_text(self, text: str) -> str:
        """Share text via Android share menu"""
        return await self.execute(f'share "{text}"')

    # Status
    async def get_status(self) -> str:
        """Get overall phone status"""
        return await self.execute('status')

    # Raw command (for advanced use)
    async def raw(self, command: str) -> str:
        """Execute a raw shell command on the phone"""
        return await self.execute(f'raw {command}')


# =============================================================================
# Convenience function for quick use
# =============================================================================

_default_phone: Optional[PhoneController] = None


def get_phone(host: Optional[str] = None, **kwargs) -> PhoneController:
    """
    Get or create phone controller instance.

    Usage:
        from admin.brain.phone_controller import get_phone

        phone = get_phone("100.x.x.x")
        await phone.speak("Hello!")
    """
    global _default_phone

    if host:
        config = PhoneConfig(host=host, **kwargs)
        _default_phone = PhoneController(config)

    if _default_phone is None:
        raise ValueError("Phone not configured. Call get_phone(host='your-tailscale-ip') first.")

    return _default_phone


# =============================================================================
# CLI for testing
# =============================================================================

if __name__ == "__main__":
    import sys

    async def main():
        if len(sys.argv) < 3:
            print("Usage: python phone_controller.py <PHONE_IP> <command> [args...]")
            print("\nExamples:")
            print("  python phone_controller.py 100.x.x.x status")
            print("  python phone_controller.py 100.x.x.x speak 'Hello world'")
            print("  python phone_controller.py 100.x.x.x notify 'AI' 'Task done'")
            return

        host = sys.argv[1]
        command = " ".join(sys.argv[2:])

        phone = get_phone(host)

        print(f"Connecting to phone at {host}...")
        if await phone.connect():
            print(f"Executing: {command}")
            result = await phone.execute(command)
            print(result)
        else:
            print("Failed to connect to phone")

    asyncio.run(main())
