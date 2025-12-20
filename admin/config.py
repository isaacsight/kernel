import os
from dotenv import load_dotenv

load_dotenv(override=True)

class Config:
    # Paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CONTENT_DIR = os.path.join(BASE_DIR, 'content')
    DOCS_DIR = os.path.join(BASE_DIR, 'docs')
    BRAIN_DIR = os.path.join(os.path.dirname(__file__), 'brain')
    SKILLS_DIR = os.path.join(os.path.dirname(__file__), 'skills')
    
    # Site
    SITE_URL = "https://isaacsight.com"
    
    # AI Models
    GEMINI_MODEL = "gemini-flash-latest" # STABLE: Paid Tier Compatible
    EMBEDDING_MODEL = "models/text-embedding-004"
    HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.2"
    SAFETY_MODEL = "unitary/toxic-bert"
    
    # API Keys
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
    HF_TOKEN = os.environ.get("HF_TOKEN")
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    
    # Twitter Config
    TWITTER_CONSUMER_KEY = os.environ.get("TWITTER_CONSUMER_KEY")
    TWITTER_CONSUMER_SECRET = os.environ.get("TWITTER_CONSUMER_SECRET")
    TWITTER_BEARER_TOKEN = os.environ.get("TWITTER_BEARER_TOKEN")
    TWITTER_ACCESS_TOKEN = os.environ.get("TWITTER_ACCESS_TOKEN")
    TWITTER_ACCESS_TOKEN = os.environ.get("TWITTER_ACCESS_TOKEN")
    TWITTER_ACCESS_TOKEN_SECRET = os.environ.get("TWITTER_ACCESS_TOKEN_SECRET")
    
    # TikTok Config
    TIKTOK_CLIENT_KEY = os.environ.get("TIKTOK_CLIENT_KEY")
    TIKTOK_CLIENT_SECRET = os.environ.get("TIKTOK_CLIENT_SECRET")

    
    # Remote Node
    STUDIO_NODE_URL = os.environ.get("STUDIO_NODE_URL") or "http://100.98.193.42:52415"
    
    # Settings
    MAX_RETRIES = 3
    TIMEOUT_REMOTE = 120
    TIMEOUT_EMBEDDING = 10

    # Notion
    NOTION_API_KEY = os.environ.get("NOTION_API_KEY")
    NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID")

    # Latency Optimization (Variables for Tuning)
    CHAT_HISTORY_LIMIT = 20 # 10 turns
    USE_STREAMING = True
    MINIMIZE_COLD_STARTS = True
    TRIM_PROMPT_CONTEXT = True

    # Lab Experiment Variables (Tunable via Lab Scientists)
    CONTROL_PRECISION = float(os.environ.get("CONTROL_PRECISION", 0.9)) # 0.0 to 1.0
    AGENT_CREATIVITY = float(os.environ.get("AGENT_CREATIVITY", 0.7)) # 0.0 to 1.0
    THINKING_DEPTH = int(os.environ.get("THINKING_DEPTH", 3)) # Number of re-evaluation loops
    ALLOW_OS_COMMANDS = os.environ.get("ALLOW_OS_COMMANDS", "true").lower() == "true"

config = Config()
