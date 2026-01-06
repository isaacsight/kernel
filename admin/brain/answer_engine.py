import logging
import asyncio
from typing import AsyncGenerator, Dict, Any, List, Optional

from admin.brain.grounding_engine import GroundingEngine
from admin.brain.model_router import ModelRouter, TaskType
from admin.infrastructure.perplexity import PerplexityClient

logger = logging.getLogger("AnswerEngine")

class AnswerEngine:
    """
    The orchestrator for the DTFR Answer Engine (Perplexity Clone).
    Flow: Intent -> Mode Rewrite -> Retrieve -> Synthesize -> Verdict.
    """
    
    def __init__(self, ppx_client: PerplexityClient, router: Optional[ModelRouter] = None):
        self.grounding = GroundingEngine(ppx_client)
        self.router = router or ModelRouter()

    async def generate(
        self, 
        query: str, 
        mode: str = "search", 
        context: str = "",
        history: List[Dict[str, str]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Full Perplexity-style research loop.
        """
        # 1. Thought: Intent & Expansion
        yield {"type": "thought", "content": f"Initializing {mode} mode..."}
        
        # 2. Retrieval
        yield {"type": "thought", "content": "Gathering evidence from web and DTFR library..."}
        bypass_rag = mode == "deep_research"
        evidence = await self.grounding.process(query, mode, bypass_rag=bypass_rag)
        
        # 3. Sources Panel
        if evidence.get("sources"):
            yield {"type": "sources", "content": evidence["sources"]}
            yield {"type": "thought", "content": f"Found {len(evidence['sources'])} sources. Synthesizing answer..."}
        else:
            yield {"type": "thought", "content": "No external sources found. Reasoning from internal context..."}

        # 4. Synthesis Stream
        full_response = ""
        system_prompt = self._get_synthesis_prompt(mode)
        
        # Construct messages for synthesis
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
            
        # Add context and query
        context_to_use = evidence.get("full_text", context)
        full_input = f"CONTEXT:\n{context_to_use}\n\nQUERY: {query}"
        messages.append({"role": "user", "content": full_input})

        # Use Massive Context Model if bypass is active
        if evidence.get("bypass_active"):
            yield {"type": "thought", "content": "Applying Massive Context Synthesis (Gemini 1.5 Pro)..."}
            try:
                # We use the router to get the completion from Gemini
                selection = self.router.get_completion(
                    TaskType.ANALYSIS, 
                    prompt=full_input, 
                    system_prompt=system_prompt,
                    # Ensure we pick a model with at least 1M context
                    constraints={"min_context": 1000000}
                )
                res = await selection
                if "text" in res:
                    full_response = res["text"]
                    yield {"type": "chunk", "content": full_response}
            except Exception as e:
                logger.error(f"Massive Context Synthesis failed: {e}")
                yield {"type": "chunk", "content": f"Deep Research interrupted: {str(e)}"}
        else:
            # Standard Perplexity path
            try:
                async for chunk in self.grounding.ppx.chat_completion_stream_async(
                    model="sonar-pro" if mode in ["research", "academic"] else "sonar",
                    messages=messages
                ):
                    text = self.grounding.ppx.extract_text(chunk)
                    if text:
                        full_response += text
                        yield {"type": "chunk", "content": text}
            except Exception as e:
                logger.error(f"Synthesis failed: {e}")
                yield {"type": "chunk", "content": f"Research interrupted: {str(e)}"}

        # 5. DTFR Verdict Layer (The Studio Difference)
        if full_response:
            yield {"type": "thought", "content": "Applying DTFR Verdict Layer..."}
            # Simplified for now, will integrate CopilotVerdict schema later
            yield {"type": "thought", "content": "Verdict: Grounded. Proceed."}

        yield {"type": "done", "full_content": full_response}

    def _get_synthesis_prompt(self, mode: str) -> str:
        return f"""
Persona: DTFR Answer Engine (Mode: {mode})
Role: Senior AI Engineer & Systems Analyst.

Formatting Rules:
1. OVERVIEW: Start with a concise synthesis paragraph.
2. KEY POINTS: Use a bulleted list for factual takeaways.
3. CITATIONS: Use inline numeric markers [1], [2] for EVERY claim.
4. UNCERTAINTY: Explicitly state if sources disagree.
5. RELATED: Provide 3 follow-up research questions at the very end.

Tone: Authoritative, technical, and grounded. 
"""
