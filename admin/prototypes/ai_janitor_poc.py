#!/usr/bin/env python
# ai_janitor_poc.py
# A Proof-of-Concept script simulating an AI agent that scans local Markdown files
# for common documentation issues (missing metadata, stale content).

"""
LIBRARIES USED:
- os (Standard library for file system navigation)
- re (Standard library for simple pattern matching)
- textwrap (Standard library for formatting output)
"""

import os
import re
import textwrap

MOCK_REPO_DIR = "mock_janitor_repo"

# --- Configuration and Mock Data ---

STALE_PATTERNS = [
    r"TODO.*",
    r"TBD",
    r"\[PLACEHOLDER\]",
    r"WIP: .*",
    r"\(INSERT DETAILS HERE\)",
]

BASIC_METADATA_SUGGESTION = """
---
title: "Suggested Title"
date: YYYY-MM-DD
author: Janitor AI
status: draft
tags: [unclassified]
---
"""

# --- Core Helper Functions ---

def setup_mock_repo():
    """Creates a temporary directory structure and mock files for demonstration."""
    print(f"Setting up mock repository: '{MOCK_REPO_DIR}'")
    
    os.makedirs(MOCK_REPO_DIR, exist_ok=True)
    os.makedirs(os.path.join(MOCK_REPO_DIR, "docs"), exist_ok=True)

    # File 1: Needs Frontmatter and Cleanup
    content_no_frontmatter = """
# Getting Started Guide

This is a new document. We need to add detailed installation instructions here.
TODO: Check if dependencies are up to date.
TBD: Finalize the security review section.
"""
    with open(os.path.join(MOCK_REPO_DIR, "guide.md"), "w") as f:
        f.write(content_no_frontmatter.strip())

    # File 2: Good Frontmatter, but has a stale marker deep inside
    content_good = """
---
title: "API Endpoint Specs"
date: 2023-10-01
---
# API V2 Documentation

The primary endpoint is /api/v2/data.

Section 3.4: Deprecated fields.
(INSERT DETAILS HERE) - This section is currently incomplete.
"""
    with open(os.path.join(MOCK_REPO_DIR, "docs", "api.md"), "w") as f:
        f.write(content_good.strip())
        
    # File 3: Empty file, minimal content
    content_empty = """
# Draft Policy
WIP: This policy is under construction.
"""
    with open(os.path.join(MOCK_REPO_DIR, "draft_policy.md"), "w") as f:
        f.write(content_empty.strip())


def cleanup_mock_repo():
    """Deletes the temporary directory structure."""
    if os.path.exists(MOCK_REPO_DIR):
        print(f"\nCleaning up mock repository: '{MOCK_REPO_DIR}'")
        for root, dirs, files in os.walk(MOCK_REPO_DIR, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
            for name in dirs:
                os.rmdir(os.path.join(root, name))
        os.rmdir(MOCK_REPO_DIR)

def parse_markdown(content: str) -> tuple[bool, str]:
    """Checks for frontmatter (YAML delimited by '---') and returns body content."""
    
    # Simple check for frontmatter at the start
    if content.strip().startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            # Frontmatter exists between parts[1] and parts[2]
            return True, parts[2].strip()
            
    return False, content.strip()

def mock_ai_analysis(content: str, filename: str) -> dict:
    """
    Simulates AI analysis (placeholder identification and summarization).
    This is the core PoC component using local string matching instead of an API call.
    """
    
    results = {
        "stale_markers": [],
        "summary_suggestion": None
    }
    
    # 1. Identify Stale/Placeholder Text
    for pattern in STALE_PATTERNS:
        matches = re.findall(pattern, content, re.IGNORECASE)
        for match in set(matches): # Use set to avoid duplicate line reporting
            # Limit the display length of the match
            results["stale_markers"].append(textwrap.shorten(match, width=70, placeholder="..."))

    # 2. Suggest Summary
    
    # Use the first non-header line as a basis for the summary
    lines = [line.strip() for line in content.split('\n') if line.strip() and not line.strip().startswith('#')]
    
    if lines:
        base_line = lines[0]
        
        if base_line.lower().startswith("wip") or len(content) < 100:
            # Generic summary for very short or placeholder files
            results["summary_suggestion"] = f"This document draft outlines the subject of '{filename}' and requires further content elaboration."
        else:
            # Simulate a simple summarization model
            results["summary_suggestion"] = f"Draft Summary: This document primarily details the {base_line.split(':')[0].strip().lower()} relevant to the project structure."

    return results

def print_janitor_suggestions(filepath: str, has_frontmatter: bool, ai_results: dict):
    """Prints formatted suggestions for a single file."""
    
    print("-" * 70)
    print(f"FILE: {filepath}")
    
    # 1. Frontmatter Check
    if not has_frontmatter:
        print("\n[METADATA SUGGESTION]")
        print("  ❌ Missing YAML Frontmatter. Suggest adding basic metadata:")
        print(textwrap.indent(BASIC_METADATA_SUGGESTION.strip().split('\n')[0] + "...", "  > "))
    else:
        print("  ✅ Frontmatter detected.")

    # 2. Stale Content Check
    if ai_results["stale_markers"]:
        print("\n[STALE CONTENT WARNING]")
        print(f"  ⚠️ Found {len(ai_results['stale_markers'])} potential placeholder(s) or 'TODO' item(s):")
        for marker in ai_results["stale_markers"]:
            print(f"  > {marker}")
    else:
        print("\n  ✅ No obvious stale/placeholder text found.")

    # 3. Summary Suggestion
    if ai_results["summary_suggestion"]:
        print("\n[AI SUMMARY SUGGESTION (1-Sentence)]")
        print(f"  💡 {ai_results['summary_suggestion']}")
    else:
        print("\n  (Could not generate a meaningful summary based on content.)")


# --- Main Logic ---

def run_janitor(root_dir):
    """Traverses the directory and applies AI Janitor logic to markdown files."""
    
    print("\n" + "=" * 70)
    print(f"AI JANITOR POC STARTING SCAN IN: {root_dir}")
    print("=" * 70)
    
    file_count = 0
    
    for root, _, files in os.walk(root_dir):
        for filename in files:
            if filename.endswith((".md", ".markdown")):
                file_count += 1
                filepath = os.path.join(root, filename)
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    has_frontmatter, body_content = parse_markdown(content)
                    
                    ai_results = mock_ai_analysis(body_content, filename)
                    
                    print_janitor_suggestions(filepath, has_frontmatter, ai_results)
                    
                except Exception as e:
                    print(f"ERROR processing {filepath}: {e}")
                    
    print("\n" + "=" * 70)
    print(f"SCAN COMPLETE. Analyzed {file_count} markdown file(s).")
    print("=" * 70)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Run on real directories
        for target in sys.argv[1:]:
            if os.path.exists(target):
                run_janitor(target)
            else:
                print(f"Directory not found: {target}")
    else:
        # Run on mock repo (Demo mode)
        setup_mock_repo()
        run_janitor(MOCK_REPO_DIR)
        cleanup_mock_repo()