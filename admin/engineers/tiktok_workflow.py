"""
TikTok Workflow - n8n-Inspired Workflow Orchestrator

Orchestrates the full TikTok content creation pipeline with
step tracking, replay capability, and workflow templates.
"""

import os
import sys
import json
import logging
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector

logger = logging.getLogger("TikTokWorkflow")


class StepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowStep:
    """Represents a single step in the workflow."""
    name: str
    status: StepStatus
    input_data: Any
    output_data: Any = None
    error: str = None
    started_at: str = None
    completed_at: str = None
    duration_ms: int = 0


class TikTokWorkflow:
    """
    n8n-Style Workflow Orchestrator for TikTok Content
    
    Features:
    - Step-by-step execution with logging
    - Replay from any step
    - Template-based configurations
    - Full execution history
    """
    
    # Workflow templates inspired by Blotato
    TEMPLATES = {
        "storytime": {
            "description": "Personal narrative format - best for blog content",
            "vibe": "chill",
            "voice": "en-GB-SoniaNeural",
            "hook_style": "story",
            "music_volume": 0.4,
            "caption_style": "yellow",
            "target_duration": 45
        },
        "viral_hook": {
            "description": "High-energy controversial hook format",
            "vibe": "upbeat",
            "voice": "en-US-GuyNeural",
            "hook_style": "controversy",
            "music_volume": 0.3,
            "caption_style": "white",
            "target_duration": 30
        },
        "educational": {
            "description": "Calm explainer format - tips and how-tos",
            "vibe": "tech",
            "voice": "en-US-ChristopherNeural",
            "hook_style": "listicle",
            "music_volume": 0.35,
            "caption_style": "yellow",
            "target_duration": 60
        },
        "quick_hit": {
            "description": "Ultra-short punchy format",
            "vibe": "upbeat",
            "voice": "en-US-GuyNeural",
            "hook_style": "shock",
            "music_volume": 0.25,
            "caption_style": "white",
            "target_duration": 15
        },
        "thought_leader": {
            "description": "Premium engineering/tech leadership format",
            "vibe": "tech",
            "voice": "en-US-BrianMultilingualNeural", # Deep, authoritative
            "hook_style": "story",
            "music_volume": 0.35,
            "caption_style": "green", # Matrix style captions? or standard
            "target_duration": 60
        }
    }
    
    def __init__(self, template: str = "storytime"):
        self.template_name = template
        self.config = self.TEMPLATES.get(template, self.TEMPLATES["storytime"])
        self.steps: List[WorkflowStep] = []
        self.current_step_index = -1
        self.workflow_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        
    def execute(self, post: Dict) -> Dict:
        """
        Executes the full TikTok workflow for a blog post.
        
        Pipeline:
        1. Analyze - CreativeDirector analyzes for TikTok potential
        2. Repurpose - Generate TikTok-specific script
        3. Coach - Viral Coach scores and improves
        4. Generate - Create voiceover and video
        5. Review - Final quality check
        6. Upload - Post to TikTok
        """
        logger.info(f"Starting workflow {self.workflow_id} with template '{self.template_name}'")
        
        result = {
            "workflow_id": self.workflow_id,
            "template": self.template_name,
            "config": self.config,
            "post_title": post.get("title"),
            "started_at": datetime.now().isoformat(),
            "steps": []
        }
        
        # Step 0: Collective Learning (Retrieve past lessons)
        from admin.brain.collective_intelligence import get_collective_intelligence
        collective = get_collective_intelligence()
        
        # Get lessons relevant to this specific template/vibe
        context = f"tiktok {self.template_name} {self.config['vibe']}"
        past_lessons = collective.get_relevant_lessons(context)
        
        if past_lessons:
            logger.info(f"[{self.template_name}] Applying {len(past_lessons)} past lessons")
            for lesson in past_lessons:
                logger.info(f"   • {lesson['lesson']}")

        try:
            # Step 1: Analyze
            analysis = self._execute_step(
                "analyze",
                self._step_analyze,
                {"post": post}
            )
            
            # Step 2: Repurpose
            repurposed = self._execute_step(
                "repurpose",
                self._step_repurpose,
                {"post": post, "analysis": analysis}
            )
            
            # Step 3: Coach (with collective wisdom)
            coached = self._execute_step(
                "coach",
                self._step_coach,
                {
                    "script": repurposed.get("script", ""),
                    "past_lessons": past_lessons # Pass lessons to coach
                }
            )
            
            # Step 3.5: Creative Director Review (Mandatory)
            final_script = coached.get("final_script", repurposed.get("script"))
            cd_review = self._execute_step(
                "creative_review",
                self._step_creative_review,
                {"script": final_script, "vibe": self.config["vibe"]}
            )
            
            if not cd_review["approved"]:
                raise ValueError(f"Creative Director rejected script: {cd_review['issues']}")
            
            # Step 4: Generate Video
            video_result = self._execute_step(
                "generate",
                self._step_generate,
                {
                    "post": post,
                    "script": final_script,
                    "vibe": self.config["vibe"],
                    "voice": self.config["voice"]
                }
            )
            
            # Step 5: Review
            review = self._execute_step(
                "review",
                self._step_review,
                {"video_path": video_result.get("video_path")}
            )
            
            if not review["approved"]:
                raise ValueError(f"Video review failed: {review.get('reason')}")

            # Step 6: Upload
            upload = self._execute_step(
                "upload",
                self._step_upload,
                {
                    "video_path": review["video_path"],
                    "post": post,
                    "script": final_script
                }
            )
            
            result["completed_at"] = datetime.now().isoformat()
            result["success"] = True
            result["video_path"] = video_result.get("video_path")
            result["viral_score"] = coached.get("viral_score", 0)
            
            # Convert steps to dict and handle Enum serialization
            steps_data = []
            for s in self.steps:
                step_dict = asdict(s)
                step_dict["status"] = s.status.value if isinstance(s.status, StepStatus) else str(s.status)
                steps_data.append(step_dict)
            result["steps"] = steps_data
            
        except Exception as e:
            logger.error(f"Workflow failed: {e}")
            result["success"] = False
            result["error"] = str(e)
            
            # Convert steps to dict and handle Enum serialization
            steps_data = []
            for s in self.steps:
                step_dict = asdict(s)
                step_dict["status"] = s.status.value if isinstance(s.status, StepStatus) else str(s.status)
                steps_data.append(step_dict)
            result["steps"] = steps_data
            
        # Sanitize result for JSON serialization (handle date objects)
        def json_serial(obj):
            if isinstance(obj, (datetime, date)):
                return obj.isoformat()
            if isinstance(obj, Enum):
               return obj.value
            raise TypeError (f"Type {type(obj)} not serializable")
            
        # We can't easily pass a custom encoder to memory.save_insight if it uses json.dumps internally.
        # So we pre-serialize or sanitize the dict.
        import json
        from datetime import date
        
        # Recursive sanitization
        def sanitize(obj):
            if isinstance(obj, (datetime, date)):
                return obj.isoformat()
            if isinstance(obj, Enum):
                return obj.value
            if isinstance(obj, dict):
                return {k: sanitize(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [sanitize(v) for v in obj]
            return obj
            
        result_clean = sanitize(result)

        # Save to memory for future reference
        self.memory.save_insight("workflow_execution", result_clean, confidence=1.0, source="TikTokWorkflow")
        
        # LEARNING LOOP: Save explicit lesson if we have clear feedback
        if result["success"]:
            # If viral score is high, learn why
            score = result.get("viral_score", 0)
            if score >= 8.0:
                collective.learn_lesson(
                    "TikTokWorkflow",
                    f"High performing script ({score}/10) with {self.config['template']} template",
                    f"tiktok {self.config['template']} success",
                    "positive"
                )
            elif score <= 5.0:
                 collective.learn_lesson(
                    "TikTokWorkflow",
                    f"Low performing script ({score}/10) - needs hook improvement",
                    f"tiktok {self.config['template']} failure",
                    "negative"
                )
                
        self.metrics.log_event("workflow", {
            "workflow_id": self.workflow_id,
            "success": result.get("success"),
            "template": self.template_name
        })
        
        return result
    
    def _execute_step(self, name: str, func: Callable, input_data: Dict) -> Dict:
        """Executes a single step with tracking."""
        step = WorkflowStep(
            name=name,
            status=StepStatus.RUNNING,
            input_data=input_data,
            started_at=datetime.now().isoformat()
        )
        self.steps.append(step)
        self.current_step_index = len(self.steps) - 1
        
        logger.info(f"Step {len(self.steps)}: {name} - STARTED")
        start_time = datetime.now()
        
        try:
            output = func(input_data)
            step.output_data = output
            step.status = StepStatus.COMPLETED
            logger.info(f"Step {len(self.steps)}: {name} - COMPLETED")
        except Exception as e:
            step.error = str(e)
            step.status = StepStatus.FAILED
            logger.error(f"Step {len(self.steps)}: {name} - FAILED: {e}")
            raise
        finally:
            step.completed_at = datetime.now().isoformat()
            step.duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
        return output
    
    def replay_from(self, step_index: int, mock_data: Dict = None) -> Dict:
        """Replays workflow from a specific step."""
        if step_index >= len(self.steps):
            raise ValueError(f"Step {step_index} does not exist")
            
        logger.info(f"Replaying from step {step_index}")
        
        # Use mock data or previous step's output
        if mock_data:
            input_data = mock_data
        elif step_index > 0:
            input_data = self.steps[step_index - 1].output_data
        else:
            input_data = self.steps[0].input_data
            
        # Remove steps from index onwards
        self.steps = self.steps[:step_index]
        
        # Re-execute from this point
        # This would need the full post context, so simplified for now
        return {"replayed_from": step_index, "new_step_count": len(self.steps)}
    
    def get_step_log(self, step_index: int) -> Dict:
        """Gets detailed log for a specific step."""
        if step_index >= len(self.steps):
            return {"error": f"Step {step_index} does not exist"}
            
        step = self.steps[step_index]
        return asdict(step)
    
    def get_all_logs(self) -> List[Dict]:
        """Gets logs for all steps."""
        return [asdict(s) for s in self.steps]
    
    # Individual step implementations
    
    def _step_analyze(self, data: Dict) -> Dict:
        """Analyzes post for TikTok potential."""
        post = data["post"]
        content = post.get("content", "")
        title = post.get("title", "")
        
        # Simple analysis - could use CreativeDirector for more sophistication
        word_count = len(content.split())
        
        # Determine recommended template based on content
        content_lower = content.lower()
        if any(w in content_lower for w in ["steps", "tips", "how to", "ways to"]):
            recommended = "educational"
        elif any(w in content_lower for w in ["story", "happened", "learned", "realized"]):
            recommended = "storytime"
        elif word_count < 200:
            recommended = "quick_hit"
        else:
            recommended = "viral_hook"
            
        return {
            "title": title,
            "word_count": word_count,
            "recommended_template": recommended,
            "current_template": self.template_name,
            "tiktok_potential": "high" if word_count < 500 else "medium"
        }
    
    def _step_repurpose(self, data: Dict) -> Dict:
        """Repurposes content for TikTok."""
        from admin.engineers.content_repurposer import get_content_repurposer
        
        repurposer = get_content_repurposer()
        result = repurposer.repurpose(data["post"], platforms=["tiktok"])
        
        tiktok_content = result["outputs"].get("tiktok", {})
        
        return {
            "script": tiktok_content.get("script", ""),
            "hashtags": tiktok_content.get("hashtags", ""),
            "suggested_vibe": tiktok_content.get("suggested_vibe", self.config["vibe"])
        }
    
    def _step_coach(self, data: Dict) -> Dict:
        """Runs script through Viral Coach for optimization."""
        from admin.engineers.viral_coach import get_viral_coach
        
        coach = get_viral_coach()
        analysis = coach.analyze_tiktok_script(data["script"], self.config["hook_style"])
        
        # If score is low, try to improve
        if analysis["overall_score"] < 7:
            improved = coach.improve_script(data["script"])
            if improved.get("improved"):
                return {
                    "original_script": data["script"],
                    "final_script": improved["improved_script"],
                    "viral_score": improved["improved_analysis"]["overall_score"],
                    "improvements_made": True,
                    "analysis": improved["improved_analysis"]
                }
        
        return {
            "original_script": data["script"],
            "final_script": data["script"],
            "viral_score": analysis["overall_score"],
            "improvements_made": False,
            "analysis": analysis
        }
    
    def _step_creative_review(self, data: Dict) -> Dict:
        """Mandatory Creative Director review."""
        from admin.engineers.creative_director import CreativeDirector
        
        cd = CreativeDirector()
        review = cd.review_tiktok_script(data["script"], data["vibe"])
        
        return review

    def _step_generate(self, data: Dict) -> Dict:
        """Generates the video with voiceover."""
        from admin.engineers.broadcaster import Broadcaster
        
        broadcaster = Broadcaster()
        
        # Build post dict for broadcaster
        post = data["post"]
        post["script"] = data["script"]  # Inject improved script
        
        video_path = broadcaster.generate_video(post, vibe=data["vibe"], voice=data["voice"])
        
        return {
            "video_path": video_path,
            "vibe": data["vibe"],
            "voice": data["voice"],
            "success": video_path is not None
        }
    
    def _step_review(self, data: Dict) -> Dict:
        """Final quality review before upload."""
        video_path = data.get("video_path")
        
        if not video_path:
            return {"approved": False, "reason": "No video generated"}
            
        if not os.path.exists(video_path):
            return {"approved": False, "reason": "Video file not found"}
            
        # Check file size (TikTok limit is ~287MB)
        file_size = os.path.getsize(video_path)
        size_mb = file_size / (1024 * 1024)
        
        if size_mb > 280:
            return {"approved": False, "reason": f"File too large: {size_mb:.1f}MB"}
            
        return {
            "approved": True,
            "video_path": video_path,
            "file_size_mb": round(size_mb, 2)
        }

    def _step_upload(self, data: Dict) -> Dict:
        """Uploads the video to TikTok."""
        from admin.engineers.broadcaster import Broadcaster
        
        broadcaster = Broadcaster()
        video_path = data["video_path"]
        post = data["post"]
        
        # Create description with hashtags
        title = post.get("title", "New Post")
        hashtags = "#blog #tech #ai #fyp" # Could be dynamic from repurpose step
        description = f"{title}\n\n{hashtags}"
        
        success = broadcaster.upload_to_tiktok(video_path, description)
        
        if not success:
            raise RuntimeError("Upload failed. Check logs or cookies.")
            
        return {
            "uploaded": True,
            "video_path": video_path,
            "timestamp": datetime.now().isoformat()
        }
    
    @classmethod
    def auto_select_template(cls, post: Dict) -> str:
        """Auto-selects the best template based on content."""
        content = post.get("content", "").lower()
        word_count = len(content.split())
        
        if word_count < 150:
            return "quick_hit"
        elif any(w in content for w in ["steps", "tips", "guide", "how to"]):
            return "educational"
        elif any(w in content for w in ["unpopular", "hot take", "truth", "myth"]):
            return "viral_hook"
        else:
            return "storytime"


# Quick access functions
def get_tiktok_workflow(template: str = "storytime") -> TikTokWorkflow:
    return TikTokWorkflow(template)


def create_tiktok_from_post(post: Dict, template: str = "auto") -> Dict:
    """Convenience function to create TikTok from a post."""
    if template == "auto":
        template = TikTokWorkflow.auto_select_template(post)
        
    workflow = TikTokWorkflow(template)
    return workflow.execute(post)


if __name__ == "__main__":
    # Test the workflow
    test_post = {
        "title": "The Lost Art of Stillness",
        "slug": "the-lost-art-of-stillness",
        "content": """
        In a world increasingly defined by constant connectivity,
        we've lost something precious: the ability to simply be still.
        
        I used to fill every quiet moment with podcasts or scrolling.
        But then I tried 10 minutes of complete silence each morning.
        
        What I discovered surprised me. My best ideas came from
        the spaces in between, not from consuming more content.
        
        Now I protect that stillness like it's sacred. Because it is.
        """,
        "tags": ["mindfulness", "productivity"]
    }
    
    print("=== TikTok Workflow Test ===\n")
    print(f"Auto-selected template: {TikTokWorkflow.auto_select_template(test_post)}")
    
    workflow = TikTokWorkflow("storytime")
    print(f"\nUsing template: {workflow.template_name}")
    print(f"Config: {json.dumps(workflow.config, indent=2)}")
    
    # Just test analysis step without full execution
    result = workflow._step_analyze({"post": test_post})
    print(f"\nAnalysis: {json.dumps(result, indent=2)}")
