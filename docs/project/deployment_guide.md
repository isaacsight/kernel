# Deployment Guide: Moving to Windows

Your generic "Frontier Team" backend is ready to run on your Windows machine ("Always On" server).

## 1. Transfer Files
Copy the following files/folders from your Mac to a folder on your Windows machine (e.g., `C:\FrontierTeam`):

*   `server.py`
*   `core/` (Directory)
*   `docs/` (Directory)
*   `start_windows.bat`

## 2. Run on Windows
1.  Open the folder on Windows.
2.  Double-click `start_windows.bat`.
3.  It will install dependencies and start the server.

## 3. Connect from Phone
1.  Find your Windows machine's IP address (Run `ipconfig` in Command Prompt). Look for `IPv4 Address`.
2.  On your phone, browse to: `http://<WINDOWS_IP>:8000/static/mobile-test.html`

## Note
The current Mac server is still running if you want to test it *now*. But for the "always on" experience, follow the steps above.
