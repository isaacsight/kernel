#!/usr/bin/env python3
"""
Experiment HQ - Manage Studio OS Experiments
"""
import os
import shutil
import sys
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
EXP_DIR = BASE_DIR / "experiments"

def init_experiment(name):
    target = EXP_DIR / name
    if target.exists():
        print(f"Error: Experiment '{name}' already exists.")
        return
    
    target.mkdir(parents=True)
    (target / "src").mkdir()
    (target / "results").mkdir()
    
    # Create a local rules link or copy
    rules_dir = target / ".agent" / "rules"
    rules_dir.mkdir(parents=True)
    
    # Create experiment-specific rule file
    with open(rules_dir / f"{name}.md", "w") as f:
        f.write(f"# Experiment: {name}\n\n## Objective\nDefine your success criteria here.\n\n## Constraints\nList specific constraints for agents in this experiment.")

    print(f"Initialized experiment '{name}' at {target}")
    print(f"Rules created at {rules_dir / f'{name}.md'}")

def promote(name, file_path):
    source = EXP_DIR / name / file_path
    dest = BASE_DIR / file_path
    
    if not source.exists():
        print(f"Error: Source file '{source}' does not exist.")
        return
    
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest)
    print(f"Promoted {source} to {dest}")

def main():
    parser = argparse.ArgumentParser(description="Experiment HQ")
    subparsers = parser.add_subparsers(dest="command")
    
    init_parser = subparsers.add_parser("init", help="Initialize a new experiment")
    init_parser.add_argument("name", help="Name of the experiment")
    
    promote_parser = subparsers.add_parser("promote", help="Promote a file from an experiment")
    promote_parser.add_argument("name", help="Name of the experiment")
    promote_parser.add_argument("file", help="Relative path of the file to promote")
    
    args = parser.parse_args()
    
    if args.command == "init":
        init_experiment(args.name)
    elif args.command == "promote":
        promote(args.name, args.file)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
