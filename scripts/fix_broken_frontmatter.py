#!/usr/bin/env python3
"""
Fix Broken Frontmatter Script
-----------------------------
Repairs markdown files with malformed YAML frontmatter.
The main issue: titles containing colons that break YAML parsing.
"""

import os
import re
import yaml
from pathlib import Path

CONTENT_DIR = Path(__file__).parent.parent / "content"

def fix_frontmatter(filepath: Path) -> tuple[bool, str]:
    """Fix a single markdown file's frontmatter. Returns (fixed, message)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if file has frontmatter
    if not content.startswith('---'):
        return False, "No frontmatter found"
    
    # Split frontmatter and body
    parts = content.split('---', 2)
    if len(parts) < 3:
        return False, "Invalid frontmatter structure"
    
    frontmatter_text = parts[1].strip()
    body = parts[2]
    
    # Try to parse it first
    try:
        yaml.safe_load(frontmatter_text)
        return False, "Already valid"
    except yaml.YAMLError:
        pass  # Needs fixing
    
    # Fix common issues line by line
    lines = frontmatter_text.split('\n')
    fixed_lines = []
    
    for line in lines:
        # Handle title field with problematic colons
        if line.startswith('title:'):
            # Extract the title value
            title_match = re.match(r"title:\s*['\"]?(.+?)['\"]?\s*$", line)
            if title_match:
                title_value = title_match.group(1).strip()
                # If title contains colons and isn't properly quoted, fix it
                if ':' in title_value and not (line.strip().endswith("'") or line.strip().endswith('"')):
                    # Escape single quotes and wrap in single quotes
                    safe_title = title_value.replace("'", "''")
                    fixed_lines.append(f"title: '{safe_title}'")
                    continue
        
        # Handle multi-line title continuations (indented lines after title)
        if line.startswith('  ') and fixed_lines and fixed_lines[-1].startswith('title:'):
            # This is a continuation of a broken multi-line title, merge it
            prev_title = fixed_lines.pop()
            # Extract title value without quotes
            title_match = re.match(r"title:\s*'(.+)'", prev_title)
            if title_match:
                existing = title_match.group(1)
                continuation = line.strip().rstrip("'").lstrip()
                merged = f"{existing} {continuation}".replace("''", "'").replace("'", "''")
                fixed_lines.append(f"title: '{merged}'")
                continue
            else:
                fixed_lines.append(prev_title)  # Put it back
        
        fixed_lines.append(line)
    
    new_frontmatter = '\n'.join(fixed_lines)
    
    # Validate the fix
    try:
        yaml.safe_load(new_frontmatter)
    except yaml.YAMLError as e:
        return False, f"Could not auto-fix: {e}"
    
    # Write the fixed content
    new_content = f"---\n{new_frontmatter}\n---{body}"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return True, "Fixed"

def main():
    """Process all markdown files in content directory."""
    fixed_count = 0
    error_files = []
    
    for filepath in CONTENT_DIR.glob('*.md'):
        try:
            fixed, msg = fix_frontmatter(filepath)
            if fixed:
                print(f"✅ Fixed: {filepath.name}")
                fixed_count += 1
            elif msg != "Already valid":
                print(f"⚠️  {filepath.name}: {msg}")
                error_files.append((filepath.name, msg))
        except Exception as e:
            print(f"❌ Error processing {filepath.name}: {e}")
            error_files.append((filepath.name, str(e)))
    
    print(f"\n{'='*50}")
    print(f"Fixed {fixed_count} files")
    
    if error_files:
        print(f"\n{len(error_files)} files still have issues:")
        for name, msg in error_files:
            print(f"  - {name}: {msg}")

if __name__ == "__main__":
    main()
