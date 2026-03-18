# kbot Hero Demo — 15 second terminal recording
# Run: vhs tools/video-assets/demo.tape

Output tools/video-assets/demo.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 18
Set Width 900
Set Height 500
Set Padding 20
Set TypingSpeed 50ms
Set PlaybackSpeed 1

# Install
Type "npm i -g @kernel.chat/kbot"
Sleep 500ms
Enter
Sleep 3s

# First command — no setup needed
Type `kbot "what can you do?"`
Sleep 500ms
Enter
Sleep 8s

# Show agent routing
Type `kbot --agent coder "write a fizzbuzz in rust"`
Sleep 500ms
Enter
Sleep 6s
