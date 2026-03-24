# kbot Self-Defense — Security that protects itself
# Shows: memory integrity, prompt injection detection, audit
# Run: vhs tools/video-assets/demo-defense.tape

Output tools/video-assets/demo-defense.gif

Set Shell "zsh"
Set Theme "Catppuccin Mocha"
Set FontSize 17
Set Width 900
Set Height 540
Set Padding 24
Set TypingSpeed 35ms
Set PlaybackSpeed 1

# Title
Type "# kbot defends itself — memory integrity + injection detection"
Enter
Sleep 1s

# Run defense audit
Type "kbot defense audit"
Sleep 300ms
Enter
Sleep 6s

# Verify memory integrity
Type "kbot defense verify"
Sleep 300ms
Enter
Sleep 5s

# Check incidents
Type "kbot defense incidents"
Sleep 300ms
Enter
Sleep 4s

# Run a security scan on the project
Type `kbot --agent guardian "full security audit"`
Sleep 300ms
Enter
Sleep 10s

Type "# HMAC signatures. Injection detection. Tamper-proof logs."
Enter
Sleep 2s
