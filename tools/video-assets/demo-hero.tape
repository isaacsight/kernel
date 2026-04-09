# kbot Hero Demo — The 30-second pitch
# Shows: install → first query → agent routing → tool forging
# Run: vhs tools/video-assets/demo-hero.tape

Output tools/video-assets/demo-hero.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 17
Set Width 900
Set Height 540
Set Padding 24
Set TypingSpeed 35ms
Set PlaybackSpeed 1

# Install
Type "npm install -g @kernel.chat/kbot"
Enter
Sleep 2s

# First query — show it just works
Type `kbot "fix the auth bug in src/auth.ts"`
Sleep 300ms
Enter
Sleep 8s

# Show agent routing
Type `kbot --agent researcher "latest papers on LLM agents"`
Sleep 300ms
Enter
Sleep 6s

# Show it builds its own tools
Type `kbot forge "lint Dockerfile for best practices"`
Sleep 300ms
Enter
Sleep 5s

# Finish
Type "# 787+ tools. 35 agents. Dreams. Learns. $0 local. MIT."
Enter
Sleep 2s
