# kbot Learning Engine — The differentiator
# Shows: pattern extraction → skill routing → compounding
# Run: vhs tools/video-assets/demo-learning.tape

Output tools/video-assets/demo-learning.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 17
Set Width 900
Set Height 540
Set Padding 24
Set TypingSpeed 35ms
Set PlaybackSpeed 1

# Show what kbot has learned
Type "# kbot learns from every interaction"
Enter
Sleep 1s

# Check learning stats
Type "kbot reflect"
Sleep 300ms
Enter
Sleep 6s

# Show routing decisions
Type "kbot compare"
Sleep 300ms
Enter
Sleep 5s

# Show pattern count
Type `kbot insights --detail`
Sleep 300ms
Enter
Sleep 6s

# Make a query that triggers learning
Type `kbot "refactor the auth middleware to use JWT verification"`
Sleep 300ms
Enter
Sleep 10s

# Show the learning happened
Type "# Session N+1 is now smarter than Session N"
Enter
Sleep 2s
