
import os
import sys
import logging
import json
import socket
import requests
import re

# Add parent directory to path to allow imports if run directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from admin.brain.agent_presence import AgentTask
except ImportError:
    # Fallback for relative import
    # Mocking AgentTask to run standalone if needed
    class AgentTask:
        def __init__(self, agent_name, activity): pass
        def __enter__(self): return self
        def __exit__(self, exc_type, exc_val, exc_tb): pass

logger = logging.getLogger("Security")

class SecurityResearcher:
    """
    The White Hat agent (Hacker) - Performs security audits and research.
    """
    def __init__(self):
        self.name = "White Hat"

    def audit_target(self, target):
        """
        Perform a basic security audit of a target (URL or IP).
        Note: This is a passive scan for educational/defensive purposes.
        """
        print(f"[{self.name}] Initiating audit of {target}...")
        
        report = {
            "target": target,
            "security_headers": {},
            "open_ports": [], # We will simulate this to avoid triggering actual firewalls/alerts
            "risk_score": 0
        }
        
        with AgentTask(self.name, f"Auditing {target}"):
            # Check Headers
            try:
                if target.startswith("http"):
                    response = requests.head(target, timeout=5)
                    headers = response.headers
                    
                    security_headers_to_check = [
                        "X-Frame-Options",
                        "Content-Security-Policy",
                        "X-Content-Type-Options",
                        "Strict-Transport-Security"
                    ]
                    
                    for h in security_headers_to_check:
                        report["security_headers"][h] = headers.get(h, "MISSING")
                        if headers.get(h):
                            report["risk_score"] -= 10 # Good
                        else:
                            report["risk_score"] += 10 # Badish
                            
            except Exception as e:
                logger.error(f"Header check failed: {e}")
                report["error"] = str(e)

            # Simulated Port Scan (Safe)
            # We don't want to actually nmap the user's infrastructure without permission, 
            # so we'll just check standard ports if it's localhost or specific
            if "localhost" in target or "127.0.0.1" in target:
                 self._check_local_port(8000, report)
                 self._check_local_port(3000, report)

        return report

    def _check_local_port(self, port, report):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        result = sock.connect_ex(('127.0.0.1', port))
        if result == 0:
            report["open_ports"].append(port)
        sock.close()


class PIISanitizer:
    """
    Sanitizes text to remove personally identifiable information.
    Implementing Prompt #62.
    """
    
    PATTERNS = {
        # Email: Standard regex for email
        "EMAIL": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        
        # Phone: US-style phone numbers
        "PHONE": r'\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b',
        
        # API Keys: Heuristic for long random strings (Sk-...)
        "API_KEY": r'sk-[A-Za-z0-9]{20,}',
        
        # IP Address: IPv4
        "IP_ADDR": r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'
    }
    
    @staticmethod
    def sanitize(text: str) -> str:
        """
        Replaces sensitive patterns with [REDACTED:<TYPE>].
        """
        if not text:
            return text
            
        sanitized_text = text
        for label, pattern in PIISanitizer.PATTERNS.items():
            sanitized_text = re.sub(
                pattern, 
                f"[REDACTED:{label}]", 
                sanitized_text
            )
            
        if sanitized_text != text:
             logger.warning("PII detected and redacted in intake.")
             
        return sanitized_text

if __name__ == "__main__":
    hacker = SecurityResearcher()
    result = hacker.audit_target("http://localhost:8000")
    print(json.dumps(result, indent=2))
