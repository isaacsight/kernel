#!/usr/bin/env python3
"""
Test the Creative Director's leadership integration.
"""

import sys
from admin.engineers.creative_director import CreativeDirector
from admin.engineers.tiktok_workflow import TikTokWorkflow

def test_leadership():
    print("=" * 60)
    print("👔 Creative Leadership Integration Test")
    print("=" * 60)
    
    cd = CreativeDirector()
    
    # Test 1: Banned Phrase (Should Reject)
    print("\n🚫 Test 1: Banned Phrase ('smash that like button')")
    bad_script = "Hey guys! Today we're talking about AI. Smash that like button and subscribe!"
    review = cd.review_tiktok_script(bad_script, "upbeat")
    
    if not review["approved"]:
        print("   ✅ CORRECTLY REJECTED")
        print(f"   Reason: {review['issues']}")
    else:
        print("   ❌ FAILED (Should have rejected)")
        
    # Test 2: Too Hype (Should Reject)
    print("\n🚫 Test 2: Too Hype (Too many exclamations)")
    hype_script = "This is amazing! You won't believe it! It's the best thing ever! Wow!"
    review = cd.review_tiktok_script(hype_script, "upbeat")
    
    if not review["approved"]:
        print("   ✅ CORRECTLY REJECTED")
        print(f"   Reason: {review['issues']}")
    else:
        print("   ❌ FAILED (Should have rejected)")
        
    # Test 3: On Brand (Should Approve)
    print("\n✅ Test 3: On Brand (Calm, reflective)")
    good_script = "I've been thinking about silence lately. In a noisy world, it's a rare commodity."
    review = cd.review_tiktok_script(good_script, "chill")
    
    if review["approved"]:
        print("   ✅ CORRECTLY APPROVED")
    else:
        print(f"   ❌ FAILED (Should have approved): {review['issues']}")
        
    print("\n" + "=" * 60)
    print("Test Complete")

if __name__ == "__main__":
    test_leadership()
