import logging

class ProductEngineer:
    def __init__(self):
        self.name = "AI Product Engineer"
        self.role = "Application Layer"
        self.emoji = "📱"
        self.domain_knowledge = {
            "focus": "Computer Science (The Most Versatile Degree on Earth)",
            "why_smart": "Often considered the 'King of Degrees'. Every industry needs software.",
            "core_skills": [
                "Foundation for AI",
                "Robotics",
                "Quantum software",
                "Cybersecurity",
                "Fintech", 
                "Apps"
            ],
            "career_paths": [
                "Pivot into anything",
                "Software Engineering",
                "Founding companies"
            ],
            "philosophy": "Even if you pivot later, CS never loses value."
        }
        
    def build_feature(self, spec):
        return {"status": "shipped", "user_delight": "high"}

    def consult(self):
        """Returns expert advice based on domain knowledge."""
        return {
            "advice": f"The ultimate pivot degree. It unlocks: {', '.join(self.domain_knowledge['core_skills'])}.",
            "outlook": "Maximum optionality and safety."
        }

    def audit_ux(self, templates_dir):
        """Checks for basic UX/SEO elements in templates."""
        import os
        issues = []
        score = 10
        
        try:
            base_html = os.path.join(templates_dir, "base.html")
            if os.path.exists(base_html):
                with open(base_html, 'r') as f:
                    content = f.read().lower()
                    
                if "<meta name=\"viewport\"" not in content:
                    issues.append("❌ Missing mobile viewport tag.")
                    score -= 2
                if "<meta name=\"description\"" not in content:
                    issues.append("⚠️ Missing meta description.")
                    score -= 1
                if "og:image" not in content:
                    issues.append("⚠️ Missing Open Graph image.")
                    score -= 1
            else:
                issues.append("❌ base.html not found.")
                score = 0
                
            return {
                "agent": self.name,
                "emoji": self.emoji,
                "score": score,
                "issues": issues,
                "status": "UX Audit Complete"
            }
        except Exception as e:
            return {"error": str(e)}

    def report_status(self):
        return f"{self.emoji} {self.name}: Product market fit check."