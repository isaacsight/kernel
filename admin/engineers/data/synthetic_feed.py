import json
import random
import time
from datetime import datetime

# --- 1. The Raw Signal (Data Layer) ---
# In a real system, this comes from the Database or Context Bridge.
SIGNALS = [
    {"type": "system_log", "level": "WARN", "msg": "GPU Temp 82C"},
    {"type": "user_action", "action": "click", "target": "auth_node"},
    {"type": "agent_state", "agent": "ContextBridge", "status": "Idle"},
    {"type": "market_data", "symbol": "NVDA", "price": 1042.50}
]

# --- 2. The Synthetic Component (UI Layer) ---
# A standardized schema for rendering any data as UI.
class SyntheticComponent:
    def __init__(self, variant, props):
        self.variant = variant  # e.g., 'Card', 'Ticker', 'Alert'
        self.props = props      # Data needed to render
        self.timestamp = datetime.now().isoformat()

    def to_json(self):
        return {
            "component": self.variant,
            "props": self.props,
            "_meta": {"ts": self.timestamp}
        }

# --- 3. The Projection Engine (Transformation Layer) ---
# "Thinking" about how to show data.
def project_signal_to_ui(signal):
    # Pattern Matching
    if signal["type"] == "system_log":
        color = "red" if signal["level"] == "ERROR" else "yellow"
        return SyntheticComponent("AlertBanner", {
            "message": f"[{signal['level']}] {signal['msg']}",
            "severity": color,
            "icon": "warning"
        })
    
    elif signal["type"] == "user_action":
        return SyntheticComponent("ActivityExerpt", {
            "username": "Admin",
            "action_text": f"interacted with {signal['target']}",
            "timestamp": "Just now"
        })

    elif signal["type"] == "agent_state":
        return SyntheticComponent("StatusBadge", {
            "label": signal["agent"],
            "status": signal["status"].lower(),
            "pulse": True if signal["status"] == "Active" else False
        })
        
    elif signal["type"] == "market_data":
        return SyntheticComponent("MetricCard", {
            "title": signal["symbol"],
            "value": f"${signal['price']}",
            "trend": "up" # simplified
        })
        
    return SyntheticComponent("RawJson", {"data": signal})

# --- 4. The Feed Generator (Infinite Loop) ---
def generate_feed(count=5):
    feed = []
    print(f"🌊 Synthesizing {count} UI Components from raw signals...\n")
    
    for _ in range(count):
        # 1. Pick a random signal
        raw_sig = random.choice(SIGNALS)
        
        # 2. Transmute to UI
        component = project_signal_to_ui(raw_sig)
        
        # 3. Add to Feed
        feed.append(component.to_json())
        
        # Sim Processing Time
        time.sleep(0.1)

    return feed

if __name__ == "__main__":
    ui_feed = generate_feed(5)
    
    # Output the JSON that the Frontend would consume
    print(json.dumps(ui_feed, indent=2))
    print(f"\n✅ Generated {len(ui_feed)} Synthetic Components.")
