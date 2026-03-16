# K:BOT Terminal Demo — recorded with VHS (https://github.com/charmbracelet/vhs)
#
# Install: brew install vhs
# Record:  cd packages/kbot && vhs demo.tape
# Output:  demo.gif (for README, HN, Reddit)
#
# IMPORTANT: This is a scripted demo. kbot must be installed globally
# and have a valid API key configured before recording.

Output demo.gif

Set Shell "zsh"
Set FontSize 15
Set Width 900
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 40ms

# ── Scene 1: One-shot (show it just works) ──
Type "kbot 'what does this project do?'"
Enter
Sleep 5s

# ── Scene 2: Agent routing (show specialist selection) ──
Type "kbot 'review src/auth.ts for security issues'"
Enter
Sleep 5s

# ── Scene 3: Pipe mode (composable with Unix) ──
Type "kbot -p 'generate a user roles migration' > migration.sql && cat migration.sql"
Enter
Sleep 4s

# ── Scene 4: Audit a repo (show real utility) ──
Type "kbot audit isaacsight/kernel --share"
Enter
Sleep 5s

# ── Scene 5: Interactive REPL ──
Type "kbot"
Enter
Sleep 2s
Type "find all TODO comments in this project"
Enter
Sleep 4s
Type "/save demo-session"
Enter
Sleep 1s
Type "/quit"
Enter
Sleep 1s

# ── Outro ──
Type "# 22 agents. 223 tools. 20 providers. Runs offline."
Enter
Type "# npm i -g @kernel.chat/kbot"
Enter
Sleep 3s
