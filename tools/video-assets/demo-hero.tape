# kbot Hero Demo — The 30-second pitch
# Shows: install → first query → agent routing → learning
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

# Clean start
Type "# The Kernel Stack — Claude thinks. kbot acts. Both learn."
Enter
Sleep 1.2s

# Install
Type "npm install -g @kernel.chat/kbot"
Enter
Sleep 2s

# First query — show agent routing
Type `kbot "explain this repo"`
Sleep 300ms
Enter
Sleep 8s

# Show it learned something
Type `kbot insights`
Sleep 300ms
Enter
Sleep 5s

# Show agent selection
Type `kbot --agent researcher "latest papers on active inference"`
Sleep 300ms
Enter
Sleep 8s

# Finish with the tagline
Type "# 350+ tools. 26 agents. Learns from every session. $0 local."
Enter
Sleep 2s
