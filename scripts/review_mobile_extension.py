#!/usr/bin/env python3
"""
Runs the Beta Tester AI on the Mobile Extension source code.
"""

import os
import sys
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.beta_tester import get_beta_tester

def review_mobile_extension():
    tester = get_beta_tester()
    extension_path = "tools/mobile_extension"
    
    files_to_review = [
        ("manifest.json", "json"),
        ("background.js", "javascript"),
        ("popup/popup.html", "html"),
        ("popup/popup.css", "css"),
        ("popup/popup.js", "javascript")
    ]
    
    print(f"🚀 STARTING BETA TESTER REVIEW FOR: {extension_path}\n")
    
    full_report = {}
    
    for file_rel_path, artifact_type in files_to_review:
        file_path = os.path.join(extension_path, file_rel_path)
        if not os.path.exists(file_path):
            print(f"⚠️ Skipping {file_path} (not found)")
            continue
            
        print(f"🔍 Reviewing {file_path}...")
        try:
            with open(file_path, "r") as f:
                content = f.read()
            
            review = tester.review_artifact(artifact_type, content)
            full_report[file_rel_path] = review
            
            print(f"   Status: {review.get('blocker_status')} (Confidence: {review.get('confidence_score')})")
            print(f"   Summary: {review.get('summary')}")
            for issue in review.get('critical_issues', []):
                print(f"   ❌ {issue}")
            print("-" * 30)
            
        except Exception as e:
            print(f"   ❌ Failed to review {file_path}: {e}")

    # Final summary
    print("\n📊 FINAL BETA TESTER SUMMARY:")
    blockers = [f for f, r in full_report.items() if r.get('blocker_status') == "RAISED"]
    if blockers:
        print(f"🚨 BLOCKERS RAISED in: {', '.join(blockers)}")
    else:
        print("✅ NO BLOCKERS RAISED. Implementation looks solid.")

if __name__ == "__main__":
    review_mobile_extension()
