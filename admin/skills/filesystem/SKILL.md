---
name: filesystem
description: Read and list files in the allowed directories. Use when you need to read content from files or explore the project structure.
---

# Filesystem Skills

You have access to safe filesystem operations.

## Capabilities

1.  **Read File**: Read the content of a specific file.
2.  **List Directory**: List files and folders in a directory.

## How to use

To use these skills, you must output a JSON object describing the action you want to take.

### Read File
```json
{
  "tool": "filesystem",
  "action": "read",
  "params": {
    "path": "/absolute/path/to/file.txt"
  }
}
```

### List Directory
```json
{
  "tool": "filesystem",
  "action": "list",
  "params": {
    "path": "/absolute/path/to/directory"
  }
}
```

## Safety
- Only read operations are allowed via this skill.
- Paths must be absolute.
