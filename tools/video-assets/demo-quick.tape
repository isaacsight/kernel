# kbot Quick Demo — Static commands that work without API
# Run: vhs tools/video-assets/demo-quick.tape

Output tools/video-assets/demo-quick.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 16
Set Width 900
Set Height 540
Set Padding 20
Set TypingSpeed 30ms
Set PlaybackSpeed 1.2

# Show version
Type "kbot --version"
Enter
Sleep 1s

# Show help — demonstrates the breadth
Type "kbot help"
Enter
Sleep 3s

# Show agents
Type "kbot agents"
Enter
Sleep 3s

# Show status — tools, learning stats
Type "kbot status --json | head -20"
Enter
Sleep 3s

# Show doctor
Type "kbot doctor"
Enter
Sleep 5s

# End with install
Type "echo '→ npm i -g @kernel.chat/kbot — 787+ tools — kernel.chat'"
Enter
Sleep 2s
