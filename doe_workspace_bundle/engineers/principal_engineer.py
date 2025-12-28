import logging

class PrincipalEngineer:
    def __init__(self):
        self.name = "Principal Software Engineer"
        self.role = "Distributed Systems"
        self.emoji = "🌐"
        self.domain_knowledge = {
            "focus": "Artificial Intelligence & Machine Learning",
            "why_smart": "AI is becoming the 'electricity' of every industry. It touches everything.",
            "core_skills": [
                "Neural networks",
                "LLMs & generative models",
                "Computer vision",
                "MLOps",
                "Data engineering"
            ],
            "career_paths": [
                "$300k–$1M+ roles (principal engineer, staff AI, AI architect)",
                "Founding AI-powered companies",
                "Being relevant for 30+ years"
            ],
            "philosophy": "The electricity of the new world."
        }
        
    def optimize_cache(self):
        return {"cache_hit_rate": "99.9%"}

    def consult(self):
        """Returns expert advice based on domain knowledge."""
        return {
            "advice": f"Master the new electricity. Key skills: {', '.join(self.domain_knowledge['core_skills'])}.",
            "outlook": "Highest leverage role for the next 30 years."
        }

    def audit_system(self, root_dir):
        """Checks the build system configuration."""
        import os
        issues = []
        score = 10
        
        build_py = os.path.join(root_dir, "build.py")
        if not os.path.exists(build_py):
            issues.append("❌ build.py missing.")
            return {"score": 0, "issues": issues}
            
        with open(build_py, 'r') as f:
            content = f.read()
            
        if "shutil.rmtree" in content:
            issues.append("ℹ️ Full rebuild detected (rmtree used). Consider incremental builds for speed.")
            score -= 1
            
        # Check output directory
        docs_dir = os.path.join(root_dir, "docs")
        if os.path.exists(docs_dir):
            size = sum(os.path.getsize(os.path.join(dirpath, filename)) for dirpath, _, filenames in os.walk(docs_dir) for filename in filenames)
            issues.append(f"✅ Build output size: {size/1024/1024:.2f} MB")
        
        return {
            "agent": self.name,
            "emoji": self.emoji,
            "score": score,
            "issues": issues,
            "status": "System Audit Complete"
        }

    def report_status(self):
        return f"{self.emoji} {self.name}: System stable."