# AI Phone Control via Termux

Control your Android phone from Claude/AI using Termux + Tailscale.

## Architecture

```
┌─────────────────┐         Tailscale          ┌─────────────────┐
│   Your Server   │◄──────────SSH─────────────►│  Android Phone  │
│                 │                             │                 │
│  Claude CLI     │    port 8022                │    Termux       │
│  phone_control  │◄───────────────────────────►│  termux-api     │
│  ler.py         │                             │  ai-execute.sh  │
└─────────────────┘                             └─────────────────┘
```

## Quick Start

### On Your Phone (Android)

1. **Install from F-Droid** (not Play Store):
   - Termux
   - Termux:API

2. **Run the setup script**:
   ```bash
   # In Termux, download and run:
   curl -sL https://raw.githubusercontent.com/YOUR_REPO/scripts/phone/termux-setup.sh | bash

   # Or copy-paste the script manually
   ```

3. **Start SSH server**:
   ```bash
   sshd
   ```

4. **Get your Tailscale IP**:
   ```bash
   ip addr show tailscale0
   ```

### On Your Server

1. **Test connection**:
   ```bash
   ssh -p 8022 u0_a123@100.x.x.x  # Your Termux user@Tailscale IP
   ```

2. **Use the Python controller**:
   ```python
   from admin.brain.phone_controller import get_phone
   import asyncio

   async def main():
       phone = get_phone("100.x.x.x")  # Your phone's Tailscale IP

       await phone.connect()
       await phone.speak("Hello from AI!")
       await phone.notify("Claude", "Task completed")

       battery = await phone.get_battery()
       print(f"Battery: {battery['percentage']}%")

   asyncio.run(main())
   ```

3. **CLI testing**:
   ```bash
   cd /path/to/project
   python -m admin.brain.phone_controller 100.x.x.x status
   python -m admin.brain.phone_controller 100.x.x.x speak "Hello world"
   ```

## Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `status` | Phone status overview | `phone.get_status()` |
| `notify` | Show notification | `phone.notify("Title", "Message")` |
| `speak` | Text-to-speech | `phone.speak("Hello")` |
| `toast` | Toast message | `phone.toast("Done!")` |
| `vibrate` | Vibrate phone | `phone.vibrate(500)` |
| `clipboard-get` | Get clipboard | `phone.get_clipboard()` |
| `clipboard-set` | Set clipboard | `phone.set_clipboard("text")` |
| `sms-send` | Send SMS | `phone.send_sms("+1234", "Hi")` |
| `sms-list` | List recent SMS | `phone.list_sms(10)` |
| `photo` | Take photo | `phone.take_photo()` |
| `location` | GPS location | `phone.get_location()` |
| `battery` | Battery status | `phone.get_battery()` |
| `volume` | Set volume | `phone.set_volume("music", 10)` |
| `torch` | Flashlight | `phone.torch(True)` |
| `open` | Open URL | `phone.open_url("https://...")` |
| `wifi` | WiFi info | `phone.get_wifi_info()` |
| `contacts` | List contacts | `phone.list_contacts()` |
| `call` | Make call | `phone.make_call("+1234")` |
| `share` | Share content | `phone.share_text("text")` |
| `raw` | Raw shell cmd | `phone.raw("ls /sdcard")` |

## Integration with Claude

When Claude is running on your server, it can use the phone controller to execute actions:

```python
# In your agent code
from admin.brain.phone_controller import get_phone

phone = get_phone("100.x.x.x")

# Claude decides to notify user
await phone.notify("Research Complete", "Found 5 relevant papers")

# Claude reads clipboard for context
clipboard = await phone.get_clipboard()

# Claude responds with voice
await phone.speak("I've completed the analysis you requested")
```

## Security Notes

- Connection is over Tailscale (encrypted, private network)
- SSH authentication required (password or key)
- Commands run in Termux sandbox (limited system access)
- Avoid exposing phone IP publicly

## Troubleshooting

**Can't connect?**
```bash
# On phone, check SSH is running
pgrep sshd

# Start if not running
sshd

# Check Tailscale is connected
tailscale status
```

**Permission denied?**
```bash
# On phone, grant Termux:API permissions
# Go to Settings > Apps > Termux:API > Permissions
# Enable all required permissions (SMS, Location, Camera, etc.)
```

**Commands not found?**
```bash
# On phone, reinstall termux-api
pkg install termux-api

# Test directly
termux-battery-status
```
