# kbot Local AI — $0 inference, fully offline
# Shows: local model selection, zero-cost inference, hardware detection
# Run: vhs tools/video-assets/demo-local-ai.tape

Output tools/video-assets/demo-local-ai.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 17
Set Width 900
Set Height 540
Set Padding 24
Set TypingSpeed 35ms
Set PlaybackSpeed 1

# Title
Type "# $0 AI — runs fully offline on your machine"
Enter
Sleep 1s

# Show hardware detection
Type "kbot hardware"
Sleep 300ms
Enter
Sleep 4s

# Show available local models
Type "kbot models"
Sleep 300ms
Enter
Sleep 5s

# Run a query with local model
Type `kbot --local "write a Python script to parse CSV files"`
Sleep 300ms
Enter
Sleep 10s

# Show cost
Type "# Total cost: $0.00 — no API key, no data leaves your machine"
Enter
Sleep 2s

# Doctor check
Type "kbot doctor"
Sleep 300ms
Enter
Sleep 5s
