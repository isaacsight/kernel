# kbot Local Mode Demo — shows zero-config offline AI
# Run: vhs tools/video-assets/demo-local.tape

Output tools/video-assets/demo-local.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 18
Set Width 900
Set Height 500
Set Padding 20
Set TypingSpeed 50ms

# Show it works with no config
Type `kbot "explain this codebase"`
Sleep 500ms
Enter
Sleep 6s

# Show local mode
Type `kbot local`
Sleep 500ms
Enter
Sleep 4s
