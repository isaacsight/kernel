#!/data/data/com.termux/files/usr/bin/bash
# =============================================================================
# Termux Setup Script for AI Phone Control
# Run this on your Android phone in Termux
# =============================================================================

set -e

echo "========================================"
echo "  AI Phone Control - Termux Setup"
echo "========================================"

# Update and install essentials
echo "[1/6] Updating packages..."
pkg update -y && pkg upgrade -y

# Install required packages
echo "[2/6] Installing SSH server and tools..."
pkg install -y openssh termux-api python jq curl

# Setup SSH server
echo "[3/6] Configuring SSH server..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Generate host keys if they don't exist
if [ ! -f ~/.ssh/ssh_host_rsa_key ]; then
    ssh-keygen -t rsa -f ~/.ssh/ssh_host_rsa_key -N ""
fi

# Set password for SSH
echo "[4/6] Setting up SSH access..."
echo "Enter a password for SSH access:"
passwd

# Create the AI command receiver script
echo "[5/6] Creating AI command interface..."
mkdir -p ~/.termux/scripts

cat > ~/.termux/scripts/ai-execute.sh << 'SCRIPT'
#!/data/data/com.termux/files/usr/bin/bash
# AI Command Executor - receives and runs commands safely

COMMAND="$1"
shift
ARGS="$@"

case "$COMMAND" in
    # Notifications
    notify)
        termux-notification --title "${1:-AI}" --content "${2:-Notification}"
        ;;

    # Speech
    speak)
        termux-tts-speak "$ARGS"
        ;;

    # Clipboard
    clipboard-get)
        termux-clipboard-get
        ;;
    clipboard-set)
        echo "$ARGS" | termux-clipboard-set
        echo "Clipboard set"
        ;;

    # SMS
    sms-send)
        # Usage: sms-send NUMBER MESSAGE
        termux-sms-send -n "$1" "$2"
        echo "SMS sent to $1"
        ;;
    sms-list)
        termux-sms-list -l ${1:-10} | jq -r '.[] | "\(.number): \(.body)"'
        ;;

    # Camera
    photo)
        OUTFILE="${1:-/sdcard/ai-photo.jpg}"
        termux-camera-photo "$OUTFILE"
        echo "Photo saved to $OUTFILE"
        ;;

    # Location
    location)
        termux-location -p network | jq -r '"Lat: \(.latitude), Lon: \(.longitude)"'
        ;;

    # Battery
    battery)
        termux-battery-status | jq -r '"Battery: \(.percentage)% (\(.status))"'
        ;;

    # Volume
    volume)
        termux-volume "$1" "$2"
        echo "Volume set: $1 = $2"
        ;;

    # Vibrate
    vibrate)
        termux-vibrate -d ${1:-500}
        echo "Vibrated for ${1:-500}ms"
        ;;

    # Open URL or app
    open)
        termux-open-url "$1"
        echo "Opened: $1"
        ;;

    # Torch/flashlight
    torch)
        termux-torch "$1"
        echo "Torch: $1"
        ;;

    # WiFi info
    wifi)
        termux-wifi-connectioninfo | jq -r '"SSID: \(.ssid), IP: \(.ip)"'
        ;;

    # Contacts
    contacts)
        termux-contact-list | jq -r '.[] | "\(.name): \(.number)"' | head -${1:-20}
        ;;

    # Call (requires additional permissions)
    call)
        termux-telephony-call "$1"
        echo "Calling $1..."
        ;;

    # Sensor data
    sensors)
        termux-sensor -s "$1" -n 1 2>/dev/null || echo "Sensor not available"
        ;;

    # Download file
    download)
        curl -L -o "${2:-/sdcard/download}" "$1"
        echo "Downloaded to ${2:-/sdcard/download}"
        ;;

    # Share text/file
    share)
        if [ -f "$1" ]; then
            termux-share -a send "$1"
        else
            echo "$ARGS" | termux-share -a send
        fi
        ;;

    # Media controls
    media-play)
        termux-media-player play "$1"
        ;;
    media-pause)
        termux-media-player pause
        ;;

    # Dialog/input from user
    dialog)
        termux-dialog -t "$1" -i "${2:-text}"
        ;;

    # Fingerprint auth
    fingerprint)
        termux-fingerprint -t "${1:-Authenticate}" && echo "Authenticated" || echo "Failed"
        ;;

    # Toast message
    toast)
        termux-toast "$ARGS"
        ;;

    # Status - return phone state
    status)
        echo "=== Phone Status ==="
        termux-battery-status | jq -r '"Battery: \(.percentage)% (\(.status))"'
        termux-wifi-connectioninfo 2>/dev/null | jq -r '"WiFi: \(.ssid)"' || echo "WiFi: Disconnected"
        echo "Time: $(date)"
        ;;

    # Raw command (careful!)
    raw)
        eval "$ARGS"
        ;;

    # Help
    help|*)
        echo "Available commands:"
        echo "  notify TITLE MESSAGE   - Show notification"
        echo "  speak TEXT            - Text to speech"
        echo "  clipboard-get         - Get clipboard"
        echo "  clipboard-set TEXT    - Set clipboard"
        echo "  sms-send NUM MSG      - Send SMS"
        echo "  sms-list [N]          - List N recent SMS"
        echo "  photo [PATH]          - Take photo"
        echo "  location              - Get GPS location"
        echo "  battery               - Battery status"
        echo "  volume TYPE LEVEL     - Set volume"
        echo "  vibrate [MS]          - Vibrate phone"
        echo "  open URL              - Open URL/app"
        echo "  torch on|off          - Flashlight"
        echo "  wifi                  - WiFi info"
        echo "  contacts [N]          - List contacts"
        echo "  call NUMBER           - Make call"
        echo "  share TEXT/FILE       - Share content"
        echo "  toast MESSAGE         - Show toast"
        echo "  status                - Phone status"
        echo "  raw COMMAND           - Run raw command"
        ;;
esac
SCRIPT

chmod +x ~/.termux/scripts/ai-execute.sh

# Add to PATH
echo 'export PATH="$PATH:$HOME/.termux/scripts"' >> ~/.bashrc

# Get Tailscale IP for connection
echo "[6/6] Getting connection info..."
echo ""
echo "========================================"
echo "  SETUP COMPLETE!"
echo "========================================"
echo ""
echo "To start SSH server, run:"
echo "  sshd"
echo ""
echo "Your Termux SSH info:"
echo "  User: $(whoami)"
echo "  Port: 8022"
echo ""

# Try to get Tailscale IP
if command -v ip &> /dev/null; then
    TAILSCALE_IP=$(ip addr show tailscale0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
    if [ -n "$TAILSCALE_IP" ]; then
        echo "  Tailscale IP: $TAILSCALE_IP"
        echo ""
        echo "Connect from server:"
        echo "  ssh -p 8022 $(whoami)@$TAILSCALE_IP"
    fi
fi

echo ""
echo "Test AI command:"
echo "  ai-execute.sh status"
echo ""
echo "Run 'sshd' to start the SSH server!"
