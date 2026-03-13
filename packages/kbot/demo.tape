# K:BOT Terminal Demo — recorded with VHS (https://github.com/charmbracelet/vhs)
#
# Install: brew install vhs
# Record:  cd packages/kbot && vhs demo.tape
# Output:  demo.gif (for README)

Output demo.gif

Set Shell "zsh"
Set FontSize 16
Set Width 900
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 50ms

# Title
Type "# K:BOT — Open-source terminal AI agent"
Enter
Sleep 1s

# Install
Type "npm i -g @kernel.chat/kbot"
Enter
Sleep 2s

# One-shot mode
Type "kbot 'explain the auth flow in this project'"
Enter
Sleep 4s

# Show agent routing
Type "kbot --agent researcher 'compare React 19 vs Svelte 5'"
Enter
Sleep 4s

# Pipe mode
Type "kbot -p 'generate a user migration' > migration.sql"
Enter
Sleep 3s

# Local mode
Type "kbot local"
Enter
Sleep 2s

# Interactive
Type "kbot"
Enter
Sleep 2s
Type "/agent coder"
Enter
Sleep 1s
Type "fix the type error in auth.ts"
Enter
Sleep 4s
Type "/save"
Enter
Sleep 1s
Type "exit"
Enter
Sleep 1s
