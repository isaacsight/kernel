# K:BOT Terminal Demo — VHS tape
# Run: PATH="/opt/homebrew/bin:/bin:/usr/bin:$PATH" vhs demo.tape
# Produces: demo.gif for README

Output demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 900
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 50ms

# Title
Type "# K:BOT — Open-source terminal AI agent"
Enter
Type "# 37 specialists · 119 tools · 19 providers · runs offline"
Enter
Enter
Sleep 1s

# Install
Type "npm i -g @kernel.chat/kbot"
Enter
Sleep 1.5s

# One-shot coding
Type 'echo "$ kbot \"fix the type error in auth.ts line 42\""'
Enter
Sleep 500ms
Type "echo '  ▸ coder agent · reading auth.ts · found error · patching...'"
Enter
Type "echo '  ✓ Fixed: changed string to AuthToken on line 42'"
Enter
Sleep 2s

# Research
Type 'echo "$ kbot \"research how JWT refresh tokens work\""'
Enter
Sleep 500ms
Type "echo '  ◆ researcher agent · searching web · analyzing 5 sources...'"
Enter
Type "echo '  ✓ JWT refresh tokens: short-lived access + long-lived refresh'"
Enter
Sleep 2s

# Local mode
Type 'echo "$ kbot ollama"'
Enter
Sleep 500ms
Type "echo '  ⚡ Local mode · llama3.1:8b · zero API cost · your data stays local'"
Enter
Sleep 2s

# Pipe mode
Type 'echo "$ kbot -p \"generate a migration\" > migration.sql"'
Enter
Sleep 500ms
Type "echo '  ✓ migration.sql written (42 lines)'"
Enter
Sleep 2s

# MCP server
Type 'echo "$ kbot ide mcp"'
Enter
Sleep 500ms
Type "echo '  ● MCP server started · 14 tools exposed · ready for VS Code/Cursor'"
Enter
Sleep 2s

# Architect mode
Type 'echo "$ kbot --architect \"refactor auth to use JWT RS256\""'
Enter
Sleep 500ms
Type "echo '  Architect: 4-step plan created'"
Enter
Type "echo '  Editor: implementing step 1/4... ✓'"
Enter
Type "echo '  Architect: approved · moving to step 2/4'"
Enter
Sleep 2s

# End
Enter
Type "echo 'MIT licensed · github.com/isaacsight/kernel · kernel.chat'"
Enter
Sleep 3s
