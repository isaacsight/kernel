import logging
import os
import json
import networkx as nx
from networkx.readwrite import json_graph
import google.generativeai as genai
from admin.config import config
from admin.brain.memory_store import get_memory_store

from core.agent_interface import BaseAgent
from typing import Dict

logger = logging.getLogger("Librarian")

class Librarian(BaseAgent):
    """
    The Librarian (Data Scientist)
    
    Mission: Organize knowledge for discoverability and interconnectedness.
    
    Responsibilities:
    - Knowledge Graphs
    - Taxonomy Generation
    - Content Analytics
    """

    def __init__(self):
        self.graph = nx.Graph()
        self.memory = get_memory_store()
        self.notion = None
        
        # Initialize Gemini for Embeddings & Chat
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            self.embedding_model = "models/text-embedding-004"
        
        # Optional Notion
        if config.NOTION_API_KEY:
            try:
                from notion_client import Client
                self.notion = Client(auth=config.NOTION_API_KEY)
            except:
                pass

    @property
    def name(self) -> str:
        return "The Librarian"

    @property
    def role(self) -> str:
        return "Data Scientist"

    async def execute(self, action: str, **params) -> Dict:
        if action == "rebuild_graph":
             from admin.core import get_posts
             posts = params.get("posts") or get_posts()
             self.build_graph(posts)
             return {"message": "Knowledge Graph updated", "nodes": self.graph.number_of_nodes()}
        
        elif action == "index_content":
            return await self.index_local_content()
            
        elif action == "process_pending":
            return await self.process_pending_intake()
            
        elif action == "query_knowledge":
            # ... (rest stays same)
            question = params.get("question")
            entity = params.get("entity")
            if not question: raise ValueError("Question required")
            return await self.answer_question(question, entity)
            
        elif action == "list_notion_pages":
            return await self.list_pages()
        elif action == "create_notion_page":
            title = params.get("title")
            content = params.get("content")
            if not title or not content:
                raise ValueError("Title and content are required for create_notion_page")
            return await self.create_page(title, content)
            
        elif action == "query_code_reasoning":
            question = params.get("question")
            if not question: raise ValueError("Question required")
            return await self.query_code_with_codex(question)
            
        else:
             raise NotImplementedError(f"Action {action} not supported by Librarian.")

    # ... (skipping methods) ...

    async def answer_question(self, question: str, entity: str = None):
        """
        RAG Pipeline: Search local vectors -> Construct Context -> Prompt Gemini
        """
        # 1. Search
        q_vector = await self._get_embedding(question)
        if not q_vector:
            # Fallback embedding failure logic?
            # Just continue to file fallback if embedding fails?
            # For now, let's keep error but maybe log it.
            # actually let's allow fallback even if embedding fails
            logger.warning("Embedding failed, proceeding to fallback only.")
            results = []
        else:
            results = self.memory.search_vectors(q_vector, limit=5)
        
        if not results:
            logger.info(f"Vector search empty (Entity: {entity}). Attempting direct file fallback...")
            # Fallback: Direct File Lookup (Heuristic)
            try:
                from admin.core import get_posts
                posts = get_posts()
                
                relevant_content = []
                low_q = question.lower()
                low_entity = entity.lower() if entity else None
                
                for post in posts:
                    # Check if post title or slug matches entity OR question
                    title = post.get('title', '').lower()
                    slug = post.get('slug', '').lower().replace('-', ' ')
                    
                    match_found = False
                    
                    # 1. Check strict entity match (High Confidence)
                    if low_entity:
                        if low_entity in slug or low_entity in title:
                            match_found = True
                    
                    # 2. Check question containment (Lower Confidence)
                    if not match_found:
                         if (title and title in low_q) or (slug and slug in low_q):
                             match_found = True
                    
                    if match_found:
                        content_snippet = post.get('content', '')[:2000] # Take first 2k chars
                        relevant_content.append({
                            "doc_id": post.get('slug'),
                            "text": content_snippet,
                            "metadata": {"source": post.get('slug')},
                            "score": 0.95
                        })
                
                results = relevant_content
            except Exception as e:
                logger.error(f"Fallback search failed: {e}")

        if not results:
            return {"answer": "I couldn't find any relevant information in your internal documents."}
            
        # 2. Construct Context
        context_str = "\n\n".join([
            f"Source ({r['metadata'].get('source')}):\n{r['text']}" 
            for r in results
        ])
        
        # 3. Prompt
        prompt = f"""
        You are the Librarian, the keeper of this system's knowledge.
        Answer the user's question using ONLY the context provided below.
        If the answer is not in the context, say you don't know interactively (don't make things up).
        
        CONTEXT:
        {context_str}
        
        QUESTION: {question}
        
        ANSWER:
        """
        
        try:
            response = self.model.generate_content(prompt)
            return {
                "answer": response.text,
                "sources": [r['metadata'].get('source') for r in results]
            }
        except Exception as e:
            return {"error": f"LLM generation failed: {e}"}

    async def _get_embedding(self, text: str):
        """Helper to get embedding from Gemini"""
        try:
            result = genai.embed_content(
                model=self.embedding_model,
                content=text,
                task_type="retrieval_document",
                title="Embedding"
            )
            return result['embedding']
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            return None

    async def query_code_with_codex(self, question: str):
        """
        Uses Codex CLI to reason about the codebase directly.
        This provides deeper insights than standard RAG for complex architectural questions.
        """
        import subprocess
        logger.info(f"Librarian querying Codex about: {question}")
        
        try:
            # Use read-only mode for safety and pass API key explicitly
            api_key = os.environ.get("OPENAI_API_KEY")
            config_arg = f"api_key=\"{api_key}\"" if api_key else ""
            
            cmd = ["codex"]
            if config_arg:
                cmd.extend(["-c", config_arg])
            cmd.extend(["--sandbox", "read-only", "exec", question])
            
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            return {
                "answer": process.stdout,
                "engine": "codex-cli"
            }
        except subprocess.CalledProcessError as e:
            logger.error(f"Codex code query failed: {e.stderr}")
            return {"error": f"Codex failed: {e.stderr}"}
        except Exception as e:
            logger.error(f"Error during Codex code query: {e}")
            return {"error": str(e)}