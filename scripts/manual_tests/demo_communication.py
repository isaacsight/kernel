#!/usr/bin/env python3
"""
Demo: Watch the Communication Analyzer track a "generate post" request.

This simulates what happens when you send a command from your phone.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from admin.engineers.command_router import route_and_log
from admin.engineers.communication_analyzer import get_communication_analyzer

def demo_communication():
    print("=" * 60)
    print("📡 COMMUNICATION ANALYZER LIVE DEMO")
    print("=" * 60)
    
    # Get analyzer instance
    analyzer = get_communication_analyzer()
    
    # Show initial state
    print("\n📊 INITIAL STATE:")
    health = analyzer.get_communication_health()
    print(f"   Health Score: {health['health_score']}/10 {health['status_emoji']}")
    print(f"   Total Logged: {health['metrics']['total_conversations']} conversations")
    
    # Simulate phone request
    phone_message = "Create a blog post about how AI agents communicate with each other"
    print(f"\n📱 PHONE REQUEST:")
    print(f"   \"{phone_message}\"")
    print("\n⏳ Processing...")
    
    # Route and log (this is what happens when your phone sends a message)
    result = route_and_log(
        user_input=phone_message,
        session_id="iphone-demo-session"
    )
    
    # Show the response
    print("\n🤖 AI RESPONSE:")
    if result.get("success"):
        print(f"   Intent: {result.get('intent', 'unknown')}")
        print(f"   Action: {result.get('action', 'none')}")
        print(f"   Message: {result.get('message', 'No message')[:100]}...")
        print(f"   Conversation ID: {result.get('conversation_id', 'N/A')}")
        
        if result.get('data'):
            print(f"   Data: {json.dumps(result['data'], indent=6)[:200]}...")
    else:
        print(f"   ❌ Failed: {result.get('message', 'Unknown error')}")
    
    # Now show what was logged
    print("\n" + "=" * 60)
    print("📝 WHAT GOT LOGGED:")
    print("=" * 60)
    
    # Get the latest conversation
    history = analyzer.get_conversation_history(limit=1)
    if history:
        conv = history[0]
        print(f"""
   ID: {conv['id']}
   Timestamp: {conv['timestamp']}
   User Input: "{conv['user_input'][:50]}..."
   Detected Intent: {conv['detected_intent']}
   Action: {conv['action']}
   Routed To: {conv['routed_to']}
   Success: {'✅' if conv['execution_success'] else '❌'}
   Response Time: {conv['response_time_ms']}ms
   Session: {conv['session_id']}
""")
    
    # Show updated analytics
    print("=" * 60)
    print("📊 UPDATED ANALYTICS:")
    print("=" * 60)
    
    analytics = analyzer.get_analytics()
    print(f"""
   Total Conversations: {analytics.get('total_conversations', 0)}
   Success Rate: {analytics.get('success_rate', 0) * 100:.1f}%
   Intent Distribution: {json.dumps(analytics.get('intent_distribution', {}), indent=6)}
   Avg Response Time: {analytics.get('avg_response_time_ms', 0):.0f}ms
""")
    
    # Show health dashboard
    print("=" * 60)
    print("🏥 COMMUNICATION HEALTH:")
    print("=" * 60)
    print(analyzer.format_dashboard())
    
    print("\n✅ Demo complete! The conversation has been logged and analyzed.")
    print("   View full dashboard at: http://localhost:5001/communication")


if __name__ == "__main__":
    demo_communication()
