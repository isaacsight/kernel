---
name: terminal_mastery
description: Expert-level terminal operations with command composition, pipeline building, and system interaction patterns.
---

# Terminal Mastery Skill

This skill elevates Gemini CLI to expert-level terminal fluency, enabling complex command chains, system diagnostics, and high-fidelity shell interaction.

## Capabilities

### 1. Command Composition Patterns
- **Pipeline Building**: Chain commands with `|`, `&&`, `||` for conditional execution
- **Subshell Expansion**: Use `$()` for dynamic command interpolation
- **Process Substitution**: `<()` and `>()` for treating command output as files
- **Here Documents**: Multi-line input with `<<EOF` patterns

### 2. System Diagnostics
- **Resource Monitoring**: `htop`, `top`, `vmstat`, `iostat` for performance analysis
- **Network Debugging**: `netstat`, `ss`, `lsof -i`, `tcpdump` for connection analysis
- **Disk Analysis**: `df -h`, `du -sh`, `ncdu` for storage auditing
- **Process Management**: `ps aux`, `pgrep`, `pkill`, job control

### 3. Git Mastery
- **Interactive Rebasing**: `git rebase -i` with fixup/squash workflows
- **Bisect Debugging**: Binary search through commits to find bugs
- **Reflog Recovery**: Restore "lost" commits from the reflog
- **Worktree Management**: Multiple working directories from one repo
- **Cherry-pick Strategies**: Selective commit migration between branches

### 4. Docker & Container Operations
- **Multi-stage Builds**: Efficient image layering strategies
- **Volume Management**: Data persistence and bind mount patterns
- **Network Debugging**: Container connectivity troubleshooting
- **Compose Orchestration**: Multi-container development environments

## Instructions

### Execution Standards
1. **Always preview destructive commands** before execution
2. **Use dry-run flags** when available (`--dry-run`, `-n`)
3. **Quote all variables** to prevent word splitting: `"$variable"`
4. **Check exit codes**: `$?` after critical operations
5. **Use absolute paths** in scripts for reliability

### Error Handling Patterns
```bash
# Safe command execution
command || { echo "Failed"; exit 1; }

# Verbose debugging
set -x  # Enable trace
set -e  # Exit on error
set -u  # Error on undefined variables
set -o pipefail  # Catch pipe failures
```

### Output Processing
```bash
# JSON parsing with jq
curl -s api.example.com | jq '.data[] | {id, name}'

# Column extraction with awk
ps aux | awk '{print $2, $11}'

# Text transformation with sed
sed -i 's/old/new/g' file.txt

# Filtering with grep
grep -rn "pattern" --include="*.py"
```

## Tools Integrated
- `shell` (primary execution)
- `run_in_terminal` (interactive commands)
- `view_file_outline` (script analysis)
- `grep_search` (codebase navigation)

## Quick Reference

### Useful One-Liners
```bash
# Find large files
find . -type f -size +100M -exec ls -lh {} \;

# Kill process by port
lsof -ti:3000 | xargs kill -9

# Watch file changes
watch -n 1 'ls -la target/'

# Parallel execution
parallel -j4 'process {}' ::: file1 file2 file3

# JSON to CSV
jq -r '[.field1, .field2] | @csv' data.json
```

### Git Shortcuts
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Clean up merged branches
git branch --merged | grep -v main | xargs git branch -d

# Interactive add
git add -p

# Stash with message
git stash push -m "WIP: feature description"
```

---
*Skill v1.0 | Sovereign Laboratory OS | Terminal Mastery*
