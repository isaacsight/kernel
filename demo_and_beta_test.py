
import sys
import os
import time

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from admin.engineers.beta_tester import BetaTester

def main():
    print("🚀 Starting Site Demo & Beta Test Simulation...")
    print("===============================================")
    
    # 1. Initialize Agent
    print("\n[System] Initializing BetaTester Agent...")
    tester = BetaTester()
    print(f"[System] Agent Online: {tester.name} {tester.emoji}")
    
    # 2. Register Beta Testers
    print("\n[System] recruiting fake beta testers...")
    fake_testers = [
        {"name": "Alice Engineer", "email": "alice@example.com", "interests": ["Tech", "Code"]},
        {"name": "Bob Designer", "email": "bob@example.com", "interests": ["UI/UX", "Typography"]},
        {"name": "Charlie Reader", "email": "charlie@example.com", "interests": ["Philosophy", "Life"]}
    ]
    
    tester_ids = []
    for t in fake_testers:
        result = tester.register_playtester(t["email"], t["name"], t["interests"])
        if result["success"]:
            t_id = result["tester"]["id"]
            tester_ids.append(t_id)
            print(f"  ✅ Registered: {t['name']} (ID: {t_id})")
        else:
            print(f"  ⚠️ Skipped: {t['name']} (Already registered)")
            # Try to find existing id if possible, effectively skipping for this simple demo
            
    # 3. functional Test (The "Demo")
    print(f"\n[System] Running functionality suite against http://localhost:8000...")
    report = tester.run_suite("http://localhost:8000", max_pages=10)
    
    print(f"  📊 Scan Complete.")
    print(f"  Pages Scanned: {report['pages_scanned']}")
    print(f"  Issues Found: {report['issues_found']}")
    print(f"  Broken Links: {report['broken_links']}")
    
    if report['issues_found'] > 0:
        print("\n  ❌ Issues Detected:")
        for issue in report['details']['issues']:
            print(f"    - [{issue['type'].upper()}] {issue['message']} on {issue.get('url', 'unknown')}")
            
    # 4. Simulate Feedback
    print("\n[System] Simulating Beta Tester Feedback...")
    import random
    
    scenarios = [
        {"category": "usability", "feedback": "The font size on mobile feels a bit small.", "severity": "medium", "feature": "Typography"},
        {"category": "praise", "feedback": "Love the dark mode aesthetic! Very premium.", "severity": "low", "feature": "Design"},
        {"category": "bug", "feedback": "The 'Subscribe' button flickers when I hover over it.", "severity": "low", "feature": "Newsletter"},
        {"category": "feature_request", "feedback": "Can we get a search bar for the archives?", "severity": "medium", "feature": "Navigation"},
        {"category": "praise", "feedback": "The article 'I Fired My AI Team' was hilarious.", "severity": "low", "feature": "Content"}
    ]
    
    for t_id in tester_ids:
        # Each tester gives 1-2 pieces of feedback
        num_feedback = random.randint(1, 2)
        for _ in range(num_feedback):
            scenario = random.choice(scenarios)
            tester.collect_feedback(
                tester_id=t_id,
                category=scenario["category"],
                feedback=scenario["feedback"],
                severity=scenario["severity"],
                feature=scenario["feature"]
            )
            print(f"  👤 Tester {t_id} says: \"{scenario['feedback']}\"")
            time.sleep(0.5)
            
    # 5. Generate Final Report
    print("\n[System] Generating Beta Test Report...")
    final_report = tester.generate_playtest_report()
    
    print("\n📝 FINAL REPORT")
    print("----------------")
    print(f"Total Testers: {final_report['total_testers']}")
    print(f"Total Feedback Items: {final_report['total_feedback']}")
    print("Feedback by Category:")
    for cat, count in final_report['by_category'].items():
        print(f"  - {cat}: {count}")
        
    print("\n✅ Demo Complete.")

if __name__ == "__main__":
    main()
