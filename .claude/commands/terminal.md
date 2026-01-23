# /terminal - Terminal Mastery Command

Execute expert-level terminal operations with pipeline building and system diagnostics.

## Usage
```
/terminal [command description]
/terminal git-cleanup        # Clean merged branches
/terminal find-large-files   # Find files > 100MB
/terminal port-check 3000    # Check port usage
```

## Quick Commands

### Git Operations
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Clean merged branches
git branch --merged | grep -v main | xargs git branch -d

# Interactive staging
git add -p

# Stash with message
git stash push -m "WIP: description"
```

### File Operations
```bash
# Find large files
find . -type f -size +100M -exec ls -lh {} \;

# Disk usage by directory
du -sh */ | sort -hr | head -20

# Watch file changes
watch -n 1 'ls -la target/'
```

### Process Management
```bash
# Kill by port
lsof -ti:3000 | xargs kill -9

# Find process by name
pgrep -fl "node"

# Resource monitoring
htop / top -o %MEM
```

### Network Diagnostics
```bash
# Port scan
lsof -i :8000

# DNS lookup
dig +short example.com @8.8.8.8

# SSL certificate check
openssl s_client -connect example.com:443
```

## Pipeline Patterns
```bash
# JSON processing
curl -s api.com | jq '.data[] | {id, name}'

# Column extraction
ps aux | awk '{print $2, $11}'

# Parallel execution
parallel -j4 'process {}' ::: file1 file2 file3
```

## Related Skills
- Gemini: `terminal_mastery`
- See: `.gemini/skills/terminal_mastery.md`
