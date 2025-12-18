#!/usr/bin/env python3
"""
Demo script for the Beta Tester AI.
Shows the agent reviewing a sample Studio OS component.
"""

import os
import sys
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.beta_tester import get_beta_tester

def run_demo():
    print("🧪 INITIALIZING BETA TESTER AI...")
    tester = get_beta_tester()
    
    # Example 1: Reviewing a new CSS layout
    print("\n--- TEST CASE 1: CSS Review ---")
    css_content = """
    .dashboard-grid {
        display: grid;
        grid-template_columns: repeat(3, 1fr);
        gap: 20px;
    }
    
    .card {
        background: white;
        padding: 10px;
        border: 1px solid #ccc;
    }
    """
    review = tester.review_artifact("css", css_content)
    print(f"Summary: {review.get('summary')}")
    print(f"Blocker Status: {review.get('blocker_status')}")
    print(f"Confidence: {review.get('confidence_score')}")
    
    print("\nCritical Issues:")
    for issue in review.get('critical_issues', []):
        print(f"  ❌ {issue}")

    # Example 2: Simulating User Friction
    print("\n--- TEST CASE 2: UX Friction Simulation ---")
    ui_context = "A dashboard with a tiny 'Delete All Posts' button right next to the 'Save' button, both using the same blue color."
    simulation = tester.simulate_user_interaction(ui_context)
    print(f"Tester's Stream of Consciousness:\n{simulation}")

if __name__ == "__main__":
    run_demo()
