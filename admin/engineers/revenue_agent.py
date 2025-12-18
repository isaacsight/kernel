"""
The Revenue Agent - Monetization Strategist

Analyzes Studio OS outputs (content, research, scripts) and 
identifies "saleable assets" to turn into revenue.
"""

import os
import sys
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("RevenueAgent")


class RevenueAgent:
    """
    The Revenue Agent (Monetization Strategist)
    
    Mission: Turn Studio outputs into financial value.
    
    Scans artifacts (posts, scripts, research) and:
    1. Scores their "monetization readiness".
    2. Generates "Productized Offerings" for sale.
    3. Tracks "Revenue Signals" (leads, conversions).
    """
    
    # Offering Templates
    OFFERING_TEMPLATES = {
        "gumroad_digital": {
            "name": "Digital Download",
            "platforms": ["gumroad", "lemon_squeezy"],
            "pricing_model": "one_time",
            "price_range": (9, 49),
        },
        "consulting_package": {
            "name": "Consulting Engagement",
            "platforms": ["calendly", "direct"],
            "pricing_model": "project",
            "price_range": (500, 5000),
        },
        "saas_subscription": {
            "name": "SaaS Subscription",
            "platforms": ["stripe", "paddle"],
            "pricing_model": "recurring",
            "price_range": (19, 99),
        },
        "content_license": {
            "name": "Content License",
            "platforms": ["direct", "gumroad"],
            "pricing_model": "one_time",
            "price_range": (49, 299),
        },
    }
    
    def __init__(self):
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.name = "RevenueAgent"
        logger.info(f"[{self.name}] Initialized.")

    def assess_monetization_readiness(self, artifact_path: str) -> Dict[str, Any]:
        """
        Scores an artifact's potential for generating revenue.
        
        Returns a score from 0-10 and recommended offering type.
        """
        logger.info(f"[{self.name}] Assessing: {artifact_path}")
        
        if not os.path.exists(artifact_path):
            return {"error": "Artifact not found", "path": artifact_path}
        
        with open(artifact_path, 'r') as f:
            content = f.read()
        
        score = 5.0  # Base score
        signals = []
        
        content_lower = content.lower()
        word_count = len(content.split())
        
        # --- Scoring Heuristics ---
        
        # 1. Depth: Longer, more detailed content is more valuable
        if word_count > 1500:
            score += 1.5
            signals.append("Deep, detailed content (+1.5)")
        elif word_count > 800:
            score += 0.5
            signals.append("Good content depth (+0.5)")
        
        # 2. Actionability: "How-to" content is highly monetizable
        actionable_keywords = ["step", "how to", "guide", "template", "checklist", "blueprint"]
        if any(kw in content_lower for kw in actionable_keywords):
            score += 2.0
            signals.append("Actionable/educational (+2.0)")
        
        # 3. Uniqueness: References to proprietary systems add value
        proprietary_keywords = ["studio os", "frontier team", "alchemist", "decision copilot"]
        if any(kw in content_lower for kw in proprietary_keywords):
            score += 1.5
            signals.append("Proprietary system reference (+1.5)")
            
        # 4. Data/Research: Data-driven content commands premium
        data_keywords = ["data", "research", "study", "found that", "analysis"]
        if any(kw in content_lower for kw in data_keywords):
            score += 1.0
            signals.append("Data-driven content (+1.0)")

        # 5. Penalty: Generic content
        generic_keywords = ["hello world", "getting started", "introduction to"]
        if any(kw in content_lower for kw in generic_keywords):
            score -= 2.0
            signals.append("Generic topic (-2.0)")

        score = min(10.0, max(0.0, score))
        
        # Determine recommended offering type
        if score >= 8:
            recommended_offering = "consulting_package"
        elif score >= 6:
            recommended_offering = "gumroad_digital"
        elif score >= 4:
            recommended_offering = "content_license"
        else:
            recommended_offering = None
            
        result = {
            "path": artifact_path,
            "score": round(score, 1),
            "signals": signals,
            "word_count": word_count,
            "recommended_offering": recommended_offering,
            "assessed_at": datetime.now().isoformat()
        }
        
        # Log to memory for future learning
        self.memory.save_insight("monetization_assessment", result, confidence=0.8, source=self.name)
        
        return result

    def generate_offering(self, artifact_path: str, offering_type: str = "auto") -> Dict[str, Any]:
        """
        Generates a "Productized Offering" based on an artifact.
        """
        assessment = self.assess_monetization_readiness(artifact_path)
        
        if "error" in assessment:
            return assessment
        
        if offering_type == "auto":
            offering_type = assessment.get("recommended_offering", "gumroad_digital")
        
        if not offering_type:
            return {"error": "Artifact is not suitable for monetization.", "assessment": assessment}
            
        template = self.OFFERING_TEMPLATES.get(offering_type)
        if not template:
            return {"error": f"Unknown offering type: {offering_type}"}

        # Read artifact to generate copy
        with open(artifact_path, 'r') as f:
            content = f.read()
        
        title = os.path.basename(artifact_path).replace(".md", "").replace("-", " ").title()
        
        # Price is based on score
        min_price, max_price = template["price_range"]
        suggested_price = min_price + int((assessment["score"] / 10) * (max_price - min_price))
        
        offering = {
            "title": f"Premium: {title}",
            "type": template["name"],
            "source_artifact": artifact_path,
            "assessment_score": assessment["score"],
            "suggested_price_usd": suggested_price,
            "pricing_model": template["pricing_model"],
            "platforms": template["platforms"],
            "status": "draft",
            "created_at": datetime.now().isoformat(),
            # Generated sales copy (placeholder - could use LLM)
            "description": f"Unlock the full insights from '{title}'. This {template['name']} gives you access to the proprietary frameworks developed inside the Studio OS."
        }
        
        self.memory.save_insight("offering_generated", offering, confidence=0.9, source=self.name)
        logger.info(f"[{self.name}] Generated offering: {offering['title']} @ ${suggested_price}")
        
        return offering

    def track_revenue_signal(self, source: str, signal_type: str, amount: float = 0.0, metadata: Dict = None) -> Dict:
        """
        Logs a "revenue signal" (e.g., a lead, a sale, a pageview on a product page).
        
        signal_type: "lead", "trial", "sale", "refund", "pageview"
        """
        signal = {
            "source": source,
            "type": signal_type,
            "amount_usd": amount,
            "metadata": metadata or {},
            "timestamp": datetime.now().isoformat()
        }
        
        self.memory.save_insight("revenue_signal", signal, confidence=1.0, source=self.name)
        self.metrics.log_event("revenue", signal)
        logger.info(f"[{self.name}] Tracked signal: {signal_type} from {source} = ${amount}")
        
        return signal

    def get_revenue_summary(self) -> Dict[str, Any]:
        """
        Generates a summary of monetization readiness across the studio.
        """
        # Get all assessments
        assessments = self.memory.get_insights("monetization_assessment")
        offerings = self.memory.get_insights("offering_generated")
        signals = self.memory.get_insights("revenue_signal")
        
        total_potential = sum(a["data"].get("score", 0) for a in assessments) if assessments else 0
        total_revenue = sum(s["data"].get("amount_usd", 0) for s in signals if s["data"].get("type") == "sale") if signals else 0
        
        return {
            "total_assessed_artifacts": len(assessments) if assessments else 0,
            "total_monetization_potential": round(total_potential, 1),
            "average_score": round(total_potential / max(len(assessments), 1), 1) if assessments else 0,
            "total_offerings": len(offerings) if offerings else 0,
            "total_revenue_usd": round(total_revenue, 2),
            "total_signals": len(signals) if signals else 0,
            "generated_at": datetime.now().isoformat()
        }


# Quick access function
def get_revenue_agent() -> RevenueAgent:
    return RevenueAgent()


if __name__ == "__main__":
    agent = RevenueAgent()
    
    # Test with a sample file
    test_path = os.path.join(os.path.dirname(__file__), "../../content/about.md")
    
    print("=== Revenue Agent Test ===\n")
    
    print("1. Assessing Monetization Readiness...")
    assessment = agent.assess_monetization_readiness(test_path)
    print(json.dumps(assessment, indent=2))
    
    print("\n2. Generating Offering...")
    offering = agent.generate_offering(test_path)
    print(json.dumps(offering, indent=2))
    
    print("\n3. Tracking a Mock Sale...")
    signal = agent.track_revenue_signal("gumroad", "sale", 49.00, {"product": "Studio OS Blueprint"})
    print(json.dumps(signal, indent=2))
    
    print("\n4. Revenue Summary...")
    summary = agent.get_revenue_summary()
    print(json.dumps(summary, indent=2))
