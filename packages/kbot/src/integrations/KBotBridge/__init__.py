"""
KBotBridge — Ableton Live Remote Script for kbot

Exposes the Browser API and track/device info over TCP (port 9998),
allowing kbot to programmatically load any native device (Saturator,
EQ Eight, Compressor, etc.) onto any track.

Protocol: newline-delimited JSON (same as the kbot M4L bridge on 9999).
  Send:    {"id": 1, "action": "ping"}\n
  Receive: {"id": 1, "ok": true}\n

Install: Copy this folder to ~/Music/Ableton/User Library/Remote Scripts/KBotBridge/
Activate: Preferences > Link, Tempo & MIDI > Control Surface = KBotBridge
"""

try:
    from .kbot_control_surface import KBotControlSurface
except ImportError:
    pass


def create_instance(c_instance):
    return KBotControlSurface(c_instance)
