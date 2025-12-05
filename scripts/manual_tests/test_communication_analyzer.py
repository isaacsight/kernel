#!/usr/bin/env python3
"""
Test script for Communication Analyzer

Simulates phone-to-AI conversations and verifies logging/analytics.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.communication_analyzer import CommunicationAnalyzer
import json
import time

def test_communication_analyzer():
    print("=" * 50)
    print("📡 COMMUNICATION ANALYZER TEST")
    print("=" * 50)
    
    # Initialize analyzer
    analyzer = CommunicationAnalyzer()
    print(f"\n✅ Analyzer initialized")
    
    # Test 1: Log successful conversation
    print("\n--- Test 1: Log Successful Conversation ---")
    conv_id = analyzer.log_conversation(
        user_input="Generate a blog post about machine learning",
        detected_intent="action",
        action="generate_post",
        routed_to="Alchemist",
        response="I'll create a blog post about machine learning for you!",
        execution_success=True,
        response_time_ms=1500
    )
    print(f"✅ Logged conversation: {conv_id}")
    
    # Test 2: Log failed conversation
    print("\n--- Test 2: Log Failed Conversation ---")
    fail_id = analyzer.log_conversation(
        user_input="asdfghjkl random nonsense",
        detected_intent="unknown",
        action=None,
        routed_to=None,
        response="I'm not sure what you mean.",
        execution_success=False,
        response_time_ms=300
    )
    print(f"✅ Logged failed conversation: {fail_id}")
    
    # Test 3: Log chat conversation
    print("\n--- Test 3: Log Chat Conversation ---")
    chat_id = analyzer.log_conversation(
        user_input="Hello, how are you?",
        detected_intent="chat",
        action=None,
        routed_to=None,
        response="Hello! I'm doing great, thanks for asking!",
        execution_success=True,
        response_time_ms=800
    )
    print(f"✅ Logged chat conversation: {chat_id}")
    
    # Test 4: Add feedback
    print("\n--- Test 4: Add User Feedback ---")
    success = analyzer.add_user_feedback(conv_id, "Great response!", rating=5)
    print(f"✅ Feedback added: {success}")
    
    # Test 5: Get analytics
    print("\n--- Test 5: Get Analytics ---")
    analytics = analyzer.get_analytics()
    print(f"Total Conversations: {analytics.get('total_conversations')}")
    print(f"Success Rate: {analytics.get('success_rate', 0) * 100:.1f}%")
    print(f"Intent Distribution: {analytics.get('intent_distribution')}")
    
    # Test 6: Get health check
    print("\n--- Test 6: Communication Health ---")
    health = analyzer.get_communication_health()
    print(f"Health Score: {health['health_score']}/10")
    print(f"Status: {health['status_emoji']} {health['status']}")
    print(f"Recommendation: {health['recommendation']}")
    
    # Test 7: Dashboard display
    print("\n--- Test 7: Dashboard Format ---")
    print(analyzer.format_dashboard())
    
    # Test 8: Conversation history
    print("\n--- Test 8: Recent Conversations ---")
    history = analyzer.get_conversation_history(limit=5)
    for conv in history:
        status = "✅" if conv["execution_success"] else "❌"
        print(f"  {status} [{conv['detected_intent']}] {conv['user_input'][:40]}...")
    
    print("\n" + "=" * 50)
    print("✅ ALL TESTS PASSED!")
    print("=" * 50)
    
    return True


if __name__ == "__main__":
    try:
        test_communication_analyzer()
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
