import json
import logging
import os
import sys
import time
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime

# Add root directory to sys.path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    from admin.config import config
    import google.generativeai as genai
except ImportError as e:
    logger.error(f"Import failed: {e}")
    # Fallback for testing environments without config
    config = None
    genai = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CommunityManager")

@dataclass
class Comment:
    id: str
    author: str
    text: str
    platform: str
    timestamp: str
    post_id: str
    replied: bool = False

class CommunityManager:
    """
    The Community Manager agent responsible for engagement.
    Monitors comments, analyzes sentiment, and drafts on-brand replies.
    """
    
    def __init__(self):
        self.name = "Community Manager"
        self.role = "Engagement Specialist"
        self.persona = """
        You are Isaac, the creator of this blog/channel. 
        You are a friendly, tech-savvy, and professional Software Engineer.
        You appreciate thoughtful questions and constructive feedback.
        You ignore or politely deflect trolls.
        You define yourself as an "AI Engineer" and "Agentic Developer".
        Tone: Casual but polished, enthusiastic about AI, helpful.
        """
        
        # Configure AI
        if config and config.GEMINI_API_KEY and genai:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
            self.has_ai = True
        else:
            self.has_ai = False
            logger.warning("Gemini API key not found or libraries missing. Running in mock mode.")

        # Data storage
        self.brain_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "brain")
        self.comments_db_path = os.path.join(self.brain_dir, "mock_comments.json")
        os.makedirs(self.brain_dir, exist_ok=True)

    def run(self):
        """Main loop for the Community Manager."""
        logger.info(f"👋 {self.name} reporting for duty.")
        self._check_mock_feed()

    def _check_mock_feed(self):
        """Simulates checking a social feed."""
        logger.info("🔎 Checking feeds for new comments...")
        comments = self._load_comments()
        
        new_comments = [c for c in comments if not c.replied]
        logger.info(f"Found {len(new_comments)} new comments.")
        
        for comment in new_comments:
            self._process_comment(comment)

    def _process_comment(self, comment: Comment):
        """Analyzes and replies to a single comment."""
        logger.info(f"Processing comment from {comment.author}: {comment.text}")
        
        # 1. Analyze
        analysis = self.analyze_comment(comment)
        
        if not analysis.get("safe", False):
            logger.warning(f"⚠️ Flagged unsafe comment from {comment.author}: {comment.text}")
            return

        # 2. Decide if we should reply
        if analysis.get("requires_reply", True):
            reply = self.generate_reply(comment, analysis)
            logger.info(f"📝 Drafted reply: {reply}")
            
            # 3. "Post" the reply (Mock)
            self._post_reply_mock(comment, reply)
            
            # 4. Mark as replied
            comment.replied = True
            self._update_comment_status(comment)

    def analyze_comment(self, comment: Comment) -> Dict:
        """Uses LLM to analyze sentiment, safety, and intent."""
        if not self.has_ai:
            return {"sentiment": "neutral", "safe": True, "requires_reply": True, "intent": "unknown"}

        prompt = f"""
        Analyze the following social media comment.
        Author: {comment.author}
        Text: "{comment.text}"
        
        Return a JSON object with:
        - sentiment: "positive", "neutral", "negative"
        - safe: boolean (is it safe/appropriate?)
        - intent: "question", "praise", "critique", "spam", "troll"
        - requires_reply: boolean (should I reply?)
        - summary: one sentence summary
        """
        
        try:
            response = self.model.generate_content(prompt)
            # Basic cleanup if model wraps json in markdown
            text = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(text)
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            return {"sentiment": "neutral", "safe": True, "requires_reply": True}

    def generate_reply(self, comment: Comment, analysis: Dict) -> str:
        """Drafts a reply based on persona and analysis."""
        if not self.has_ai:
            return f"Thanks for the comment, @{comment.author}! (Mock Reply)"

        prompt = f"""
        {self.persona}
        
        Task: Draft a reply to this comment.
        Comment: "{comment.text}"
        Author: {comment.author}
        Analysis: {analysis}
        
        Context: They are commenting on a post about AI Agents.
        
        Guidelines:
        - Keep it short (under 280 chars if possible, but flexible).
        - Be helpful and engaging.
        - If it's praise, say thanks nicely.
        - If it's a question, answer it or promise a follow-up.
        - Do not sound like a generic robot.
        
        Reply Text Only:
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            return f"Error generating reply: {e}"

    def _post_reply_mock(self, comment: Comment, reply_text: str):
        print(f"\n[MOCK REPLY on {comment.platform}]")
        print(f"To @{comment.author}: {reply_text}\n")

    def _load_comments(self) -> List[Comment]:
        if not os.path.exists(self.comments_db_path):
            self._create_mock_db()
            
        with open(self.comments_db_path, 'r') as f:
            data = json.load(f)
            return [Comment(**item) for item in data]

    def _update_comment_status(self, updated_comment: Comment):
        comments = self._load_comments()
        # Convert objects to dicts for list manipulation/saving if needed, 
        # but here we load fresh list of dicts or just update the loaded list.
        # Let's reload to be safe or just map existing.
        
        new_data = []
        for c in comments:
            if c.id == updated_comment.id:
                new_data.append(updated_comment.__dict__)
            else:
                new_data.append(c.__dict__)
        
        with open(self.comments_db_path, 'w') as f:
            json.dump(new_data, f, indent=2)

    def _create_mock_db(self):
        """Creates some dummy data for testing."""
        mock_data = [
            {
                "id": "c1",
                "author": "TechFan99",
                "text": "This is amazing! How did you build the agents?",
                "platform": "YouTube",
                "timestamp": datetime.now().isoformat(),
                "post_id": "p1",
                "replied": False
            },
            {
                "id": "c2",
                "author": "HaterBot",
                "text": "AI is overhyped garbage. Unsubbed.",
                "platform": "Twitter",
                "timestamp": datetime.now().isoformat(),
                "post_id": "p1",
                "replied": False
            }
        ]
        with open(self.comments_db_path, 'w') as f:
            json.dump(mock_data, f, indent=2)

if __name__ == "__main__":
    cm = CommunityManager()
    cm.run()
