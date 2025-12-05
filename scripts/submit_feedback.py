import sys
import os
import argparse
import logging

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.brain.collective_intelligence import get_collective_intelligence

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FeedbackLoop")

def submit(score, feedback, template="storytime"):
    collective = get_collective_intelligence()
    
    context = f"tiktok {template}"
    if score >= 8:
        outcome = "positive"
        lesson_text = f"User Feedback: {feedback} (Score: {score})"
    else:
        outcome = "negative"
        lesson_text = f"Correction: {feedback} (Score: {score})"
        
    collective.learn_lesson(
        agent_name="User",
        lesson=lesson_text,
        context=context,
        outcome=outcome
    )
    
    print(f"✅ Learned lesson for '{context}': {lesson_text}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--score", type=int, required=True, help="Score from 1-10")
    parser.add_argument("--feedback", type=str, required=True, help="Feedback text")
    parser.add_argument("--template", type=str, default="storytime", help="Template used")
    
    args = parser.parse_args()
    submit(args.score, args.feedback, args.template)
