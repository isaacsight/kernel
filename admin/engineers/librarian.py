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
            if not question: raise ValueError("Question required")
            return await self.answer_question(question)
            
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

    async def process_pending_intake(self):
        """
        Subscription-based reaction to new work entering the system.
        """
        from admin.brain.intake import get_intake_manager
        intake = get_intake_manager()
        
        pending = intake.get_subscriptions("librarian")
        if not pending:
            return {"message": "No pending intake for the Librarian."}
            
        results = []
        for work in pending:
            try:
                res = await self._index_intake(work)
                intake.update_subscription_status(work['sub_id'], "completed", res)
                results.append(res)
            except Exception as e:
                logger.error(f"Librarian failed to process intake {work['id']}: {e}")
                intake.update_subscription_status(work['sub_id'], "failed", {"error": str(e)})
                
        return {"processed": len(results), "details": results}

    async def _index_intake(self, work: Dict):
        """
        Specific logic for indexing a single intake item.
        """
        logger.info(f"Librarian indexing intake {work['id']} ({work['source_type']})")
        
        # 1. Fetch chunks for this intake
        import sqlite3
        conn = sqlite3.connect(self.memory.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, text_chunk FROM vector_store WHERE doc_id LIKE ?", (f"intake:{work['id']}:%",))
        chunks = cursor.fetchall()
        
        indexed = 0
        for chunk in chunks:
            vector = await self._get_embedding(chunk['text_chunk'])
            if vector:
                cursor.execute(
                    "UPDATE vector_store SET vector = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?",
                    (json.dumps(vector), chunk['id'])
                )
                indexed += 1
                
        # 2. Update Knowledge Graph (simple node addition)
        metadata = work.get('metadata')
        if not metadata: metadata = {}
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except:
                metadata = {}
        
        if not isinstance(metadata, dict):
            metadata = {}
                
        title = metadata.get('title') or f"Intake {work['id']}"
        logger.info(f"Librarian adding graph node for {title}")
        self.graph.add_node(f"intake:{work['id']}", type='document', label=title, source=work['source_type'])
        
        conn.commit()
        conn.close()
        
        return {"id": work['id'], "chunks_indexed": indexed, "graph_node_added": True}

    def build_graph(self, posts_metadata):
        """
        Constructs a knowledge graph from a list of post metadata.
        Nodes: Posts, Tags, Categories
        Edges: Post -> Tag, Post -> Category
        """
        logger.info(f"Building Knowledge Graph from {len(posts_metadata)} posts...")
        self.graph.clear()
        
        for post in posts_metadata:
            slug = post.get('slug')
            title = post.get('title', 'Untitled')
            category = post.get('category', 'General')
            tags = post.get('tags', [])
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(',') if t.strip()]
            elif not isinstance(tags, list):
                tags = []
            
            # Add Post Node
            self.graph.add_node(slug, type='post', title=title, label=title)
            
            # Add Category Node & Edge
            cat_id = f"cat:{category}"
            self.graph.add_node(cat_id, type='category', label=category)
            self.graph.add_edge(slug, cat_id)
            
            # Add Tag Nodes & Edges
            for tag in tags:
                tag = tag.strip()
                if not tag: continue
                tag_id = f"tag:{tag}"
                self.graph.add_node(tag_id, type='tag', label=tag)
                self.graph.add_edge(slug, tag_id)
                
        logger.info(f"Graph built: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges.")

    def export_graph(self, output_path):
        """
        Exports the graph to a JSON file compatible with D3.js or similar.
        """
        data = json_graph.node_link_data(self.graph)
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info(f"Knowledge Graph exported to {output_path}")

    async def list_pages(self):
        """
        Lists pages from the Notion workspace (or specific database if configured).
        """
        if not self.notion:
            return {"error": "Notion client not initialized"}
        
        try:
            # If a database ID is configured, query it. Otherwise search.
            if config.NOTION_DATABASE_ID:
                response = self.notion.databases.query(database_id=config.NOTION_DATABASE_ID)
            else:
                response = self.notion.search(filter={"value": "page", "property": "object"})
                
            results = []
            for page in response.get("results", []):
                title = "Untitled"
                # Try to extract title safely
                props = page.get("properties", {})
                for key, val in props.items():
                   if val.get("type") == "title":
                       title_obj = val.get("title", [])
                       if title_obj:
                           title = title_obj[0].get("plain_text", "Untitled")
                       break
                
                results.append({
                    "id": page["id"],
                    "url": page["url"],
                    "title": title
                })
            
            return {"count": len(results), "pages": results}

        except Exception as e:
            logger.error(f"Error listing Notion pages: {e}")
            return {"error": str(e)}

    async def create_page(self, title: str, content: str):
        """
        Creates a new page in the configured database or as a top-level page.
        """
        if not self.notion:
            return {"error": "Notion client not initialized"}
        
        if not config.NOTION_DATABASE_ID:
             return {"error": "NOTION_DATABASE_ID key is required to create pages programmatically (parent must be defined)."}

        try:
            new_page = self.notion.pages.create(
                parent={"database_id": config.NOTION_DATABASE_ID},
                properties={
                    "Name": {"title": [{"text": {"content": title}}]},
                },
                children=[
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": content}}]
                        }
                    }
                ]
            )
            return {"message": "Page created", "id": new_page["id"], "url": new_page["url"]}
        except Exception as e:
            return {"error": str(e)}

    # ==================== Local Knowledge Engine ====================

    async def index_local_content(self):
        """
        Scans content/ and docs/ directories, chunks files, and saves embeddings.
        """
        search_dirs = [config.CONTENT_DIR, config.DOCS_DIR]
        indexed_count = 0
        
        for directory in search_dirs:
            if not os.path.exists(directory): continue
            
            for root, _, files in os.walk(directory):
                for file in files:
                    if file.endswith(".md") or file.endswith(".txt"):
                        path = os.path.join(root, file)
                        try:
                            with open(path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            # Simple chunking by paragraph (split by double newline)
                            chunks = [c.strip() for c in content.split('\n\n') if c.strip()]
                            
                            for i, chunk in enumerate(chunks):
                                # Skip very short chunks
                                if len(chunk) < 50: continue
                                
                                # Generate embedding
                                doc_id = f"{file}:{i}"
                                vector = await self._get_embedding(chunk)
                                
                                if vector:
                                    self.memory.save_embedding(
                                        doc_id=doc_id,
                                        text=chunk,
                                        vector=vector,
                                        metadata={"source": file, "path": path}
                                    )
                                    indexed_count += 1
                                    
                        except Exception as e:
                            logger.error(f"Failed to index {file}: {e}")
                            
        return {"message": f"Successfully indexed {indexed_count} chunks."}

    async def answer_question(self, question: str):
        """
        RAG Pipeline: Search local vectors -> Construct Context -> Prompt Gemini
        """
        # 1. Search
        q_vector = await self._get_embedding(question)
        if not q_vector:
            return {"error": "Failed to embed question"}
            
        results = self.memory.search_vectors(q_vector, limit=5)
        
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