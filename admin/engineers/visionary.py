import logging
import os
import sys
from PIL import Image, ImageDraw, ImageFont

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import config
import google.generativeai as genai
from admin.brain.metrics_collector import get_metrics_collector
from admin.brain.memory_store import get_memory_store
from admin.engineers.web_scout import get_web_scout

logger = logging.getLogger("Visionary")

class Visionary:
    """
    The Visionary (Computer Vision Engineer)
    
    Mission: Ensure visual excellence and handle multimodal content.
    
    Responsibilities:
    - Visual Regression Testing
    - Image Generation (Open Graph)
    - Design System Analysis
    - Data-Driven Mission Proposal
    """
    def __init__(self):
        self.name = "The Visionary"
        self.role = "Computer Vision Engineer"
        self.static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../static'))
        self.og_dir = os.path.join(self.static_dir, 'images', 'og')
        os.makedirs(self.og_dir, exist_ok=True)
        
        self.metrics = get_metrics_collector()
        self.memory_store = get_memory_store()
        self.web_scout = get_web_scout()
        
        # Configure Gemini if available
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)

    def generate_og_image(self, title, slug):
        """
        Generates a branded Open Graph image for the post.
        """
        output_path = os.path.join(self.og_dir, f"{slug}.jpg")
        
        # Skip if exists (for now)
        if os.path.exists(output_path):
            return f"static/images/og/{slug}.jpg"

        logger.info(f"Generating OG image for: {title}")
        
        # Create base image (1200x630 is standard for OG)
        width, height = 1200, 630
        # Use a nice dark background color from the theme
        bg_color = (20, 20, 20) # #141414
        image = Image.new('RGB', (width, height), bg_color)
        draw = ImageDraw.Draw(image)
        
        # Draw some "Studio" accents
        # A subtle border
        draw.rectangle([20, 20, width-20, height-20], outline=(50, 50, 50), width=2)
        
        # Add Title
        # Try to load a font, fallback to default
        try:
            # Try to find a system font or use a default
            font = ImageFont.truetype("Arial.ttf", 60)
        except:
            font = ImageFont.load_default()
            
        # Wrap text
        lines = []
        words = title.split()
        current_line = []
        for word in words:
            current_line.append(word)
            # Simple length check (approximate)
            if len(" ".join(current_line)) > 25: 
                lines.append(" ".join(current_line[:-1]))
                current_line = [word]
        lines.append(" ".join(current_line))
        
        # Draw text centered
        y = 200
        for line in lines:
            # Calculate text width (approximate for default font)
            # For TrueType we would use font.getlength(line)
            # Let's just left align with padding for safety
            draw.text((100, y), line, font=font, fill=(255, 255, 255))
            y += 80
            
        # Add Brand
        draw.text((100, height - 100), "DOES THIS FEEL RIGHT?", font=font, fill=(150, 150, 150))

        # Save
        image.save(output_path, quality=90)
        return f"static/images/og/{slug}.jpg"

    def audit_visuals(self, html_content):
        """
        Checks for broken images or missing alt text.
        """
        issues = []
        if "<img" in html_content and "alt=" not in html_content:
             issues.append("Found images without alt text.")
        return issues

    def dream(self):
        """
        Analyzes the system using real metrics and proposes a data-driven 'Mission' for evolution.
        
        This is the core of the self-improvement loop - the Visionary looks at actual
        performance data to decide what the system should work on next.
        """
        logger.info("Dreaming of a better future... (analyzing metrics)")
        
        # Get improvement opportunities from metrics
        opportunities = self.metrics.get_improvement_opportunities()
        
        # Get trend analysis
        trends = self.metrics.get_trend_analysis(7)
        
        # Get agent performance
        agent_rankings = self.metrics.get_agent_rankings()
        
        # Get feedback patterns from memory
        feedback = self.memory_store.get_feedback_patterns()
        
        # Build context for decision making
        context = {
            "opportunities": opportunities,
            "trends": trends,
            "agents": agent_rankings,
            "feedback": feedback
        }
        
        # Prioritized mission selection based on data
        if opportunities:
            # Pick highest priority opportunity
            high_priority = [o for o in opportunities if o.get("priority") == "high"]
            if high_priority:
                opp = high_priority[0]
                mission = f"[DATA-DRIVEN] {opp['area']}: {opp['suggestion']}"
                logger.info(f"Proposed Mission (HIGH PRIORITY): {mission}")
                return mission
            
            # Medium priority 
            medium = [o for o in opportunities if o.get("priority") == "medium"]
            if medium:
                opp = medium[0]
                mission = f"[DATA-DRIVEN] {opp['area']}: {opp['suggestion']}"
                logger.info(f"Proposed Mission (MEDIUM PRIORITY): {mission}")
                return mission
        
        # If no clear opportunities, check feedback
        if feedback.get("average_rating", 5) < 3.5 and feedback.get("total_feedback", 0) >= 5:
            mission = "[DATA-DRIVEN] Content Quality: Review feedback patterns and improve generation prompts"
            logger.info(f"Proposed Mission (FEEDBACK-DRIVEN): {mission}")
            return mission
        
        # Check agent performance
        if agent_rankings:
            weakest = min(agent_rankings, key=lambda x: x.get("success_rate", 100))
            if weakest.get("success_rate", 100) < 70 and weakest.get("total_actions", 0) >= 5:
                mission = f"[DATA-DRIVEN] Agent Improvement: Optimize {weakest['agent']} (success rate: {weakest['success_rate']}%)"
                logger.info(f"Proposed Mission (AGENT-FOCUSED): {mission}")
                return mission
        
        # Fallback to exploration missions when system is healthy
        import random
        exploration_missions = [
            "Explore new content topics based on trending themes in existing posts.",
            "Experiment with different writing styles to see what resonates best.",
            "Add visual content generation capabilities to enhance blog posts.",
            "Create a content calendar system for better planning.",
            "Build an analytics dashboard for real-time performance monitoring."
        ]
        
        mission = f"[EXPLORATION] {random.choice(exploration_missions)}"
        logger.info(f"Proposed Mission (EXPLORATION): {mission}")
        return mission
    
    def get_system_health_report(self):
        """
        Generates a comprehensive system health report for The Operator.
        """
        report = self.metrics.generate_daily_report()
        opportunities = self.metrics.get_improvement_opportunities()
        
        return {
            "daily_report": report,
            "opportunities": opportunities,
            "agent_rankings": self.metrics.get_agent_rankings(),
            "memory_summary": self.memory_store.get_memory_summary()
        }
    
    def get_insight_summary(self):
        """
        Summarize what the system has learned over time.
        """
        insights = self.memory_store.get_insights(min_confidence=0.5)
        
        preferences = [i for i in insights if i["type"] == "generation_preference"]
        avoidances = [i for i in insights if i["type"] == "generation_avoidance"]
        
        return {
            "total_insights": len(insights),
            "preferences_learned": len(preferences),
            "things_to_avoid": len(avoidances),
            "recent_insights": insights[:5]
        }

    def critique_design(self, css_content: str, html_snippet: str = "") -> str:
        """
        Analyzes CSS and HTML to provide design critiques.
        """
        logger.info("Critiquing design...")
        
        # In a real scenario, we would send this to a Vision LLM or a code-aware LLM
        # For now, we will use the text generation endpoint
        
        node_url = os.environ.get("STUDIO_NODE_URL")
        
        prompt = f"""
        You are The Visionary, a world-class UI/UX Designer.
        Critique the following CSS and HTML snippet.
        
        Focus on:
        1. Visual Hierarchy
        2. Color Harmony
        3. Spacing and Layout
        4. Modern Aesthetics (Glassmorphism, Gradients, etc.)
        
        CSS:
        {css_content[:1000]}...
        
        HTML Context:
        {html_snippet[:500]}...
        
        Provide specific, actionable feedback in bullet points.
        """

        # method 1: specific node url
        if node_url:
            import requests
            try:
                response = requests.post(
                    f"{node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=60
                )
                response.raise_for_status()
                return response.json().get("response", "No critique generated.")
            except Exception as e:
                logger.error(f"Design critique failed (Remote): {e}")

        # method 2: Gemini
        if hasattr(self, 'model'):
             try:
                response = self.model.generate_content(prompt)
                return response.text
             except Exception as e:
                logger.error(f"Design critique failed (Gemini): {e}")
                return f"Error during critique: {e}"

        return "Cannot critique: No AI provider configured."

    def generate_css(self, requirements: str, current_css: str = "") -> str:
        """
        Generates CSS based on natural language requirements.
        """
        logger.info(f"Generating CSS for: {requirements}")
        
        node_url = os.environ.get("STUDIO_NODE_URL")
            
        prompt = f"""
        You are The Visionary, a world-class UI/UX Designer.
        Write CSS to satisfy the following requirements:
        "{requirements}"
        
        Existing CSS Context (to maintain consistency):
        {current_css[:500]}...
        
        Return ONLY valid CSS code. No markdown, no explanations.
        """

        css = ""
        # method 1: specific node url
        if node_url: 
            import requests
            try:
                response = requests.post(
                    f"{node_url}/generate",
                    json={"prompt": prompt, "model": "codellama"}, # Use a code model if available
                    timeout=60
                )
                response.raise_for_status()
                css = response.json().get("response", "")
            except Exception as e:
                logger.error(f"CSS generation failed (Remote): {e}")
        
        # method 2: Gemini
        elif hasattr(self, 'model') and not css:
             try:
                response = self.model.generate_content(prompt)
                css = response.text
             except Exception as e:
                logger.error(f"CSS generation failed (Gemini): {e}")
                return f"/* Error generating CSS: {e} */"
        
        else:
             return "/* Cannot generate: No AI provider configured. */"

        # Clean up markdown
        if "```css" in css:
            css = css.split("```css")[1].split("```")[0]
        elif "```" in css:
            css = css.split("```")[1].split("```")[0]
            
        return css.strip()

    def research_design_trends(self, topic: str = "web design trends 2025") -> dict:
        """
        Actively researches current design trends using Web Scout.
        """
        logger.info(f"[{self.name}] Scouting design trends for: {topic}")
        
        # 1. Broad Search
        trends = self.web_scout.search(topic, num_results=5)
        
        # 2. Specific Logic (Color, Typography, Layout)
        color_trends = self.web_scout.search(f"{topic} color palettes", num_results=3)
        type_trends = self.web_scout.search(f"{topic} typography", num_results=3)
        
        # 3. Compile Report
        report = {
            "topic": topic,
            "timestamp": "Now",
            "general_trends": [t['snippet'] for t in trends],
            "color_trends": [t['snippet'] for t in color_trends],
            "typography_trends": [t['snippet'] for t in type_trends],
            "sources": [t['url'] for t in trends]
        }
        
        return report