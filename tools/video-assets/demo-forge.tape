# kbot Forge Demo — The 90-Second Video That Changes Everything
# Shows: kbot encounters a problem → forges a tool → solves it → tool persists
# "350+ tools. This one was built 30 seconds ago."
# Run: vhs tools/video-assets/demo-forge.tape

Output tools/video-assets/demo-forge.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 18
Set Width 900
Set Height 560
Set Padding 24
Set TypingSpeed 30ms
Set PlaybackSpeed 1

# Hook — the problem
Type "# I need to find all TODO comments with priority levels across my codebase"
Enter
Sleep 1s

Type `kbot "find all TODOs in this project, categorize by priority (P0/P1/P2), and show me a summary"`
Sleep 400ms
Enter
Sleep 3s

# kbot realizes it doesn't have a tool for this
Type "# kbot doesn't have a TODO scanner with priority detection..."
Enter
Sleep 1s

# kbot forges the tool
Type "# But it can build one."
Enter
Sleep 1.5s

Type `kbot "I need a tool that scans for TODO/FIXME/HACK comments, extracts priority levels, and generates a report"`
Sleep 400ms
Enter
Sleep 8s

# Show the forged tool
Type "kbot forge list"
Sleep 300ms
Enter
Sleep 3s

# Use the forged tool immediately
Type `kbot "now use the todo scanner on packages/kbot/src/"`
Sleep 400ms
Enter
Sleep 8s

# Show it persists
Type "# That tool is now permanent. Available in every future session."
Enter
Sleep 1s

Type "# 368 tools. This one was built 30 seconds ago."
Enter
Sleep 3s
