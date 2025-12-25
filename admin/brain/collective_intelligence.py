"""
Collective Intelligence - Shared Brain for the AI Team

This system enables agents to:
- Share knowledge and insights across the team
- Learn from each other's experiences
- Make coordinated decisions
- Build collective memory
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("CollectiveIntelligence")


class CollectiveIntelligence:
    """
    The shared brain that makes the team smarter together.
    
    Capabilities:
    - Cross-agent knowledge sharing
    - Collective decision making
    - Team-wide learning from experiences
    - Coordinated action planning
    """
    
    def __init__(self):
        self.name = "Collective Intelligence"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        self.knowledge_file = os.path.join(
            os.path.dirname(__file__), 'collective_knowledge.json'
        )
        self.knowledge = self._load_knowledge()
        
    def _load_knowledge(self) -> Dict:
        """Load collective knowledge base."""
        if os.path.exists(self.knowledge_file):
            try:
                with open(self.knowledge_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {
            "shared_insights": [],
            "agent_expertise": {},
            "lessons_learned": [],
            "team_decisions": [],
            "active_goals": []
        }
    
    def _save_knowledge(self):
        """Persist knowledge to disk."""
        with open(self.knowledge_file, 'w') as f:
            json.dump(self.knowledge, f, indent=2)
            
    # ==================== Synchronization ====================
    
    def merge_knowledge(self, external_knowledge: Dict) -> Dict:
        """
        Merge knowledge from an external source (e.g., another node).
        Returns a summary of what was added.
        """
        added = {
            "insights": 0,
            "lessons": 0,
            "decisions": 0
        }
        
        # Merge insights
        existing_insights = set(
            (i["from_agent"], i["type"], str(i["insight"])) 
            for i in self.knowledge["shared_insights"]
        )
        
        for insight in external_knowledge.get("shared_insights", []):
            key = (insight["from_agent"], insight["type"], str(insight["insight"]))
            if key not in existing_insights:
                self.knowledge["shared_insights"].append(insight)
                added["insights"] += 1
        
        # Merge lessons
        existing_lessons = set(
            (l["from_agent"], l["lesson"], l["context"]) 
            for l in self.knowledge["lessons_learned"]
        )
        
        for lesson in external_knowledge.get("lessons_learned", []):
            key = (lesson["from_agent"], lesson["lesson"], lesson["context"])
            if key not in existing_lessons:
                self.knowledge["lessons_learned"].append(lesson)
                added["lessons"] += 1
                
        # Merge decisions (simple append for now, could be smarter)
        existing_decision_ids = set(d["id"] for d in self.knowledge["team_decisions"])
        
        for decision in external_knowledge.get("team_decisions", []):
            if decision["id"] not in existing_decision_ids:
                self.knowledge["team_decisions"].append(decision)
                added["decisions"] += 1
            else:
                # Merge votes if decision exists
                local_decision = next(d for d in self.knowledge["team_decisions"] if d["id"] == decision["id"])
                for voter, vote_data in decision.get("votes", {}).items():
                    if voter not in local_decision["votes"]:
                        local_decision["votes"][voter] = vote_data
        
        if any(added.values()):
            self._save_knowledge()
            logger.info(f"[Collective] Merged knowledge: {added}")
            
        return added

    def get_knowledge_since(self, timestamp: str) -> Dict:
        """
        Get all knowledge created/updated since the given timestamp.
        """
        updates = {
            "shared_insights": [],
            "lessons_learned": [],
            "team_decisions": []
        }
        
        # Filter insights
        for insight in self.knowledge["shared_insights"]:
            if insight.get("shared_at", "") > timestamp:
                updates["shared_insights"].append(insight)
                
        # Filter lessons
        for lesson in self.knowledge["lessons_learned"]:
            if lesson.get("learned_at", "") > timestamp:
                updates["lessons_learned"].append(lesson)
                
        # Filter decisions (include if proposed OR voted recently)
        for decision in self.knowledge["team_decisions"]:
            is_new = decision.get("proposed_at", "") > timestamp
            has_new_votes = any(
                v.get("voted_at", "") > timestamp 
                for v in decision.get("votes", {}).values()
            )
            
            if is_new or has_new_votes:
                updates["team_decisions"].append(decision)
                
        return updates
    
    # ==================== Knowledge Sharing ====================
    
    def share_insight(self, agent_name: str, insight_type: str, 
                      insight: Dict, confidence: float = 0.7):
        """
        An agent shares an insight with the collective.
        """
        entry = {
            "from_agent": agent_name,
            "type": insight_type,
            "insight": insight,
            "confidence": confidence,
            "shared_at": datetime.now().isoformat()
        }
        
        self.knowledge["shared_insights"].append(entry)
        
        # Also save to persistent memory
        self.memory.save_insight(
            f"collective_{insight_type}",
            {"agent": agent_name, **insight},
            confidence,
            source="collective_intelligence"
        )
        
        self._save_knowledge()
        logger.info(f"[Collective] {agent_name} shared: {insight_type}")
        
    def get_insights(self, insight_type: str = None, 
                     min_confidence: float = 0.5) -> List[Dict]:
        """
        Retrieve shared insights from the collective.
        """
        insights = self.knowledge["shared_insights"]
        
        if insight_type:
            insights = [i for i in insights if i["type"] == insight_type]
        
        insights = [i for i in insights if i["confidence"] >= min_confidence]
        
        return sorted(insights, key=lambda x: x["confidence"], reverse=True)
    
    # ==================== Agent Expertise ====================
    
    def register_expertise(self, agent_name: str, skills: List[str]):
        """
        Register an agent's expertise areas.
        """
        self.knowledge["agent_expertise"][agent_name] = {
            "skills": skills,
            "registered_at": datetime.now().isoformat()
        }
        
        # Proactively audit intelligence mapped to this new expertise
        if agent_name == "The Cognitive Architect":
             self.get_intelligence_map()
             
        self._save_knowledge()
        
    def find_expert(self, skill_needed: str) -> Optional[str]:
        """
        Find the best agent for a particular skill.
        """
        for agent, data in self.knowledge["agent_expertise"].items():
            if skill_needed.lower() in [s.lower() for s in data["skills"]]:
                return agent
        return None
    
    def get_team_capabilities(self) -> Dict:
        """
        Get an overview of all team capabilities.
        """
        return self.knowledge["agent_expertise"]
    
    # ==================== Collective Learning ====================
    
    def learn_lesson(self, agent_name: str, lesson: str, 
                     context: str, outcome: str, tags: List[str] = None):
        """
        Record a lesson learned for the whole team.
        Now uses persistent SQLite storage.
        """
        # Save to DB
        self.memory.save_lesson(agent_name, lesson, context, outcome, tags)
        
        # Keep legacy JSON for now (optional, but good for backward compat)
        entry = {
            "from_agent": agent_name,
            "lesson": lesson,
            "context": context,
            "outcome": outcome,
            "learned_at": datetime.now().isoformat()
        }
        self.knowledge["lessons_learned"].append(entry)
        self._save_knowledge()
        logger.info(f"[Collective] Lesson learned: {lesson[:50]}...")
        
    def get_relevant_lessons(self, context: str) -> List[Dict]:
        """
        Get lessons relevant to a particular context.
        Uses SQLite search.
        """
        return self.memory.search_lessons(query=context, limit=5)

    def consult_collective(self, action_type: str, context: str) -> List[str]:
        """
        Proactive Check: Consult the collective before taking an action.
        Returns a list of warnings or advice based on past failures/lessons.
        """
        lessons = self.memory.search_lessons(query=action_type, limit=5)
        
        advice = []
        for lesson in lessons:
            # simple filter to see if context matches enough to be relevant
            if lesson["outcome"] == "FAILED":
                advice.append(f"⚠️ WARNING: Previous attempt failed. Lesson: {lesson['lesson']}")
            else:
                advice.append(f"💡 TIP: {lesson['lesson']}")
                
        return advice

    def learn_from_failure(self, agent_name: str, action: str, error: str, context: Optional[Dict] = None):
        """
        Reflexive Learning: Automatically analyze a failure and learn from it.
        Uses standardized Gemini model.
        """
        logger.info(f"[Collective] 🛑 Analyzing failure in {action} by {agent_name}...")
        
        prompt = f"""
        As the Collective Intelligence, analyze this system failure to prevent it from happening again.
        
        AGENT: {agent_name}
        ACTION: {action}
        ERROR: {error}
        CONTEXT: {json.dumps(context, default=str) if context else "N/A"}
        
        1. Identify the root cause (Code error? Environment? API outage? User error?)
        2. Formulate a concise, actionable LESSON for the future.
           - Bad: "Something went wrong."
           - Good: "When using CapCut API, always ensure the export path exists before rendering."
        3. Suggest ONE immediate fix or check to perform next time.
        
        Return JSON:
        {{
            "root_cause": "...",
            "lesson": "...", 
            "fix": "...",
            "tags": ["tag1", "tag2"]
        }}
        """
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            
            response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            resp_json = response.text.strip()
            
            if "{" in resp_json:
                data = json.loads(resp_json[resp_json.find("{"):resp_json.rfind("}")+1])
                
                lesson_text = data.get("lesson")
                if lesson_text:
                    self.learn_lesson(
                        agent_name, 
                        lesson_text, 
                        f"Failure in {action}: {error}", 
                        "FAILED",
                        data.get("tags", [])
                    )
                    logger.info(f"[Collective] 🧠 Learned from failure: {lesson_text}")
                    return data
        except Exception as e:
            logger.error(f"[Collective] Failed to learn from failure: {e}")
                
        return None
    
    # ==================== Collective Decisions ====================
    
    def propose_decision(self, proposer: str, decision: str, 
                        options: List[str]) -> Dict:
        """
        Propose a decision for team input.
        """
        proposal = {
            "id": f"decision-{int(datetime.now().timestamp())}",
            "proposer": proposer,
            "decision": decision,
            "options": options,
            "votes": {},
            "status": "open",
            "proposed_at": datetime.now().isoformat()
        }
        
        self.knowledge["team_decisions"].append(proposal)
        self._save_knowledge()
        
        return proposal
    
    def vote_on_decision(self, decision_id: str, agent_name: str, 
                         vote: str, reasoning: str = ""):
        """
        Cast a vote on a team decision.
        """
        for decision in self.knowledge["team_decisions"]:
            if decision["id"] == decision_id:
                decision["votes"][agent_name] = {
                    "choice": vote,
                    "reasoning": reasoning,
                    "voted_at": datetime.now().isoformat()
                }
                self._save_knowledge()
                return True
        return False
    
    def get_decision_result(self, decision_id: str) -> Optional[Dict]:
        """
        Get the result of a team decision.
        """
        for decision in self.knowledge["team_decisions"]:
            if decision["id"] == decision_id:
                # Count votes
                vote_counts = {}
                for vote_data in decision["votes"].values():
                    choice = vote_data["choice"]
                    vote_counts[choice] = vote_counts.get(choice, 0) + 1
                
                if vote_counts:
                    winner = max(vote_counts, key=vote_counts.get)
                    return {
                        "decision": decision["decision"],
                        "winner": winner,
                        "vote_counts": vote_counts,
                        "total_votes": len(decision["votes"])
                    }
        return None
    
    # ==================== Team Goals ====================
    
    def set_goal(self, goal: str, assigned_agents: List[str], 
                 priority: str = "medium"):
        """
        Set a goal for the team.
        """
        goal_entry = {
            "id": f"goal-{int(datetime.now().timestamp())}",
            "goal": goal,
            "assigned_to": assigned_agents,
            "priority": priority,
            "status": "active",
            "progress": 0,
            "created_at": datetime.now().isoformat()
        }
        
        self.knowledge["active_goals"].append(goal_entry)
        self._save_knowledge()
        
        return goal_entry
    
    def update_goal_progress(self, goal_id: str, progress: int, 
                             notes: str = ""):
        """
        Update progress on a goal.
        """
        for goal in self.knowledge["active_goals"]:
            if goal["id"] == goal_id:
                goal["progress"] = min(100, progress)
                if progress >= 100:
                    goal["status"] = "completed"
                goal["last_update"] = {
                    "progress": progress,
                    "notes": notes,
                    "updated_at": datetime.now().isoformat()
                }
                self._save_knowledge()
                return True
        return False
    
    # ==================== Collective Analysis ====================
    
    def analyze_with_team(self, question: str, context: str) -> Dict:
        """
        Use the Studio Node to get a collective analysis.
        """
        if self.node_url:
            import requests
            try:
                # Get relevant lessons
                lessons = self.get_relevant_lessons(context)
                lessons_text = "\n".join([l["lesson"] for l in lessons[:3]])
                
                # Get recent insights
                insights = self.get_insights()[:5]
                insights_text = "\n".join([
                    f"- {i['from_agent']}: {i['insight']}" 
                    for i in insights
                ])
                
                prompt = f"""
                As the Collective Intelligence of an AI team, analyze this question:
                
                Question: {question}
                Context: {context}
                
                Relevant past lessons:
                {lessons_text}
                
                Recent team insights:
                {insights_text}
                
                Provide a thoughtful analysis drawing on the team's collective knowledge.
                Return JSON:
                {{
                    "analysis": "your analysis",
                    "recommendation": "what to do",
                    "confidence": 0.0-1.0,
                    "agents_to_involve": ["agent1", "agent2"]
                }}
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=60
                )
                response.raise_for_status()
                result = response.json().get("response", "")
                
                if "{" in result:
                    json_str = result[result.find("{"):result.rfind("}")+1]
                    return json.loads(json_str)
                    
            except Exception as e:
                logger.warning(f"[Collective] Analysis failed: {e}")
        
        return {
            "analysis": "Analysis requires Studio Node connection",
            "recommendation": "Connect to Studio Node for enhanced analysis",
            "confidence": 0.3
        }
    
    # ==================== Research & Investigation ====================
    
    def request_research(self, topic: str) -> Dict:
        """
        Request the Researcher to investigate a topic.
        """
        from admin.engineers.researcher import Researcher
        researcher = Researcher()
        result = researcher.investigate(topic)
        
        if result["status"] == "success":
            # Share the findings with the collective
            self.share_insight(
                "Researcher",
                "research_findings",
                {
                    "topic": topic,
                    "summary": result["summary"],
                    "top_findings": [f["name"] for f in result["findings"]]
                },
                confidence=0.9
            )
            
            # Store full details as a lesson/resource
            self.learn_lesson(
                "Researcher",
                f"Research on {topic} yielded {len(result['findings'])} results.",
                f"Research: {topic}",
                "SUCCESS"
            )
            
        return result
    
    # ==================== Self-Critique & Learning ====================
    
    def critique_action(self, action_name: str, inputs: Dict, result: str, 
                        duration: float, error: Optional[str] = None):
        """
        Critique a completed action to learn from it using Gemini.
        """
        status = "FAILED" if error else "SUCCESS"
        logger.info(f"[Critique] Analyzing {action_name} ({status} in {duration:.2f}s)...")
        
        prompt = f"""
        As the Collective Intelligence, critique this recent action by an agent.
        
        ACTION: {action_name}
        STATUS: {status}
        DURATION: {duration:.2f}s
        INPUTS: {json.dumps(inputs, default=str)}
        RESULT/ERROR: {error if error else result}
        
        Analyze efficienty, correctness, and alignment with the mission.
        Did it succeed? If not, why?
        If it succeeded, was it optimal?
        
        Return JSON with:
        {{
            "analysis": "Brief analysis of the action",
            "rating": 1-10 (1=terrible, 10=perfect),
            "lesson": "A universal lesson learned, if any (or null)",
            "insight": "A specific insight about this task/tool (or null)"
        }}
        """
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            
            response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            resp_json = response.text.strip()
            
            if "{" in resp_json:
                data = json.loads(resp_json[resp_json.find("{"):resp_json.rfind("}")+1])
                
                # Log the critique
                self.knowledge["shared_insights"].append({
                    "from_agent": "Self-Critique",
                    "type": "critique",
                    "insight": f"[{action_name}] {data.get('analysis')}",
                    "rating": data.get('rating'),
                    "shared_at": datetime.now().isoformat()
                })
                
                # Store lessons
                if data.get("lesson"):
                    self.learn_lesson(
                        "Self-Critique", 
                        data["lesson"], 
                        f"Action: {action_name}", 
                        status
                    )
                    
                self._save_knowledge()
                logger.info(f"[Critique] Completed. Rating: {data.get('rating')}/10")
                return data
        except Exception as e:
            logger.warning(f"[Critique] Failed to run critique LLM: {e}")
            pass

    def get_team_status(self) -> Dict:
        """
        Get overall team status and health.
        """
        return {
            "total_insights": len(self.knowledge["shared_insights"]),
            "registered_experts": len(self.knowledge["agent_expertise"]),
            "lessons_learned": len(self.knowledge["lessons_learned"]),
            "active_goals": len([g for g in self.knowledge["active_goals"] 
                                if g["status"] == "active"]),
            "pending_decisions": len([d for d in self.knowledge["team_decisions"]
                                     if d["status"] == "open"])
        }

    def get_intelligence_map(self) -> Dict:
        """
        Consults the Cognitive Architect to map the system's latent intelligence axes.
        """
        from admin.engineers.cognitive_architect import CognitiveArchitect
        architect = CognitiveArchitect()
        map_report = architect.audit_collective_intelligence()
        
        # Share as a high-level systemic insight
        if "systemic_geometry" in map_report:
            self.share_insight(
                "Collective Intelligence", 
                "systemic_audit", 
                map_report["systemic_geometry"], 
                confidence=1.0
            )
            
        return map_report


# Singleton instance
_collective = None

def get_collective_intelligence() -> CollectiveIntelligence:
    """Get the global collective intelligence instance."""
    global _collective
    if _collective is None:
        _collective = CollectiveIntelligence()
    return _collective


if __name__ == "__main__":
    ci = CollectiveIntelligence()
    
    # Test knowledge sharing
    ci.share_insight("Analyst", "content_trend", 
                     {"trend": "AI ethics getting more attention"}, 0.8)
    
    # Test expertise
    ci.register_expertise("Alchemist", ["content generation", "RAG", "embeddings"])
    ci.register_expertise("Designer", ["visual design", "branding", "images"])
    
    print("Expert for 'visual design':", ci.find_expert("visual design"))
    print("Team Status:", ci.get_team_status())
