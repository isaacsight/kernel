import os
import sys
from admin.engineers.reddit_scrubber import RedditScrubber

# Mocked results from browser search
live_data = [
    {"title": "So you want to build AI agents? Here is the honest path.", "snippet": "An LLM that just talks back is a chatbot. An LLM that can run code or search the web is an agent.", "url": "https://www.reddit.com/r/AI_Agents/comments/so_you_want_to_build_ai_agents/"},
    {"title": "AI Agentic Engineering Roles", "snippet": "Most AI agentic engineers I’ve seen work across RAG pipelines, multi-agent orchestration, and real-world task integration.", "url": "https://www.reddit.com/r/AI_Agents/comments/ai_agentic_engineering_roles/"},
    {"title": "The AI agent bubble is popping and most startups won't survive 2026", "snippet": "The flashy demos are easy, the boring infrastructure work is what matters long term.", "url": "https://www.reddit.com/r/learnmachinelearning/comments/ai_agent_bubble/"}
]

def verify():
    print("🤖 Simulating Reddit Scrubber Analysis with Browser-Verified Data...")
    scrubber = RedditScrubber()
    
    # We bypass the search and call the analysis part directly
    findings_text = "\n".join([
        f"- Title: {r.get('title')}\n  Snippet: {r.get('snippet')}\n  URL: {r.get('url')}"
        for r in live_data
    ])
    
    prompt = f"""
    You are an AI Engineering Consultant optimizing a "Studio OS" (an operating system for AI agents).
    
    Analyze these Reddit discussions about AI Engineering:
    
    {findings_text}
    
    Identify:
    1. Emerging patterns or standard workflows.
    2. Common pain points developers are facing.
    3. Specific tools or libraries that are being recommended often.
    4. Concrete opportunities or features we should add to our Studio OS.
    
    Format the output as a Markdown report.
    """
    
    from admin.brain.model_router import get_model_router, TaskType
    model_router = get_model_router()
    model_info = model_router.select_model(TaskType.ANALYSIS)
    
    report = scrubber._simple_llm_call(model_info, prompt)
    
    print("\n✅ Analysis Report Generated Successfully:")
    print("="*60)
    print(report)
    print("="*60)
    
    # Save the report for the walkthrough
    with open("reddit_verification_report.md", "w") as f:
        f.write(report)

if __name__ == "__main__":
    verify()
