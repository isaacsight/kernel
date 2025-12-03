import os
import json
import frontmatter
import numpy as np
import google.generativeai as genai
from huggingface_hub import InferenceClient
from typing import List, Dict, Optional

class Alchemist:
    """
    The Alchemist (Machine Learning Engineer)
    
    Mission: Imbue the system with memory, context, and a "soul".
    
    Responsibilities:
    - RAG (Retrieval-Augmented Generation)
    - Model Routing (Claude vs Gemini vs Llama)
    - Fine-tuning and Persona Management
    """
    def __init__(self):
        self.name = "The Alchemist"
        self.role = "Machine Learning Engineer"
        self.brain_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../brain'))
        self.memory_file = os.path.join(self.brain_dir, 'memory.json')
        self.content_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../content'))
        
        # Ensure brain directory exists
        os.makedirs(self.brain_dir, exist_ok=True)
        
        # Configure Gemini
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables.")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-flash-latest')
        self.embedding_model = 'models/text-embedding-004'
        self.chat_session = None

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
            return f"Error in chat: {e}"

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
                retries = 3
                for attempt in range(retries):
                    try:
                        # Check for Studio Node offloading
                        node_url = os.environ.get("STUDIO_NODE_URL")
                        if node_url:
                            import requests
                            response = requests.post(
                                f"{node_url}/embeddings",
                                json={"model": "nomic-embed-text", "prompt": text_to_embed},
                                timeout=10
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
            
        # Embed the query
        node_url = os.environ.get("STUDIO_NODE_URL")
        if node_url:
            import requests
            try:
                response = requests.post(
                    f"{node_url}/embeddings",
                    json={"model": "nomic-embed-text", "prompt": query},
                    timeout=10
                )
                response.raise_for_status()
                query_embedding = response.json().get("embedding")
            except Exception as e:
                print(f"[{self.name}] Remote embedding failed: {e}. Falling back to Gemini.")
                query_embedding = genai.embed_content(
                    model=self.embedding_model,
                    content=query,
                    task_type="retrieval_query"
                )['embedding']
        else:
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

    def generate(self, topic: str, doctrine: str, provider: str = "gemini") -> str:
        """
        Generates a blog post using the specified topic and context.
        """
        print(f"[{self.name}] Researching topic: {topic} using {provider}...")
        context_items = self.retrieve(topic)
        
        context_str = ""
        if context_items:
            context_str = "\n\nRELEVANT PAST POSTS (Use these for style and continuity):\n"
            for item in context_items:
                context_str += f"- Title: {item['title']}\n  Excerpt: {item['excerpt']}\n"
        
        print(f"[{self.name}] Found {len(context_items)} relevant past posts.")
        
        prompt = f"""
        You are writing for "Does This Feel Right?", a blog dedicated to emotional honesty and clarity.
        
        THE DOCTRINE:
        {doctrine}
        
        CONTEXT FROM PAST POSTS:
        {context_str}
        
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
        
        if provider == "huggingface":
            hf_token = os.environ.get("HF_TOKEN")
            if not hf_token:
                raise ValueError("HF_TOKEN not found for Hugging Face provider.")
            
            client = InferenceClient(token=hf_token)
            # Use a good instruct model
            model = "mistralai/Mistral-7B-Instruct-v0.2" 
            
            # Wrap in INST tags for Mistral
            full_prompt = f"[INST] {prompt} [/INST]"
            
            try:
                response = client.text_generation(full_prompt, model=model, max_new_tokens=1500)
                content = response
            except Exception as e:
                raise Exception(f"Hugging Face generation failed: {e}")

        elif provider == "remote":
            import requests
            node_url = os.environ.get("STUDIO_NODE_URL")
            if not node_url:
                raise ValueError("STUDIO_NODE_URL not found. Please set it to the address of your Windows machine (e.g., http://192.168.1.x:8000).")
            
            print(f"[{self.name}] Offloading task to Studio Node at {node_url}...")
            
            try:
                payload = {
                    "prompt": prompt,
                    "model": "mistral", # Default to mistral on the node
                    "system_prompt": f"You are The Alchemist. {doctrine}"
                }
                response = requests.post(f"{node_url}/generate", json=payload, timeout=120) # Long timeout for generation
                response.raise_for_status()
                content = response.json().get("response", "")
            except Exception as e:
                raise Exception(f"Remote generation failed: {e}")
                
        else: # Default to Gemini
            response = self.model.generate_content(prompt)
            content = response.text
        
        # Clean up markdown wrappers
        content = content.replace("```markdown", "").replace("```", "").strip()
        
        return content

if __name__ == "__main__":
    # Test the Alchemist
    alchemist = Alchemist()
    alchemist.build_memory() # Rebuild memory
    results = alchemist.retrieve("Artificial Intelligence")
    for res in results:
        print(f"Found: {res['title']}")