import json
import logging
import os
import re
from typing import Optional, List, Dict, Any

import google.generativeai as genai
import networkx as nx
from markdown_it import MarkdownIt

from admin.brain.memory_store import get_memory_store
from admin.config import config
from core.agent_interface import BaseAgent

logger = logging.getLogger("Librarian")


class Librarian(BaseAgent):
    """
    The Librarian (Data Scientist) - Upgraded with Markdown-aware chunking.
    """

    def __init__(self):
        self.graph = nx.Graph()
        self.memory = get_memory_store()
        self.notion = None

        # Initialize Gemini for Embeddings & Chat
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-1.5-flash")
            self.embedding_model = "models/text-embedding-004"

        # Optional Notion
        if config.NOTION_API_KEY:
            try:
                from notion_client import Client

                self.notion = Client(auth=config.NOTION_API_KEY)
            except Exception as e:
                logger.warning(f"Failed to initialize Notion client: {e}")

    @property
    def name(self) -> str:
        return "The Librarian"

    @property
    def role(self) -> str:
        return "Data Scientist"

    async def execute(self, action: str, **params) -> dict:
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
            question = params.get("question")
            entity = params.get("entity")
            if not question:
                raise ValueError("Question required")
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
            if not question:
                raise ValueError("Question required")
            return await self.query_code_with_codex(question)

        else:
            raise NotImplementedError(f"Action {action} not supported by Librarian.")

    async def index_local_content(self):
        """
        Ingests all local essays, chunks them by heading (markdown-it-py), and stores embeddings.
        """
        from admin.core import get_posts

        md = MarkdownIt()
        posts = get_posts()
        logger.info(f"Indexing {len(posts)} local posts with Markdown-aware chunking...")

        processed_chunks = 0
        for post in posts:
            slug = post.get("slug")
            content = post.get("content", "")
            title = post.get("title", "")

            # Parse markdown into sections
            tokens = md.parse(content)
            sections = []
            current_section = []
            current_header = title

            for token in tokens:
                if token.type == "heading_open":
                    if current_section:
                        sections.append((current_header, "\n".join(current_section)))
                        current_section = []

                if (
                    token.type == "inline"
                    and tokens[tokens.index(token) - 1].type == "heading_open"
                ):
                    current_header = token.content

                if (
                    token.content
                    and token.type == "inline"
                    and tokens[tokens.index(token) - 1].type != "heading_open"
                ):
                    current_section.append(token.content)

            if current_section:
                sections.append((current_header, "\n".join(current_section)))

            for i, (header, text) in enumerate(sections):
                if len(text.strip()) < 50:
                    continue

                context_chunk = f"Essay: {title}\nSection: {header}\n\n{text.strip()}"
                vector = await self._get_embedding(context_chunk)

                if vector:
                    self.memory.save_embedding(
                        doc_id=f"{slug}_{i}",
                        text=context_chunk,
                        vector=vector,
                        metadata={
                            "title": title,
                            "slug": slug,
                            "essay_id": slug.upper().replace("-", "_"),
                            "heading": header,
                            "chunk_index": i,
                            "type": "essay",
                        },
                    )
                    processed_chunks += 1

        return {
            "status": "success",
            "processed_posts": len(posts),
            "total_chunks": processed_chunks,
        }

    async def answer_question(self, question: str, entity: str = None):
        """
        RAG Pipeline: Search local vectors -> Construct Context -> Prompt Gemini
        """
        q_vector = await self._get_embedding(question)
        if not q_vector:
            logger.warning("Embedding failed, proceeding to fallback only.")
            results = []
        else:
            results = self.memory.search_vectors(q_vector, limit=5)

        if not results:
            logger.info(
                f"Vector search empty (Entity: {entity}). Attempting direct file fallback..."
            )
            try:
                from admin.core import get_posts

                posts = get_posts()
                relevant_content = []
                low_q = question.lower()
                low_entity = entity.lower() if entity else None

                for post in posts:
                    title = post.get("title", "").lower()
                    slug = post.get("slug", "").lower().replace("-", " ")
                    match_found = False

                    if low_entity:
                        if low_entity in slug or low_entity in title:
                            match_found = True

                    if not match_found:
                        if (title and title in low_q) or (slug and slug in low_q):
                            match_found = True

                    if match_found:
                        content_snippet = post.get("content", "")[:2000]
                        relevant_content.append(
                            {
                                "doc_id": post.get("slug"),
                                "text": content_snippet,
                                "metadata": {"source": post.get("slug")},
                                "score": 0.95,
                            }
                        )
                results = relevant_content
            except Exception as e:
                logger.error(f"Fallback search failed: {e}")

        if not results:
            return {
                "answer": "I couldn't find any relevant information in your internal documents."
            }

        context_str = "\n\n".join(
            [
                f"Source ({r['metadata'].get('source', r.get('doc_id'))}):\n{r['text']}"
                for r in results
            ]
        )

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
                "sources": [r["metadata"].get("source", r.get("doc_id")) for r in results],
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
                title="Embedding",
            )
            return result["embedding"]
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            return None

    async def query_code_with_codex(self, question: str):
        """
        Uses Codex CLI to reason about the codebase directly.
        """
        import subprocess

        logger.info(f"Librarian querying Codex about: {question}")

        try:
            api_key = os.environ.get("OPENAI_API_KEY")
            config_arg = f'api_key="{api_key}"' if api_key else ""
            cmd = ["codex"]
            if config_arg:
                cmd.extend(["-c", config_arg])
            cmd.extend(["--sandbox", "read-only", "exec", question])
            process = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return {"answer": process.stdout, "engine": "codex-cli"}
        except subprocess.CalledProcessError as e:
            logger.error(f"Codex code query failed: {e.stderr}")
            return {"error": f"Codex failed: {e.stderr}"}
        except Exception as e:
            logger.error(f"Error during Codex code query: {e}")
            return {"error": str(e)}

    def build_graph(self, posts: list):
        """Builds a knowledge graph from posts"""
        for post in posts:
            slug = post.get("slug")
            self.graph.add_node(slug, title=post.get("title"), type="post")
            for tag in post.get("tags", []):
                self.graph.add_node(tag, type="tag")
                self.graph.add_edge(slug, tag)
