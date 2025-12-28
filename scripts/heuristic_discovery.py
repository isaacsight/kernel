#!/usr/bin/env python3
"""
Heuristic Discovery - Evolve the Studio OS doctrine based on real performance.
"""
import os
import json
import re
from pathlib import Path

RULES_FILE = Path(".agent/rules/global-rules.md")

def analyze_logs():
    print("🔍 Analyzing recent agent logs and audit reports...")
    # In a real scenario, this would parse task.json, plan.md, and audit logs.
    
    # Discovery 1: WebGL Stability (Based on Perception Critic finding)
    new_heuristics = []
    
    # We simulate reading the audit report I just got
    audit_report = """
    Critical Layout Issue (WebGL): The main visual element—the 'Neural Lattice Visualization'—is currently failing to render due to a WebGL context loss.
    """
    
    if "WebGL context loss" in audit_report:
        new_heuristics.append("When using Three.js or heavy WebGL, the Perception Critic must explicitly check console logs for 'Context Lost' errors during QA.")

    return new_heuristics

def update_rules(heuristics):
    if not heuristics:
        print("No new heuristics discovered.")
        return
        
    with open(RULES_FILE, "r") as f:
        content = f.read()
    
    # Find the Heuristics section
    if "## 2. Mandatory Engineering Heuristics" in content:
        addition = "\n### Evolved Heuristics (Discovered via OS Runs)\n"
        for h in heuristics:
            addition += f"- **Stability Check**: {h}\n"
            
        # Append before the next section
        new_content = content.replace("## 2. Mandatory Engineering Heuristics", "## 2. Mandatory Engineering Heuristics" + addition)
        
        with open(RULES_FILE, "w") as f:
            f.write(new_content)
        print(f"✅ Updated {RULES_FILE} with {len(heuristics)} new heuristics.")
    else:
        print("Heuristics section not found in rules file.")

if __name__ == "__main__":
    discovered = analyze_logs()
    update_rules(discovered)
