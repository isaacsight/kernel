# kbot Agent Routing — 26 specialists
# Shows: auto-routing, agent selection, multi-agent
# Run: vhs tools/video-assets/demo-agents.tape

Output tools/video-assets/demo-agents.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 17
Set Width 900
Set Height 540
Set Padding 24
Set TypingSpeed 35ms
Set PlaybackSpeed 1

# Title
Type "# 26 specialist agents — auto-routed by intent"
Enter
Sleep 1s

# Coder agent
Type `kbot "fix the memory leak in the connection pool"`
Sleep 300ms
Enter
Sleep 8s

# Researcher agent
Type `kbot "what are the best practices for rate limiting in 2026?"`
Sleep 300ms
Enter
Sleep 8s

# Security agent
Type `kbot "scan this repo for vulnerabilities"`
Sleep 300ms
Enter
Sleep 8s

# Show which agents were used
Type `kbot sessions --last`
Sleep 300ms
Enter
Sleep 4s

Type "# coder → researcher → guardian — all auto-routed"
Enter
Sleep 2s
