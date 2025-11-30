"""
This core module provides the main functionality for the admin dashboard application.
It handles tasks such as fetching and saving blog posts, generating AI-written content,
refining content, and publishing updates to the Git repository and Substack.
"""

import os
import datetime
import frontmatter
import subprocess
import google.generativeai as genai
import openai
import anthropic
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Configuration
CONTENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../content'))
REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../'))

# Supabase Setup
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key) if url and key else None

def get_posts():
    """
    Retrieves all blog posts from the content directory.

    Returns:
        list: A list of blog post objects, each containing the post's metadata and content.
    """
    posts = []
    for filename in os.listdir(CONTENT_DIR):
        if filename.endswith('.md'):
            with open(os.path.join(CONTENT_DIR, filename), 'r') as file:
                post = frontmatter.load(file)
                posts.append(post)
    return posts


def save_post(filename, title, date, category, tags, content):
    """
    Saves a blog post to the content directory.
    """
    if not filename:
        # Generate filename from title if not provided
        slug = title.lower().replace(' ', '-')
        filename = f"{slug}.md"
    
    filepath = os.path.join(CONTENT_DIR, filename)
    
    # Parse tags if string
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(',') if t.strip()]
        
    post = frontmatter.Post(content)
    post['title'] = title
    post['date'] = date
    post['category'] = category
    post['tags'] = tags
    
    with open(filepath, 'wb') as f:
        frontmatter.dump(post, f)
        
    return filename

def generate_ai_post(topic, provider="gemini"):
    """
    Generates a blog post using the specified AI provider.
    """
    prompt = f"Write a blog post about {topic}. Include a title, a brief introduction, and 3 main sections. Format in Markdown."
    
    content = ""
    title = f"AI Generated: {topic}"
    
    try:
        if provider == "gemini":
            genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(prompt)
            content = response.text
            
        elif provider == "openai":
            openai.api_key = os.environ.get("OPENAI_API_KEY")
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content
            
        elif provider == "anthropic":
            client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
            message = client.messages.create(
                model="claude-3-opus-20240229",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            content = message.content[0].text
            
    except Exception as e:
        raise Exception(f"AI Generation failed: {str(e)}")

    # Create a new post with the generated content
    filename = f"ai-{topic.lower().replace(' ', '-')}.md"
    save_post(filename, title, datetime.date.today(), "AI", ["ai", "generated"], content)
    return filename

def publish_git():
    """
    Commits and pushes changes to the git repository.
    """
    try:
        subprocess.run(["git", "add", "."], cwd=REPO_DIR, check=True)
        subprocess.run(["git", "commit", "-m", "Content update via Admin TUI"], cwd=REPO_DIR, check=True)
        subprocess.run(["git", "push"], cwd=REPO_DIR, check=True)
        return "Successfully published to Git."
    except subprocess.CalledProcessError as e:
        raise Exception(f"Git publish failed: {str(e)}")

class ServerManager:
    def __init__(self, port=8000, directory="docs"):
        self.port = port
        self.directory = directory
        self.process = None
        self.log_file = os.path.join(os.path.dirname(__file__), "server.log")

    def start_server(self):
        if self.process:
            return "Server is already running."
        
        # Check if port is in use
        try:
            # Simple check using lsof (mac/linux)
            subprocess.check_output(["lsof", "-i", f":{self.port}"])
            return f"Port {self.port} is already in use."
        except subprocess.CalledProcessError:
            pass # Port is free

        cmd = ["python3", "-m", "http.server", str(self.port), "--directory", self.directory]
        
        with open(self.log_file, "w") as f:
            self.process = subprocess.Popen(
                cmd, 
                stdout=f, 
                stderr=subprocess.STDOUT,
                preexec_fn=os.setsid # Create new process group
            )
        return f"Server started on port {self.port}"

    def stop_server(self):
        if not self.process:
            return "Server is not running."
        
        try:
            os.killpg(os.getpgid(self.process.pid), 15) # Terminate process group
            self.process = None
            return "Server stopped."
        except Exception as e:
            return f"Error stopping server: {e}"

    def get_status(self):
        if self.process and self.process.poll() is None:
            return "Running"
        
        # Check if port is in use by another process
        try:
            subprocess.check_output(["lsof", "-i", f":{self.port}"])
            return "Running (External)"
        except subprocess.CalledProcessError:
            return "Stopped"

    def get_logs(self, lines=20):
        if not os.path.exists(self.log_file):
            return ""
        try:
            # Use tail to get last N lines, but with a timeout to prevent hanging
            # and only if file has content
            if os.path.getsize(self.log_file) == 0:
                return ""
                
            return subprocess.check_output(
                ["tail", "-n", str(lines), self.log_file], 
                timeout=0.5
            ).decode("utf-8")
        except:
            return ""


