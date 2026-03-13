# K:BOT Terminal Demo — VHS tape
# Run: vhs demo.tape
# Produces: demo.gif for README

Output demo.gif

Set FontSize 14
Set Width 900
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 40ms

# Install
Type "npm i -g @kernel.chat/kbot"
Enter
Sleep 2s

# Start interactive mode
Type "kbot"
Enter
Sleep 3s

# Show the particle grid banner loading...
Sleep 2s

# First message — coding task
Type "fix the type error in auth.ts line 42"
Enter
Sleep 4s

# Show agent routing + tool calls
Sleep 3s

# Second message — research task
Type "research how JWT refresh tokens work"
Enter
Sleep 4s

# Show researcher agent picking up
Sleep 3s

# Third message — local mode
Type "/ollama"
Enter
Sleep 2s

# Show local model detection
Sleep 2s

Type "explain this codebase"
Enter
Sleep 4s

# Show repo map being injected
Sleep 3s

# Show help
Type "/help"
Enter
Sleep 3s

# Exit
Type "/quit"
Enter
Sleep 1s
