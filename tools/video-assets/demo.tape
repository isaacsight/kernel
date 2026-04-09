# kbot v3.97 Demo — Terminal recording for README & npm
# Run: vhs tools/video-assets/demo.tape

Output tools/video-assets/demo.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 16
Set Width 960
Set Height 560
Set Padding 24
Set TypingSpeed 35ms
Set PlaybackSpeed 1.5

# Title
Type "echo 'kbot — 787+ tools. Dreams. Learns. Builds its own tools. $0 local.'"
Enter
Sleep 1.5s

# One-shot — show agent routing
Type `kbot "find security issues in this repo"`
Enter
Sleep 6s

# Dream status
Type "kbot dream status"
Enter
Sleep 4s

# Agents list
Type "kbot agents"
Enter
Sleep 4s

# Local AI — no API key needed
Type "kbot local status"
Enter
Sleep 3s

# Forge a custom tool
Type `kbot forge "check npm audit for critical vulnerabilities"`
Enter
Sleep 5s

# End
Type "echo 'npm i -g @kernel.chat/kbot — MIT — kernel.chat'"
Enter
Sleep 2s
