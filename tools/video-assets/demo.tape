# kbot Hero Demo — Terminal recording for README
# Run: vhs tools/video-assets/demo.tape

Output tools/video-assets/demo.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 16
Set Width 880
Set Height 520
Set Padding 24
Set TypingSpeed 40ms
Set PlaybackSpeed 1.5

# Title moment — show the install command
Type "# install: npm i -g @kernel.chat/kbot"
Enter
Sleep 800ms

# Quick health check — shows capabilities at a glance
Type "kbot doctor"
Sleep 300ms
Enter
Sleep 4s

# Real AI query — kbot responds via local model
Type `kbot "what is kbot?"`
Sleep 300ms
Enter
Sleep 8s

# Agent routing — show specialist selection
Type `kbot --agent coder -q "write fizzbuzz in python"`
Sleep 300ms
Enter
Sleep 10s
