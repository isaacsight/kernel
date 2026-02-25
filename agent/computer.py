"""
macOS Computer Control Module
Screen capture, mouse, and keyboard control for Claude's computer_use tool.
"""

import base64
import io
import subprocess
import time

import pyautogui
from PIL import Image

# Safety: move mouse to any corner to abort
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1

# X11/Linux key names → macOS equivalents
KEY_TRANSLATION = {
    "super": "command",
    "Super_L": "command",
    "Super_R": "command",
    "alt": "option",
    "Alt_L": "option",
    "Alt_R": "option",
    "control": "ctrl",
    "Control_L": "ctrl",
    "Control_R": "ctrl",
    "Return": "return",
    "BackSpace": "backspace",
    "Delete": "delete",
    "Escape": "escape",
    "Tab": "tab",
    "space": "space",
    "Page_Up": "pageup",
    "Page_Down": "pagedown",
    "Home": "home",
    "End": "end",
    "Up": "up",
    "Down": "down",
    "Left": "left",
    "Right": "right",
}


def get_screen_dimensions():
    """Get logical and physical screen dimensions on macOS."""
    result = subprocess.run(
        ["system_profiler", "SPDisplaysDataType"],
        capture_output=True, text=True
    )
    output = result.stdout

    logical_w, logical_h = pyautogui.size()

    # Try to detect physical (Retina) resolution from system_profiler
    physical_w, physical_h = logical_w, logical_h
    for line in output.splitlines():
        line = line.strip()
        if "Resolution" in line and "Retina" in line:
            # e.g. "Resolution: 3024 x 1964 Retina"
            parts = line.split(":")[-1].strip().split()
            try:
                physical_w = int(parts[0])
                physical_h = int(parts[2])
            except (IndexError, ValueError):
                pass
            break
        elif "Resolution" in line:
            parts = line.split(":")[-1].strip().split()
            try:
                physical_w = int(parts[0])
                physical_h = int(parts[2])
            except (IndexError, ValueError):
                pass
            break

    return logical_w, logical_h, physical_w, physical_h


def compute_api_dimensions(physical_w, physical_h):
    """
    Scale physical resolution down to fit within Claude's limits:
    max 1568px on longest side, max ~1.15MP total.
    Returns (api_w, api_h).
    """
    max_dim = 1568
    max_pixels = 1_150_000

    scale = 1.0
    if max(physical_w, physical_h) > max_dim:
        scale = max_dim / max(physical_w, physical_h)

    api_w = int(physical_w * scale)
    api_h = int(physical_h * scale)

    # Also check total pixel count
    if api_w * api_h > max_pixels:
        ratio = (max_pixels / (api_w * api_h)) ** 0.5
        api_w = int(api_w * ratio)
        api_h = int(api_h * ratio)

    return api_w, api_h


def take_screenshot(api_w, api_h):
    """Capture screen, resize for API, return base64-encoded PNG."""
    tmp_path = "/tmp/agent_screenshot.png"
    subprocess.run(
        ["screencapture", "-x", "-C", tmp_path],
        capture_output=True
    )

    img = Image.open(tmp_path)
    img = img.resize((api_w, api_h), Image.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.standard_b64encode(buffer.getvalue()).decode("utf-8")


def _translate_key(key):
    """Translate X11/generic key names to macOS names."""
    return KEY_TRANSLATION.get(key, key)


def execute(action, coordinate=None, text=None, duration=None,
            scroll_direction=None, scroll_amount=None,
            start_coordinate=None, button=None,
            api_w=None, api_h=None,
            logical_w=None, logical_h=None):
    """
    Execute a computer action from the Claude API.
    Converts API coordinates → logical (pyautogui) coordinates.
    """

    def api_to_logical(coord):
        """Convert API-space coordinates to pyautogui logical coordinates."""
        x = int(coord[0] * logical_w / api_w)
        y = int(coord[1] * logical_h / api_h)
        return x, y

    mouse_button = button or "left"

    if action == "screenshot":
        return take_screenshot(api_w, api_h)

    elif action == "left_click":
        x, y = api_to_logical(coordinate)
        pyautogui.click(x, y, button="left")

    elif action == "right_click":
        x, y = api_to_logical(coordinate)
        pyautogui.click(x, y, button="right")

    elif action == "double_click":
        x, y = api_to_logical(coordinate)
        pyautogui.doubleClick(x, y)

    elif action == "triple_click":
        x, y = api_to_logical(coordinate)
        pyautogui.click(x, y, clicks=3)

    elif action == "middle_click":
        x, y = api_to_logical(coordinate)
        pyautogui.click(x, y, button="middle")

    elif action == "mouse_move":
        x, y = api_to_logical(coordinate)
        pyautogui.moveTo(x, y)

    elif action == "left_click_drag":
        sx, sy = api_to_logical(start_coordinate or coordinate)
        ex, ey = api_to_logical(coordinate)
        pyautogui.moveTo(sx, sy)
        dur = (duration or 500) / 1000.0
        pyautogui.drag(ex - sx, ey - sy, duration=dur, button="left")

    elif action == "key":
        # text contains key combo like "ctrl+c" or "command+shift+t"
        keys = [_translate_key(k.strip()) for k in text.split("+")]
        if len(keys) == 1:
            pyautogui.press(keys[0])
        else:
            pyautogui.hotkey(*keys)

    elif action == "type":
        # Type text character by character with small delay
        pyautogui.typewrite(text, interval=0.02) if text.isascii() else _type_unicode(text)

    elif action == "scroll":
        # scroll_direction: "up", "down", "left", "right"
        amount = scroll_amount or 3
        if coordinate:
            x, y = api_to_logical(coordinate)
            pyautogui.moveTo(x, y)

        if scroll_direction == "up":
            pyautogui.scroll(amount)
        elif scroll_direction == "down":
            pyautogui.scroll(-amount)
        elif scroll_direction == "left":
            pyautogui.hscroll(-amount)
        elif scroll_direction == "right":
            pyautogui.hscroll(amount)

    elif action == "wait":
        time.sleep((duration or 1000) / 1000.0)

    else:
        raise ValueError(f"Unknown action: {action}")

    return None


def _type_unicode(text):
    """Type unicode text using macOS pbcopy + Cmd+V."""
    process = subprocess.Popen(
        ["pbcopy"], stdin=subprocess.PIPE
    )
    process.communicate(text.encode("utf-8"))
    pyautogui.hotkey("command", "v")
    time.sleep(0.1)
