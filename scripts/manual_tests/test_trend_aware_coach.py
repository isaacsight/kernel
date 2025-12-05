"""
Test script for Trend-Aware Viral Coach.
Verifies that the coach detects trends and adjusts scores.
"""
import json
from admin.engineers.viral_coach import ViralCoach

def test_trend_awareness():
    coach = ViralCoach()
    
    # 1. Test with a generic script (should have low trend score)
    print("🧪 Testing Generic Script...")
    generic_script = """
    Hello everyone. Today I want to talk about how to write code.
    It is very important to write clean code.
    Follow for more tips.
    """
    analysis_generic = coach.analyze_tiktok_script(generic_script)
    print(f"   Trend Score: {analysis_generic['trend_score']}/10")
    print(f"   Suggestion: {analysis_generic['suggestions'][-1]}")
    
    # 2. Test with a trendy script (should have high trend score)
    print("\n🧪 Testing Trendy Script...")
    # Note: TrendScout has "AI Agents" and "Coding with AI" as trends
    trendy_script = """
    Stop coding manually! AI Agents are taking over.
    I just used Cursor to build a whole app in 5 minutes.
    This changes everything about coding with AI.
    Link in bio.
    """
    analysis_trendy = coach.analyze_tiktok_script(trendy_script)
    print(f"   Trend Score: {analysis_trendy['trend_score']}/10")
    print(f"   Trend Context: {analysis_trendy['trend_context']}")
    
    if analysis_trendy['trend_score'] > analysis_generic['trend_score']:
        print("\n✅ SUCCESS: Trendy script scored higher on trends.")
    else:
        print("\n❌ FAILURE: Trend detection not working as expected.")

if __name__ == "__main__":
    test_trend_awareness()
