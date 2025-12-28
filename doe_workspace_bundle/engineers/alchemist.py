import os
import json
import time
import frontmatter
import numpy as np
import google.generativeai as genai
from huggingface_hub import InferenceClient
from typing import List, Dict, Optional, Any
import sys
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import config
from admin.infrastructure.data_center import DataCenter
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from admin.decorators import critique_action
from admin.brain.agent_base import BaseAgent  # New Import
from admin.engineers.web_scout import get_web_scout
import shutil

logger = logging.getLogger("Alchemist")

class Alchemist(BaseAgent):  # Inherit from BaseAgent
    """
    The Alchemist (Machine Learning Engineer)
    Now fully data-driven via admin/brain/agents/alchemist/
    """
    def __init__(self):
        # Initialize BaseAgent to load Profile & Skills
        super().__init__(agent_id="alchemist")
        
        self.brain_dir = config.BRAIN_DIR
        self.memory_file = os.path.join(self.brain_dir, 'memory.json')
        self.content_dir = config.CONTENT_DIR
        
        # Ensure brain directory exists
        os.makedirs(self.brain_dir, exist_ok=True)
        
        # Configure Gemini
        api_key = self.get_secret("GEMINI_API_KEY")
        if not api_key:
            # warn instead of raise to allow partial initialization
             logger.warning("GEMINI_API_KEY not found. Alchemist running with limited capacity.")
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)

        self.embedding_model = config.EMBEDDING_MODEL
        self.chat_session = None
        self.data_center = DataCenter(config)
        
        # Initialize OpenRouter
        from admin.infrastructure.openrouter import OpenRouterClient
        self.openrouter = OpenRouterClient(self.get_secret("OPENROUTER_API_KEY"))
        
        # Initialize memory and metrics systems
        self.memory_store = get_memory_store()
        self.metrics = get_metrics_collector()
        self.session_id = f"session-{int(time.time())}"
        
        # Initialize Web Scout
        self.web_scout = get_web_scout()
        
        logger.info(f"[{self.name}] Initialized with enhanced memory and metrics")

    async def execute(self, action: str, **params) -> Dict[str, Any]:
        """
        Executes an action via the unified Agent Interface.
        """
        if action == "generate":
            topic = params.get("topic")
            deep_mode = params.get("deep_mode", False)
            
            if not topic:
                raise ValueError("Topic is required for generation.")
                
            from admin.core import get_doctrine
            doctrine = get_doctrine()
            
            content, context = await self.generate(topic, doctrine, deep_mode=deep_mode)
            return {
                "content": content,
                "context": context,
                "status": "success"
            }
            
        elif action == "chat":
            message = params.get("message")
            return {"response": self.chat(message)}
            
        elif action == "research":
            topic = params.get("topic")
            return {"research_brief": self.conduct_research(topic)}

        elif action == "refine_code":
            file_path = params.get("file_path")
            instruction = params.get("instruction")
            return self.refine_code(file_path, instruction)
            
        else:
            raise NotImplementedError(f"Action {action} not supported by Alchemist.")

    def select_best_provider(self) -> str:
        """
        Autonomously selects the best provider based on infrastructure health.
        """
        print(f"[{self.name}] Assessing infrastructure for compute resources...")
        
        # Check Studio Node (Windows)
        node_status = self.data_center.check_node_health("studio_node")
        if node_status['status'] == 'online':
            print(f"[{self.name}] Studio Node is ONLINE. Selecting 'remote' provider.")
            return "remote"
            
        print(f"[{self.name}] Studio Node is {node_status['status'].upper()}. Falling back to 'gemini'.")
        return "gemini"

    def select_openrouter_model(self, deep_mode: bool = False) -> str:
        """
        Selects the appropriate OpenRouter model.
        Prioritizes FREE models as per user preference.
        """
        if deep_mode:
            # Gemma 2 9B is a great free model for 'deeper' reasoning
            return config.OR_FREE_GEMMA
        return config.OR_FREE_MISTRAL

    def start_chat(self):
        """Starts a new chat session."""
        self.chat_session = self.model.start_chat(history=[])
        return "Chat session started."

    def chat(self, message: str) -> str:
        """Sends a message to the chat session and returns the response."""
        if not self.chat_session:
            self.start_chat()
        
        try:
            response = self.chat_session.send_message(message)
            return response.text
        except Exception as e:
            logger.warning(f"Alchemist brain offline: {e}")
            # Thematic Fallback (True Alchemy)
            return "My neural core is cooling down from super-luminal processing. Give me a moment to realign my cognitive matrix."

    def conduct_research(self, topic: str) -> str:
        """
        Conducts deep research using the Web Scout and synthesizes a brief.
        """
        logger.info(f"[{self.name}] Commissioning Web Scout for: {topic}")
        findings = self.web_scout.research_topic(topic)
        
        # Synthesize logic could be more complex, but for now we format the raw findings
        brief = f"# Research Brief: {topic}\n\n"
        brief += f"Generated: {findings['researched_at']}\n\n"
        
        brief += "## Key Search Results\n"
        for item in findings.get('general_results', [])[:5]:
            brief += f"- **{item.get('title')}**: {item.get('snippet')}\n"
            
        brief += "\n## Recent News\n"
        for item in findings.get('recent_news', [])[:3]:
            brief += f"- {item.get('title')} ({item.get('date', 'Recent')})\n"
            
        brief += "\n## Statistics\n"
        for item in findings.get('statistics', [])[:3]:
            brief += f"- {item.get('title')}: {item.get('snippet')}\n"
            
        return brief

    def refine_code(self, file_path: str, instruction: str) -> Dict[str, Any]:
        """
        Refines code in a file based on instructions.
        Creates a backup, writes the new code, and returns status.
        """
        if not os.path.exists(file_path):
            return {"status": "error", "message": f"File not found: {file_path}"}
            
        logger.info(f"[{self.name}] Refining code in {file_path} with instruction: {instruction}")
        
        # 1. Read original content
        with open(file_path, 'r') as f:
            original_code = f.read()
            
        # 2. Create Backup
        backup_path = f"{file_path}.bak.{int(time.time())}"
        shutil.copy(file_path, backup_path)
        
        # 3. Generate New Code
        prompt = f"""
        You are The Alchemist, an expert software engineer.
        
        TASK: Refactor/Update the following code.
        FILE: {file_path}
        INSTRUCTION: {instruction}
        
        ORIGINAL CODE:
        {original_code}
        
        OUTPUT:
        Return ONLY the full, valid, updated code. No markdown code blocks, no explanations.
        """
        
        try:
            # We use the 'auto' provider logic from generate but simplified direct call
            # For safety, let's use the simplest configured model (Gemini)
            response = self.model.generate_content(prompt)
            new_code = response.text
            
            # Clean possible markdown
            if new_code.startswith("```"):
                lines = new_code.split('\n')
                if lines[0].strip().startswith("```"):
                    lines = lines[1:]
                if lines[-1].strip() == "```":
                    lines = lines[:-1]
                new_code = "\n".join(lines)
            
            # 4. Write new code
            with open(file_path, 'w') as f:
                f.write(new_code)
                
            return {
                "status": "success",
                "message": "Code refined and saved.",
                "backup": backup_path,
                "diff_summary": f"Updated {file_path}"
            }
            
        except Exception as e:
            logger.error(f"[{self.name}] Code refinement failed: {e}")
            # Restore backup? Maybe better to leave it broken so user sees what happened, 
            # but user has backup.
            return {"status": "error", "message": str(e)}

    def analyze_code(self, file_paths: List[str], query: str) -> str:
        """
        Reads the content of specified files and answers a query about them.
        """
        context = ""
        for path in file_paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        content = f.read()
                        context += f"\n--- FILE: {path} ---\n{content}\n"
                except Exception as e:
                    context += f"\n--- FILE: {path} (Error reading: {e}) ---\n"
            else:
                context += f"\n--- FILE: {path} (Not found) ---\n"
        
        prompt = f"""
        You are an expert software engineer analyzing the following code files.
        
        CODE CONTEXT:
        {context}
        
        QUERY:
        {query}
        
        Provide a clear, concise, and technically accurate answer.
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error analyzing code: {e}"

    def build_memory(self):
        """
        Scans all markdown posts, generates embeddings, and saves them to memory.json.
        """
        import time
        print(f"[{self.name}] Scanning content in {self.content_dir}...")
        memory = []
        
        files = [f for f in os.listdir(self.content_dir) if f.endswith('.md')]
        # Limit to 20 for testing
        files = files[:20]
        print(f"[{self.name}] Found {len(files)} posts to process (limited for testing).")
        
        for i, filename in enumerate(files):
            filepath = os.path.join(self.content_dir, filename)
            try:
                with open(filepath, 'r') as f:
                    post = frontmatter.load(f)
                    
                # Create a rich text representation for embedding
                title = post.get('title', 'Untitled')
                tags = post.get('tags', [])
                content_preview = post.content[:1000] # First 1000 chars
                
                text_to_embed = f"Title: {title}\nTags: {tags}\nContent: {content_preview}"
                
                # Generate embedding with retry logic
                embedding = None
                retries = config.MAX_RETRIES
                for attempt in range(retries):
                    try:
                        # Check for Studio Node offloading
                        node_url = config.STUDIO_NODE_URL
                        if node_url:
                            import requests
                            response = requests.post(
                                f"{node_url}/api/embeddings",
                                json={"model": "nomic-embed-text", "prompt": text_to_embed},
                                timeout=config.TIMEOUT_EMBEDDING
                            )
                            response.raise_for_status()
                            embedding = response.json().get("embedding")
                        else:
                            # Fallback to Gemini
                            embedding = genai.embed_content(
                                model=self.embedding_model,
                                content=text_to_embed,
                                task_type="retrieval_document"
                            )['embedding']
                        break
                    except Exception as e:
                        if "429" in str(e):
                            wait_time = (attempt + 1) * 2
                            print(f"[{self.name}] Rate limit hit. Waiting {wait_time}s...")
                            time.sleep(wait_time)
                        else:
                            raise e
                
                if embedding:
                    memory.append({
                        'filename': filename,
                        'title': title,
                        'tags': tags,
                        'embedding': embedding,
                        'excerpt': content_preview[:200] + "..."
                    })
                    print(f"[{self.name}] Memorized ({i+1}/{len(files)}): {title}")
                else:
                    print(f"[{self.name}] Skipped {title} after {retries} retries.")
                
                # Save periodically
                if (i + 1) % 5 == 0:
                    with open(self.memory_file, 'w') as f:
                        json.dump(memory, f)
                    print(f"[{self.name}] Saved progress.")

                # Polite delay
                time.sleep(1)
                
            except Exception as e:
                print(f"[{self.name}] Failed to process {filename}: {e}")
        
        # Save to disk
        with open(self.memory_file, 'w') as f:
            json.dump(memory, f)
        print(f"[{self.name}] Memory built. {len(memory)} items stored.")

    def load_memory(self) -> List[Dict]:
        """Loads memory from disk."""
        if not os.path.exists(self.memory_file):
            print(f"[{self.name}] No memory found. Building now...")
            self.build_memory()
            
        with open(self.memory_file, 'r') as f:
            return json.load(f)

    def retrieve(self, query: str, top_k: int = 3) -> List[Dict]:
        """
        Retrieves the most relevant posts for a given query using cosine similarity.
        """
        memory = self.load_memory()
        if not memory:
            return []
            
        # Embed the query - skip remote if node is offline (uses cached status)
        node_url = config.STUDIO_NODE_URL
        query_embedding = None
        
        # Only try remote if node is actually online (fast cached check)
        if node_url and self.data_center.is_node_online("studio_node"):
            import requests
            try:
                response = requests.post(
                    f"{node_url}/api/embeddings",
                    json={"model": "nomic-embed-text", "prompt": query},
                    timeout=5  # Shorter timeout since we know node is up
                )
                response.raise_for_status()
                query_embedding = response.json().get("embedding")
            except Exception as e:
                print(f"[{self.name}] Remote embedding failed: {e}. Falling back to Gemini.")
        
        # Fallback to Gemini if no embedding yet
        if query_embedding is None:
            query_embedding = genai.embed_content(
                model=self.embedding_model,
                content=query,
                task_type="retrieval_query"
            )['embedding']
        
        # Calculate similarities
        scored_items = []
        for item in memory:
            score = self._cosine_similarity(query_embedding, item['embedding'])
            scored_items.append((score, item))
            
        # Sort by score descending
        scored_items.sort(key=lambda x: x[0], reverse=True)
        
        # Return top k items
        return [item for score, item in scored_items[:top_k]]

    def _cosine_similarity(self, v1, v2):
        """Calculates cosine similarity between two vectors."""
        dot_product = np.dot(v1, v2)
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        return dot_product / (norm_v1 * norm_v2)

    @critique_action("Alchemist Generate Post")
    async def generate(self, topic: str, doctrine: str, provider: str = "auto", deep_mode: bool = False) -> tuple[str, str]:
        """
        Generates a blog post using the specified topic and context.
        Now includes persistent memory tracking and metrics.
        """
        start_time = time.time()
        success = False
        content = ""
        
        try:
            if provider == "auto":
                provider = self.select_best_provider()
                
            logger.info(f"[{self.name}] Researching topic: {topic} using {provider}...")
            
            # Log the generation request to memory
            self.memory_store.save_conversation(
                self.session_id, "user", f"Generate post about: {topic}", self.name
            )
            
            # Get learned insights to improve generation
            # 1. Retrieve Context (Max Capabilities = More Context)
            # Fetch more items if deep_mode to fill context window
            limit = 10 if deep_mode else 3
            context_items = self.retrieve(topic, top_k=limit) # Changed top_k to limit
            
            context_str = ""
            if context_items:
                context_str = "\n\nRELEVANT PAST POSTS (Deep Style Analysis):\n" if deep_mode else "\n\nRELEVANT PAST POSTS (Use these for style and continuity):\n"
                for item in context_items:
                    context_str += f"- Title: {item['title']}\n  Excerpt: {item['excerpt']}\n"
                    
            # 2. Construct Prompt
            # Load learned preferences
            # Original: insights = self.memory_store.get_insights("generation_preference", min_confidence=0.6)
            # Original: learned_preferences = ""
            # Original: if insights:
            # Original:     learned_preferences = "\n\nLEARNED PREFERENCES (from past feedback):\n"
            # Original:     for insight in insights[:3]:
            # Original:         learned_preferences += f"- {insight['data'].get('preference', '')}\n"
            
            # New learned preferences logic
            preferences = self.memory_store.get_insights("generation_preference", min_confidence=0.6) # Assuming memory_store has get_insights
            learned_preferences = ""
            if preferences:
                learned_preferences = "\nLEARNED PREFERENCES:\n" + "\n".join([f"- {p['data'].get('preference', '')}" for p in preferences[:3]]) # Adjusted to match original insight structure
            
            logger.info(f"[{self.name}] Researching topic: {topic} ({'Deep Mode' if deep_mode else 'Standard'})...")
            
            # Log the generation request to memory
            self.memory_store.save_conversation(
                self.session_id, "user", f"Generate post about: {topic}", self.name
            )
            
            if deep_mode:
                # Chain of Thought Prompt for Qwen 72B
                prompt = f"""
                You are The Alchemist. You are running on a Qwen 2.5 72B engine.
                Your goal is to write a MASTERPIECE blog post about: "{topic}"
                
                THE DOCTRINE:
                {doctrine}
                
                STYLE & MEMORY (Use this to match the voice perfectly):
                {context_str}
                {learned_preferences}
                
                INSTRUCTIONS (DEEP REASONING MODE):
                1.  **Analyze**: First, think about the topic deeply. What is the subtle, counter-intuitive truth here?
                2.  **Plan**: Outline 3 key emotional beats for the post.
                3.  **Draft**: Write the post. It must be "Gentle, Honest, Observational". 
                    - Avoid cliches. 
                    - Use short, punchy sentences mixed with lyrical flow.
                    - End with a question that feels like a hug.
                4.  **Refine**: Review your draft. Cut 10% of the words. Make it sharper.
                
                OUTPUT FORMAT:
                Return ONLY the final polished blog post. Do not show your reasoning steps in the final output, but use them to generate the best possible work.
                """
            else:
                # Standard Prompt
                prompt = f"""
                You are writing for "Does This Feel Right?", a blog dedicated to emotional honesty and clarity.
                
                THE DOCTRINE:
                {doctrine}
                
                CONTEXT FROM PAST POSTS:
                {context_str}
                {learned_preferences}
                
                TASK:
                Write a blog post about: {topic}
                
                GUIDELINES:
                - Tone: Calm, Warm, Reflective, Grounded, Observational.
                - Voice: Like a friend telling the truth gently. No moralizing. No "shoulds".
                - Structure: Title, Introduction, 3 Main Sections, Conclusion.
                - Format: Markdown.
                - Signature Question: End with the question "Does this feel true?"
                - Continuity: Subtly reference the themes from the past posts if relevant, to create a sense of a cohesive body of work.
                
                Write the post now.
                """
                
            logger.info(f"[{self.name}] Found {len(context_items)} relevant past posts.") # Moved this line here
            
            if provider == "huggingface":
                hf_token = self.get_secret("HF_TOKEN")
                if not hf_token:
                    raise ValueError("HF_TOKEN not found for Hugging Face provider.")
                
                client = InferenceClient(token=hf_token)
                model = "mistralai/Mistral-7B-Instruct-v0.2" 
                full_prompt = f"[INST] {prompt} [/INST]"
                
                try:
                    response = client.text_generation(full_prompt, model=model, max_new_tokens=1500)
                    content = response
                except Exception as e:
                    raise Exception(f"Hugging Face generation failed: {e}")

            elif provider == "remote":
                import requests
                node_url = config.STUDIO_NODE_URL
                if not node_url:
                    raise ValueError("STUDIO_NODE_URL not found.")
                
                logger.info(f"[{self.name}] Offloading task to Studio Node at {node_url}...")
                
                try:
                    # Auto-select model like FrontierResearcher
                    # Default to our new powerful model
                    model_to_use = "qwen-2.5-72b"
                    
                    # Fallback check if specific request fails vs generic availability
                    try:
                        tags_res = requests.get(f"{node_url}/api/tags", timeout=5)
                        if tags_res.status_code == 200:
                            models = tags_res.json().get("models", [])
                            # If Qwen is there, great. If not, find a decent fallback.
                            available_names = [m["name"] for m in models]
                            if model_to_use not in available_names:
                                # Try to find another qwen or mistral
                                gen_models = [m["name"] for m in models if "embed" not in m["name"] and "bert" not in m["name"]]
                                if gen_models:
                                    model_to_use = gen_models[0]
                                    logger.warning(f"[{self.name}] Qwen 72B not found in tags. Falling back to {model_to_use}")
                    except:
                        pass

                    payload = {
                        "model": model_to_use,
                        "messages": [
                            {"role": "system", "content": f"You are The Alchemist. {doctrine}"},
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False
                    }
                    # Use OpenAI compatible endpoint
                    # Ensure node_url doesn't end with slash
                    base_url = node_url.rstrip("/")
                    response = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=config.TIMEOUT_REMOTE)
                    response.raise_for_status()
                    
                    data = response.json()
                    # Parse OpenAI format
                    if "choices" in data and len(data["choices"]) > 0:
                        content = data["choices"][0]["message"]["content"]
                    else:
                        # Fallback for other formats
                        content = data.get("response") or data.get("content") or data.get("output") or data.get("text")
                    
                    if not content:
                        raise Exception(f"Empty response from node. Raw: {json.dumps(data)}")

                except Exception as e:
                    raise Exception(f"Remote generation failed: {e}")
                    
            elif provider == "openrouter":
                logger.info(f"[{self.name}] Calling OpenRouter...")
                model = self.select_openrouter_model(deep_mode=deep_mode)
                
                messages = [
                    {"role": "system", "content": f"You are The Alchemist. {doctrine}"},
                    {"role": "user", "content": prompt}
                ]
                
                response = self.openrouter.chat_completion(model, messages, temperature=0.7)
                content = self.openrouter.extract_text(response)
                
            else:  # Default to Gemini
                # Use the model initialized in __init__
                response = self.model.generate_content(prompt)
                content = response.text
            
            # Clean up markdown wrappers
            content = content.replace("```markdown", "").replace("```", "").strip()
            success = True
            
            # Log response to memory
            self.memory_store.save_conversation(
                self.session_id, "assistant", content[:500] + "...", self.name
            )
            
        except Exception as e:
            logger.error(f"[{self.name}] Generation failed: {e}")
            raise
        finally:
            # Track metrics regardless of success/failure
            duration = time.time() - start_time
            self.metrics.track_generation(success, provider, duration, topic)
            self.memory_store.log_generation(topic, provider, content, "", success, duration)
            self.memory_store.log_agent_action(
                self.name, "generate", {"topic": topic, "provider": provider},
                {"success": success, "length": len(content)}, success, duration
            )
            logger.info(f"[{self.name}] Generation completed in {duration:.2f}s (success={success})")
        
        return content, context_str
    
    def learn_from_feedback(self, content_id: str, rating: int, notes: str = None):
        """
        Learn from user feedback on generated content.
        Rating: 1-5 (1=poor, 5=excellent)
        """
        self.memory_store.save_feedback(content_id, "blog_post", rating, notes)
        
        # If rating is high, extract what made it good
        if rating >= 4 and notes:
            self.memory_store.save_insight(
                "generation_preference",
                {"preference": notes, "source_content": content_id},
                confidence=0.7,
                source="user_feedback"
            )
            logger.info(f"[{self.name}] Learned new preference from feedback: {notes}")
        
        # If rating is low, note what to avoid
        elif rating <= 2 and notes:
            self.memory_store.save_insight(
                "generation_avoidance",
                {"avoid": notes, "source_content": content_id},
                confidence=0.6,
                source="user_feedback"
            )
            logger.info(f"[{self.name}] Learned what to avoid from feedback: {notes}")
    
    def get_performance_summary(self) -> Dict:
        """
        Get a summary of the Alchemist's performance over time.
        """
        gen_stats = self.memory_store.get_generation_stats()
        feedback = self.memory_store.get_feedback_patterns("blog_post")
        
        return {
            "total_generations": gen_stats.get("total_generations", 0),
            "success_rate": gen_stats.get("success_rate", 0),
            "avg_duration": gen_stats.get("avg_duration_seconds", 0),
            "avg_rating": feedback.get("average_rating", 0),
            "total_feedback": feedback.get("total_feedback", 0),
            "by_provider": gen_stats.get("by_provider", {})
        }

if __name__ == "__main__":
    # Test the Alchemist
    alchemist = Alchemist()
    alchemist.build_memory() # Rebuild memory
    results = alchemist.retrieve("Artificial Intelligence")
    for res in results:
        print(f"Found: {res['title']}")