"""
The Analyst - Data Scientist Agent

Tracks blog analytics, reader engagement, and identifies best-performing topics.
Leverages the Studio Node for heavy computations.
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from admin.core import supabase
from config import config

logger = logging.getLogger("Analyst")


class Analyst:
    """
    The Analyst (Data Scientist)
    
    Mission: Extract insights from data to drive content strategy.
    
    Responsibilities:
    - Track and analyze blog post performance
    - Identify trending topics and patterns
    - Generate performance reports
    - Predict best content types
    """
    
    def __init__(self):
        self.name = "The Analyst"
        self.role = "Data Scientist"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        self.content_dir = config.CONTENT_DIR
        
    def analyze_content_performance(self) -> Dict:
        """
        Analyzes all content and identifies patterns.
        """
        import frontmatter
        
        logger.info(f"[{self.name}] Analyzing content performance...")
        
        posts = []
        if os.path.exists(self.content_dir):
            for filename in os.listdir(self.content_dir):
                if filename.endswith('.md'):
                    try:
                        filepath = os.path.join(self.content_dir, filename)
                        with open(filepath, 'r') as f:
                            post = frontmatter.load(f)
                        posts.append({
                            'filename': filename,
                            'title': post.get('title', 'Untitled'),
                            'date': str(post.get('date', '')),
                            'category': post.get('category', 'Uncategorized'),
                            'tags': post.get('tags', []),
                            'word_count': len(post.content.split())
                        })
                    except Exception as e:
                        logger.warning(f"Error reading {filename}: {e}")
        
        # Analyze patterns
        categories = {}
        tags_count = {}
        word_counts = []
        
        for post in posts:
            cat = post['category']
            categories[cat] = categories.get(cat, 0) + 1
            
            for tag in post['tags']:
                tags_count[tag] = tags_count.get(tag, 0) + 1
            
            word_counts.append(post['word_count'])
        
        analysis = {
            'total_posts': len(posts),
            'categories': categories,
            'top_tags': sorted(tags_count.items(), key=lambda x: x[1], reverse=True)[:10],
            'avg_word_count': sum(word_counts) / len(word_counts) if word_counts else 0,
            'analyzed_at': datetime.now().isoformat()
        }
        
        # Log the action
        self.metrics.track_agent_action(self.name, 'analyze_content', True, 0)
        
        return analysis
    
    def get_trending_topics(self) -> List[str]:
        """
        Uses the Studio Node to identify trending topics.
        """
        logger.info(f"[{self.name}] Consulting Studio Node for trending topics...")
        
        # Get existing content context
        analysis = self.analyze_content_performance()
        existing_categories = list(analysis['categories'].keys())
        existing_tags = [t[0] for t in analysis['top_tags'][:5]]
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Based on these existing blog categories: {existing_categories}
                And these popular tags: {existing_tags}
                
                Suggest 5 trending topics that would complement this content.
                Return ONLY a JSON array of strings, no explanation.
                Example: ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=30
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                # Parse JSON from response
                if "[" in result and "]" in result:
                    json_str = result[result.find("["):result.rfind("]")+1]
                    topics = json.loads(json_str)
                    self.metrics.track_agent_action(self.name, 'get_trending', True, 0)
                    return topics
                    
            except Exception as e:
                logger.warning(f"[{self.name}] Studio Node request failed: {e}")
        
        # Fallback suggestions
        return [
            "The intersection of AI and human creativity",
            "Digital wellness and mindful technology use",
            "Building authentic connections in a virtual world",
            "The future of work and remote collaboration",
            "Personal growth through self-reflection"
        ]
    
    def get_visitor_stats(self) -> List[Dict]:
        """
        Fetches visitor statistics (page views) from Supabase.
        """
        if not supabase:
            logger.warning("Supabase client not initialized. Cannot fetch visitor stats.")
            return []
            
        try:
            # Query the page_views table
            response = supabase.table('page_views').select('*').order('view_count', desc=True).limit(10).execute()
            return response.data if hasattr(response, 'data') else []
        except Exception as e:
            logger.error(f"Error fetching visitor stats from Supabase: {e}")
            return []
    
    def get_structured_analysis_data(self) -> Dict:
        """
        Returns raw structured data for UI consumption with functional rigor.
        """
        analysis = self.analyze_content_performance()
        gen_stats = self.memory.get_generation_stats()
        feedback = self.memory.get_feedback_patterns()
        
        # Aggregate agent metrics from MetricsCollector
        agent_rankings = self.metrics.get_agent_rankings()
        trends = self.metrics.get_trend_analysis(7)
        
        # Calculate functional rigor metrics
        # 1. Views in last 24h (Stubbed via MetricsCollector if no time-series DB)
        # In a real scenario, we'd query a time-series DB. Here we use systemic pulse.
        total_views = sum(v.get('view_count', 0) for v in self.get_visitor_stats())
        
        # 2. Active nodes in last 7 days (nodes viewed at least once)
        # Using Supabase 'last_viewed_at' if available
        active_nodes = 0
        try:
            seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
            if supabase:
                resp = supabase.table('page_views').select('slug').gt('last_viewed_at', seven_days_ago).execute()
                active_nodes = len(resp.data) if hasattr(resp, 'data') else 0
        except Exception as e:
            logger.warning(f"Error calculating active nodes: {e}")
            
        # 3. Recent Events (Live Stream)
        system_events = self.metrics.metrics.get("system_events", [])
        
        # 4. Inject recent visitor activity into the stream
        try:
            if supabase:
                # Fetch views from the last hour
                an_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
                resp = supabase.table('page_views').select('*').gt('last_viewed_at', an_hour_ago).order('last_viewed_at', desc=True).limit(5).execute()
                
                if hasattr(resp, 'data'):
                    for view in resp.data:
                        # Convert to event format
                        timestamp = view.get('last_viewed_at', datetime.now().isoformat())
                        slug = view.get('slug', 'unknown')
                        system_events.append({
                            "type": "visitor_view",
                            "timestamp": timestamp,
                            "data": {
                                "action": f"Node Viewed: {slug.replace('-', ' ').capitalize()}",
                                "message": f"External agent accessed {slug}",
                                "slug": slug
                            }
                        })
        except Exception as e:
            logger.warning(f"Error injecting visitor views: {e}")

        # Sort combined events by timestamp and take latest
        system_events.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        recent_events = system_events[:20]

        return {
            "content": analysis,
            "generation": gen_stats,
            "feedback": feedback,
            "agents": agent_rankings,
            "trends": trends,
            "research": self.memory.get_insights("research_report", min_confidence=0.8)[:5],
            "visitors": self.get_visitor_stats(),
            "rigor": {
                "views_24h": total_views, # Placeholder for real 24h sum
                "active_nodes_7d": active_nodes or analysis['total_posts'], # Fallback
                "trend_velocity": trends.get("generation_trend_direction", "stable"),
                "events_stream": recent_events
            }
        }

    def generate_insights_report(self) -> str:
        """
        Generates a comprehensive insights report.
        """
        data = self.get_structured_analysis_data()
        analysis = data["content"]
        gen_stats = data["generation"]
        feedback = data["feedback"]
        
        report = [
            "📊 CONTENT INSIGHTS REPORT",
            "=" * 40,
            "",
            f"📝 Total Posts: {analysis['total_posts']}",
            f"📏 Avg Word Count: {analysis['avg_word_count']:.0f}",
            "",
        ]
        
        # Add Visitor Stats
        visitor_stats = data.get('visitors', [])
        if visitor_stats:
            report.extend([
                "👤 TOP VIEWED PAGES",
                "-" * 20
            ])
            for stat in visitor_stats:
                report.append(f"  • {stat['slug']}: {stat['view_count']} views")
            report.append("")
            
        report.append("🏷️ Top Categories:")
        
        for cat, count in sorted(analysis['categories'].items(), key=lambda x: x[1], reverse=True)[:5]:
            report.append(f"  • {cat}: {count} posts")
        
        report.extend([
            "",
            "🔥 Top Tags:"
        ])
        
        for tag, count in analysis['top_tags'][:5]:
            report.append(f"  • {tag}: {count} uses")
        
        if gen_stats.get('total_generations', 0) > 0:
            report.extend([
                "",
                "🤖 AI Generation Stats:",
                f"  • Total Generations: {gen_stats['total_generations']}",
                f"  • Success Rate: {gen_stats['success_rate']}%"
            ])
        
        if feedback.get('total_feedback', 0) > 0:
            report.extend([
                "",
                "⭐ Content Ratings:",
                f"  • Avg Rating: {feedback['average_rating']:.1f}/5",
                f"  • Total Reviews: {feedback['total_feedback']}"
            ])
            
        # Add Research Insights
        insights = self.memory.get_insights("research_report", min_confidence=0.8)
        if insights:
             report.extend([
                "",
                "🧠 Recent Research Insights (The Flywheel):",
             ])
             for insight in insights[:5]:
                 data = insight['data']
                 summary = data.get('summary', '')[:100].replace("\n", " ")
                 report.append(f"  • {data.get('topic')}: {summary}...")
        
        return "\n".join(report)


if __name__ == "__main__":
    analyst = Analyst()
    print(analyst.generate_insights_report())
    print("\nTrending Topics:", analyst.get_trending_topics())
