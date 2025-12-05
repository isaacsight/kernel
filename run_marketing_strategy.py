#!/usr/bin/env python3
"""
Simulates a strategy session between the Marketing Strategist and the TikTok Team.
"""

import json
import logging
from admin.engineers.marketing_strategist import MarketingStrategist

# Configure logging to show the "conversation"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(name)s] - %(message)s',
    datefmt='%H:%M:%S'
)

def run_strategy_session():
    print("=" * 60)
    print("🧠 STRATEGY SESSION: Marketing x TikTok Team")
    print("=" * 60)
    
    cmo = MarketingStrategist()
    topic = "I Fired My AI Social Media Team"
    
    print(f"\n📋 Agenda: Develop campaign for '{topic}'")
    print("-" * 60)
    
    # Run the coordination
    campaign = cmo.coordinate_tiktok_campaign(topic)
    
    print("\n\n📄 CAMPAIGN BRIEF GENERATED")
    print("=" * 60)
    
    print(f"🎯 Objective: {campaign['objective']}")
    print(f"👥 Target Audience: {', '.join(campaign['target_audience'])}")
    
    print("\n📐 Campaign Angles:")
    for angle in campaign['angles']:
        print(f"   • {angle['angle']}: \"{angle['hook']}\"")
        
    print("\n🛡️ Brand Guardrails (Creative Director):")
    print(f"   • Voice: {', '.join(campaign['brand_guardrails']['voice'])}")
    print(f"   • Avoid: {', '.join(campaign['brand_guardrails']['avoid'])}")
    
    print("\n🔥 Viral Tactics (Viral Coach):")
    for tactic in campaign['viral_tactics']:
        print(f"   • {tactic}")
        
    print("\n🚀 Execution Plan:")
    for step in campaign['execution_plan']:
        print(f"   • {step}")
        
    print("\n" + "=" * 60)
    print("✅ Strategy Approved")

if __name__ == "__main__":
    run_strategy_session()
