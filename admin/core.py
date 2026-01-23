"""
This core module provides the main functionality for the admin dashboard application.
It handles tasks such as fetching and saving blog posts, generating AI-written content,
refining content, and publishing updates to the Git repository.
"""

import os
import datetime
import frontmatter
import subprocess
import google.generativeai as genai
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

from admin.config import config
from admin.decorators import critique_action

# Configuration
CONTENT_DIR = config.CONTENT_DIR
REPO_DIR = config.BASE_DIR

import logging

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "admin.log")),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("AdminCore")

# Supabase Setup
url: str = config.SUPABASE_URL
key: str = config.SUPABASE_KEY
supabase: Client = create_client(url, key) if url and key else None


def get_posts():
    """
    Retrieves all blog posts from the content directory.

    Returns:
        list: A list of blog post objects, each containing the post's metadata and content.
    """
    posts = []
    for filename in os.listdir(CONTENT_DIR):
        if filename.endswith(".md"):
            try:
                with open(os.path.join(CONTENT_DIR, filename), "r") as file:
                    post = frontmatter.load(file)
                    # Inject slug for Librarian
                    post["slug"] = filename.replace(".md", "")
                    posts.append(post)
            except Exception as e:
                logger.warning(f"Warning: Failed to load post {filename}: {e}")
                continue
    return posts


def get_latest_post_date():
    """
    Returns the date of the most recent blog post.
    """
    posts = get_posts()
    if not posts:
        return None

    dates = []
    for post in posts:
        date = post.get("date")
        if isinstance(date, datetime.date):
            dates.append(date)
        elif isinstance(date, datetime.datetime):
            dates.append(date.date())
        elif isinstance(date, str):
            try:
                dates.append(datetime.datetime.strptime(date, "%Y-%m-%d").date())
            except ValueError:
                pass

    if not dates:
        return None

    return max(dates)


def auto_generate_idea():
    """
    Generates a blog post idea based on existing content gaps or trends.
    """
    # Simple logic for now: rotate through categories
    categories = ["Engineering", "Philosophy", "Culture", "Business"]
    import random

    topic = f"The future of {random.choice(categories)} in {datetime.date.today().year}"
    return topic


def save_post(filename, title, date, category, tags, content, excerpt=None):
    """
    Saves a blog post to the content directory.
    """
    if not filename:
        # Generate filename from title if not provided
        slug = title.lower().replace(" ", "-")
        filename = f"{slug}.md"

    filepath = os.path.join(CONTENT_DIR, filename)

    # Parse tags if string
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]

    post = frontmatter.Post(content)
    post["title"] = title
    post["date"] = date
    post["category"] = category
    post["tags"] = tags
    if excerpt:
        post["excerpt"] = excerpt

    with open(filepath, "wb") as f:
        frontmatter.dump(post, f)

    return filename


def get_doctrine():
    """
    Reads the Gentle Doctrine from the admin directory.
    """
    doctrine_path = os.path.join(os.path.dirname(__file__), "doctrine.md")
    try:
        with open(doctrine_path, "r") as f:
            return f.read()
    except FileNotFoundError:
        return "Philosophy: Be honest, clear, and kind."


class OllamaManager:
    def __init__(self):
        self.process = None
        self.log_file = os.path.join(os.path.dirname(__file__), "ollama.log")

    def is_installed(self):
        """Checks if ollama is installed and returns the path."""
        # Check common paths
        paths = ["ollama", "/usr/local/bin/ollama", "/opt/homebrew/bin/ollama"]
        for path in paths:
            try:
                subprocess.check_output([path, "--version"], stderr=subprocess.STDOUT)
                return path
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue
        return None

    def is_running(self):
        """Checks if Ollama is already running on port 11434."""
        try:
            # Check if port 11434 is in use
            subprocess.check_output(["lsof", "-i", ":11434"])
            return True
        except subprocess.CalledProcessError:
            return False

    def start(self):
        """Starts the Ollama server if not running."""
        if self.is_running():
            return "Ollama is already running."

        ollama_path = self.is_installed()
        if not ollama_path:
            return "Ollama is not installed. Please install it from https://ollama.com/"

        print(f"Starting Ollama server using {ollama_path}...")
        with open(self.log_file, "w") as f:
            self.process = subprocess.Popen(
                [ollama_path, "serve"], stdout=f, stderr=subprocess.STDOUT, preexec_fn=os.setsid
            )

        # Wait a bit for it to start
        import time

        for _ in range(10):
            if self.is_running():
                return "Ollama started successfully."
            time.sleep(1)

        return "Failed to start Ollama (timeout)."

    def stop(self):
        """Stops the Ollama server if we started it."""
        if self.process:
            try:
                os.killpg(os.getpgid(self.process.pid), 15)
                self.process = None
                return "Ollama stopped."
            except Exception as e:
                return f"Error stopping Ollama: {e}"
        return "Ollama was not started by this manager (or is already stopped)."


@critique_action("Generate Blog Post")
async def generate_ai_post(topic, provider="auto"):
    """
    Generates a blog post using The Alchemist (Context-Aware AI) with a self-correcting loop.
    """
    try:
        from .engineers.alchemist import Alchemist
        from .engineers.guardian import Guardian
        from .engineers.editor import Editor
        from .engineers.librarian import Librarian
        from .engineers.fact_checker import FactChecker
        from .engineers.director import get_director

        alchemist = Alchemist()
        guardian = Guardian()
        editor = Editor()
        fact_checker = FactChecker()
        director = get_director()

        # Ensure memory is built
        if not os.path.exists(alchemist.memory_file):
            alchemist.build_memory()

        doctrine = get_doctrine()

        # Generation Loop with Retries
        max_retries = 3
        current_try = 0
        content = ""
        feedback = ""

        while current_try < max_retries:
            logger.info(
                f"[The Alchemist] Generating draft (Attempt {current_try + 1}/{max_retries})..."
            )
            if feedback:
                logger.info(f"[The Alchemist] Incorporating feedback: {feedback}")
                # Append feedback to topic/prompt effectively
                adjusted_topic = f"{topic}. IMPORTANT FEEDBACK FROM PREVIOUS DRAFT: {feedback}"
                content, context = await alchemist.generate(
                    adjusted_topic, doctrine, provider=provider
                )
            else:
                content, context = await alchemist.generate(topic, doctrine, provider=provider)

            # 1.5. Director: Alignment Check (Sovereign Oversight)
            logger.info("[The Director] Checking alignment with Doctrine...")
            alignment = director.check_alignment(content, context)
            if alignment.get("veto", False):
                logger.warning(f"[The Director] VETO Issued: {alignment.get('reason')}")
                feedback = f"THE DIRECTOR VETOED THIS DRAFT. Reason: {alignment.get('reason')}. Directive: {alignment.get('directive')}"
                current_try += 1
                continue

            # 2. FactChecker: Truth Verification
            logger.info("[The FactChecker] Verifying accuracy...")
            fact_check = fact_checker.verify(content, context)
            if not fact_check["is_valid"]:
                logger.warning(f"[The FactChecker] Issues found: {fact_check['feedback']}")
                feedback = f"The previous draft contained factual inaccuracies: {fact_check['feedback']}. Please correct these."
                current_try += 1
                continue

            # 3. Guardian: Audit (Safety)
            logger.info("[The Guardian] Auditing content...")
            safety_issues = guardian.audit_content(content)
            critical_issues = [i for i in safety_issues if i["level"] == "CRITICAL"]

            if critical_issues:
                logger.warning(f"[The Guardian] Blocked content: {critical_issues}")
                feedback = f"The previous draft violated safety rules: {critical_issues}. Please rewrite to be safe and aligned."
                current_try += 1
                continue

            # 4. Editor: Audit (Style)
            logger.info("[The Editor] Auditing style...")
            style_issues = await editor.audit(content)

            # If there are significant style issues, we could also retry, or just log them.
            # For now, let's retry if there are MANY issues, or just accept it.
            # Let's try to auto-refine if there are issues.
            if style_issues and current_try < max_retries - 1:
                # Check if we should refine based on style
                # For now, let's just print them. Implementing full style-loop might be too expensive/slow for now.
                logger.info(f"[The Editor] Style suggestions: {style_issues}")
                # Optional: feedback += f" Style feedback: {style_issues}"
                # current_try += 1
                # continue

            # If we pass Guardian, we accept the draft (even if imperfect style)
            break

        if current_try == max_retries:
            raise Exception("Failed to generate safe content after multiple attempts.")

        # 4. Save Post
        title = topic

        # Extract Excerpt (First substantial paragraph)
        # 1. Skip headers
        # 2. Skip lines that are just punctuation/symbols (like *** or ---)
        # 3. Prefer bold text if it appears early
        excerpt = ""
        lines = content.split("\n")

        import re

        for line in lines:
            clean_line = line.strip()
            # Skip empty or headers
            if not clean_line or clean_line.startswith("#"):
                continue

            # Skip separator lines (e.g. * * * or - - -)
            # Check if line has at least some alphanumeric characters
            if not re.search(r"[a-zA-Z0-9]", clean_line):
                continue

            # If we're here, it's a candidate.
            # Clean up markdown bold/italic for the plain text excerpt
            candidate = (
                clean_line.replace("**", "").replace("*", "").replace("__", "").replace("_", "")
            )

            if len(candidate) > 10:  # Avoid very short fragments
                excerpt = candidate
                if len(excerpt) > 200:
                    excerpt = excerpt[:197] + "..."
                break

        filename = f"ai-{topic.lower().replace(' ', '-')}.md"
        saved_filename = save_post(
            filename,
            title,
            datetime.date.today(),
            "Engineering",
            ["ai", "alchemist"],
            content,
            excerpt,
        )

        # 5. Librarian: Update Graph
        logger.info("[The Librarian] Updating Knowledge Graph...")
        librarian = Librarian()
        posts = get_posts()  # Reload to include new post
        librarian.build_graph(posts)
        graph_path = os.path.join(os.path.dirname(__file__), "../docs/static/graph.json")
        librarian.export_graph(graph_path)

        return saved_filename

    except Exception as e:
        raise Exception(f"Alchemist Generation failed: {str(e)}")


@critique_action("Publish to Git")
def publish_git():
    """
    Commits and pushes changes to the git repository.
    """
    try:
        # Check current status
        status_before = subprocess.run(
            ["git", "status", "--porcelain"], cwd=REPO_DIR, capture_output=True, text=True
        )

        subprocess.run(["git", "add", "."], cwd=REPO_DIR, check=True)

        # Check if there are changes to commit after add
        status_after = subprocess.run(
            ["git", "status", "--porcelain"], cwd=REPO_DIR, capture_output=True, text=True
        )

        if not status_after.stdout.strip():
            return "No changes detected. Site is already up to date."

        subprocess.run(
            ["git", "commit", "-m", "Content update via Admin TUI"], cwd=REPO_DIR, check=True
        )
        subprocess.run(["git", "push"], cwd=REPO_DIR, check=True)

        # Auto-broadcast to TikTok
        try:
            from .engineers.broadcaster import Broadcaster

            broadcaster = Broadcaster()
            latest_date = get_latest_post_date()
            if latest_date:
                # Find the post with this date
                posts = get_posts()
                latest_post = next(
                    (
                        p
                        for p in posts
                        if p.get("date") == latest_date or p.get("date") == str(latest_date)
                    ),
                    None,
                )

                if latest_post:
                    logger.info(f"Broadcasting post '{latest_post.get('title')}' to TikTok...")
                    # generate_video might be slow or fail, keep it safe
                    video_path = broadcaster.generate_video(latest_post)
                    if video_path:
                        broadcaster.upload_to_tiktok(
                            video_path, description=f"New post: {latest_post.get('title')} #blog"
                        )
        except Exception as e:
            logger.error(f"Broadcasting failed: {e}")
            # Don't fail the publish if broadcasting fails
            pass

        return "Successfully published to Git."
    except subprocess.CalledProcessError as e:
        logger.error(f"Git execution failed: {e.stderr if hasattr(e, 'stderr') else str(e)}")
        raise Exception(f"Git publish failed: {str(e)}")


@critique_action("Build Site")
def build_site():
    """
    Executes the build.py script to generate the static site.
    """
    try:
        # build.py is in the REPO_DIR
        result = subprocess.run(
            ["python3", "build.py"], cwd=REPO_DIR, capture_output=True, text=True, check=True
        )
        logger.info("[The Architect] Build completed successfully.")
        return result.stdout
    except subprocess.CalledProcessError as e:
        logger.error(f"[The Architect] Build failed: {e.stderr}")
        raise Exception(f"Site build failed: {e.stderr}")


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
            pass  # Port is free

        cmd = ["python3", "-m", "http.server", str(self.port), "--directory", self.directory]

        with open(self.log_file, "w") as f:
            self.process = subprocess.Popen(
                cmd,
                stdout=f,
                stderr=subprocess.STDOUT,
                preexec_fn=os.setsid,  # Create new process group
            )
        return f"Server started on port {self.port}"

    def stop_server(self):
        if not self.process:
            return "Server is not running."

        try:
            os.killpg(os.getpgid(self.process.pid), 15)  # Terminate process group
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
                ["tail", "-n", str(lines), self.log_file], timeout=0.5
            ).decode("utf-8")
        except:
            return ""
