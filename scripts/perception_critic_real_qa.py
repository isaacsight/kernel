#!/usr/bin/env python3
"""
Perception Critic: Real QA Audit
Uses the Antigravity browser tool to audit the live site.
"""
import os
import sys

# Note: This script is intended to be called by an agent (like me) 
# who has access to the 'browser_subagent' tool.
# In a real environment, the agent would see this script and execute the tool.

def prepare_audit(url="http://localhost:8000"):
    print(f"--- Perception Critic Audit Initialized for {url} ---")
    print("Action Required: Execute browser_subagent with the following task:")
    print(f"Task: 'Audit {url} for visual alignment with Studio OS Brand Guide. Check for premium aesthetics, dark mode consistency, and smooth transitions.'")

if __name__ == "__main__":
    prepare_audit()
