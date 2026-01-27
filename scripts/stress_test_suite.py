#!/usr/bin/env python3
"""
🧪 SYSTEM STRESS TEST SUITE
===========================
Purpose: Evaluates the system's core capabilities under simulated load.
Tests: Latency, Content Velocity, Intelligence Precision, and Security.
"""

import os
import sys
import time
import asyncio
import uuid
import pathlib
import logging
from typing import Optional

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.publisher import get_publisher
from admin.brain.security import PIISanitizer, SecurityResearcher
from admin.engineers.command_router import get_command_router

# Configure logging
logging.basicConfig(level=logging.ERROR)  # Keep it quiet unless error
logger = logging.getLogger("StressTest")


class StressTester:
    def __init__(self):
        self.publisher = get_publisher()
        self.sanitizer = PIISanitizer()
        self.researcher = SecurityResearcher()
        self.router = get_command_router()
        self.results = []

    def log_result(self, name: str, passed: bool, duration: float, meta: Optional[dict] = None):
        res = {
            "test": name,
            "status": "PASS" if passed else "FAIL",
            "duration_ms": round(duration * 1000, 2),
            "meta": meta or {},
        }
        self.results.append(res)
        print(f"{'✅' if passed else '❌'} {name:30} | {res['duration_ms']:8.2f}ms")

    async def test_latency(self):
        """Purpose: Neural Speed (Benchmark)"""
        start = time.time()
        try:
            # We use a simple prompt to check routing speed
            await self.router.execute(self.router.route("System check."))
            self.log_result("Neural Latency", True, time.time() - start)
        except Exception as e:
            self.log_result("Neural Latency", False, time.time() - start, {"error": str(e)})

    async def test_content_burst(self, count=5):
        """Purpose: High Velocity Production"""
        start = time.time()
        success_count = 0

        # Create dummy files
        tmp_files = []
        for i in range(count):
            path = f"/tmp/stress_test_{uuid.uuid4().hex}.txt"
            with open(path, "w") as f_out:
                f_out.write(f"Stress test content {i}")
            tmp_files.append(path)

        try:
            # Burst publish
            for path in tmp_files:
                res = self.publisher.publish(path, platforms=["internal_test"])
                if res.get("success"):
                    success_count += 1

            passed = success_count == count
            self.log_result(
                "Content Burst (5 items)", passed, time.time() - start, {"processed": success_count}
            )
        except Exception as e:
            self.log_result("Content Burst", False, time.time() - start, {"error": str(e)})
        finally:
            # Cleanup
            for file_to_remove in tmp_files:
                if os.path.exists(file_to_remove):
                    os.remove(file_to_remove)

    def test_security_sanitization(self, samples=100):
        """Purpose: Data Safety (PII)"""
        start = time.time()
        raw_text = "Contact me at user@example.com or call 555-0199. API Key: sk-1234567890abcdef1234567890abcdef"

        try:
            for _ in range(samples):
                self.sanitizer.sanitize(raw_text)

            self.log_result(f"PII Sanitization ({samples}x)", True, time.time() - start)
        except Exception as e:
            self.log_result("PII Sanitization", False, time.time() - start, {"error": str(e)})

    async def test_open_code_tools(self):
        """Purpose: Tool Integration (Permissions)"""
        start = time.time()
        # This test simulates a complex tool usage pattern
        try:
            # 1. Glob check
            matches = list(pathlib.Path("admin/").rglob("*.py"))

            # 2. Grep check
            found = False
            for p in matches[:10]:  # Check first 10
                with open(str(p), "r") as f_in:
                    if "class" in f_in.read():
                        found = True
                        break

            passed = len(matches) > 0 and found
            self.log_result(
                "OpenCode Tool Logic", passed, time.time() - start, {"files_matched": len(matches)}
            )
        except Exception as e:
            self.log_result("OpenCode Tool Logic", False, time.time() - start, {"error": str(e)})

    async def run_all(self):
        print("\n--- 🧪 SYSTEM STRESS TEST: PURPOSES ---")
        print(f"{'TEST NAME':32} | {'LATENCY':>10}")
        print("-" * 46)

        await self.test_latency()
        await self.test_content_burst()
        self.test_security_sanitization()
        await self.test_open_code_tools()

        print("-" * 46)
        summary = {
            "total": len(self.results),
            "passed": sum(1 for r in self.results if r["status"] == "PASS"),
            "failed": sum(1 for r in self.results if r["status"] == "FAIL"),
        }
        print(f"SUMMARY: {summary['passed']}/{summary['total']} PASSED\n")


if __name__ == "__main__":
    tester = StressTester()
    asyncio.run(tester.run_all())
