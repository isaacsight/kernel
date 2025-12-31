import json
import logging
import os
from collections.abc import AsyncGenerator
from typing import Any, Optional

import google.generativeai as genai

from admin.brain.agent_base import BaseAgent
from admin.brain.agents.copilot.schemas import (
    CopilotResponse,
    CopilotVerdict,
    EngineConfig,
    EssaySuggestion,
)
from admin.brain.model_router import TaskType, get_model_router
from admin.config import config
from admin.engineers.librarian import Librarian
from admin.infrastructure.perplexity import PerplexityClient

from dtfr.answer_engine import AnswerEngine
from dtfr.router_adapter import RouterAdapter
from dtfr.search.providers.perplexity_provider import PerplexityProvider
from dtfr.search.providers.brave_provider import BraveProvider

logger = logging.getLogger("Copilot")


class Copilot(BaseAgent):
    """
    DTFR Copilot Agent - Hardened with Pydantic & Deterministic Scoring.
    """

    def __init__(self):
        super().__init__(agent_id="copilot")

        self.librarian = Librarian()
        self._configure_gemini()

        # Perplexity Initialization
        ppx_key = self.get_secret("PERPLEXITY_API_KEY")
        self.ppx_client = PerplexityClient(ppx_key) if ppx_key else None

        # Answer Engine for research flows
        router = get_model_router()
        adapter = RouterAdapter(router, self.ppx_client)

        providers = []
        if self.ppx_client:
            providers.append(PerplexityProvider(self.ppx_client))

        brave_key = self.get_secret("BRAVE_API_KEY")
        if brave_key:
            providers.append(BraveProvider(brave_key))

        self.answer_engine = AnswerEngine(adapter, providers)

        # Load and validate the Question Engine spec with Pydantic
        engine_path = os.path.join(config.BASE_DIR, "admin", "prompts", "dtfr_question_engine.json")
        try:
            with open(engine_path) as f:
                raw_engine = json.load(f)
                self.engine_config = EngineConfig(**raw_engine)
        except Exception as e:
            logger.error(f"Failed to load or validate DTFR Question Engine: {e}")
            raise RuntimeError(f"Critical Engine Failure: {e}")

    def _configure_gemini(self):
        api_key = self.get_secret("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found")
            self.model = None
            return

        genai.configure(api_key=api_key)
        model_name = getattr(config, "GEMINI_MODEL", "gemini-1.5-pro")

        # Hardened for determinism
        generation_config = {
            "temperature": 0,
            "top_p": 0.1,
            "top_k": 1,
            "max_output_tokens": 2048,
        }

        self.model = genai.GenerativeModel(
            model_name=model_name, generation_config=generation_config
        )

    async def get_engine_state(self, conversation_history: list[dict]) -> dict:
        """
        Uses an LLM to extract slots and determine the current state of the evaluation.
        """
        if not self.model:
            return {"slots": {}, "suggested_mode": "read"}

        schema = json.dumps({k: v.dict() for k, v in self.engine_config.slots_schema.items()})
        history_text = "\n".join(
            [
                f"{m.get('role', 'user')}: {m.get('parts', [{}])[0].get('text', '')}"
                if isinstance(m.get("parts"), list)
                else f"{m.get('role', 'user')}: {m.get('text', '')}"
                for m in conversation_history[-5:]
            ]
        )

        prompt = f"""
You are the DTFR Slot Extractor. Grounded in Isaac Hernandez's judgment framework, extract the current state of these slots from the conversation:
{schema}

Focus on understanding the intent, context, and specific risks mentioned.
For enum fields, select the most appropriate value.

Conversation:
{history_text}

Output ONLY a JSON object of filled slots. If a slot value is unknown, UNSET it (omit from JSON).
"""
        try:
            response = await self.model.generate_content_async(prompt)
            text = response.text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end != -1:
                return {"slots": json.loads(text[start:end])}
        except Exception as e:
            logger.error(f"Slot extraction failed: {e}")

        return {"slots": {}}

    def calculate_question_score(
        self, question: Any, slots: dict, tags: set[str]
    ) -> tuple[float, bool]:
        """
        Pure deterministic scoring function: base + slot_bonus + (0.10 if trigger_match).
        """
        score = question.scoring.base
        trigger_hit = False

        # 1. Trigger Check (Any-match)
        q_any = [t.lower() for t in question.triggers.any]
        if q_any:
            if any(t in tags for t in q_any):
                score += question.scoring.trigger_bonus or 0.10
                trigger_hit = True

        # 2. Slot Bonuses
        bonuses = question.scoring.slot_bonus
        for target in question.slot_targets:
            val = slots.get(target)
            is_missing = val is None or val == "" or (isinstance(val, list) and not val)
            if is_missing:
                score += bonuses.get(target, 0.15)

        return score, trigger_hit

    def select_questions(self, slots: dict, context_tags: list[str] = None) -> list[dict]:
        """
        Selects questions based on hardened scoring logic.
        """
        candidates = []
        tags = set(t.lower() for t in (context_tags or []))

        for q in self.engine_config.question_bank:
            # Skip if missing_slots trigger is defined but NOT met
            ms_triggers = q.triggers.missing_slots
            if ms_triggers:
                if not any(slots.get(s) in [None, "", []] for s in ms_triggers):
                    continue

            score, trigger_hit = self.calculate_question_score(q, slots, tags)

            candidates.append(
                {
                    "id": q.id,
                    "text": q.text,
                    "score": score,
                    "reason": "Trigger match" if trigger_hit else "Strategic priority",
                }
            )

        candidates.sort(key=lambda x: x["score"], reverse=True)
        limit = self.engine_config.routing.default_question_count
        return candidates[:limit]

    async def map_essays(self, query: str) -> list[EssaySuggestion]:
        """
        Hybrid Mapping Pipeline (0.45 Rules / 0.55 Embeddings).
        """
        low_query = query.lower()
        rule_scores: dict[str, dict[str, Any]] = {}

        # 1. Rules-based
        for rule in self.engine_config.mapping_rules:
            hits = [t for t in rule.terms_any if t.lower() in low_query]
            if not hits:
                continue

            for eid in rule.essay_ids:
                prev = rule_scores.get(eid, {"score": 0, "why": []})
                new_score = prev["score"] + rule.boost
                prev["score"] = min(1.0, new_score)
                prev["why"].append(f"{rule.rule_id}: {', '.join(hits)}")
                rule_scores[eid] = prev

        # 2. Embeddings
        embed_agg: dict[str, dict[str, Any]] = {}
        try:
            vector = await self.librarian._get_embedding(query)
            if vector:
                hits = self.librarian.memory.search_vectors(vector, limit=8)
                for h in hits:
                    eid = h["metadata"].get("essay_id") or h["metadata"].get(
                        "slug", ""
                    ).upper().replace("-", "_")
                    if not eid:
                        continue

                    prev = embed_agg.get(eid, {"score": 0, "top": []})
                    next_s = min(1.0, prev["score"] + h["score"] * 0.25)
                    prev["score"] = next_s
                    prev["top"].append(h)
                    embed_agg[eid] = prev
        except Exception as e:
            logger.error(f"Embedding mapping failed: {e}")

        # 3. Ensemble
        final_suggestions = []
        essay_ids = set(rule_scores.keys()) | set(embed_agg.keys())
        essay_index = {e.essay_id: e for e in self.engine_config.essay_index}

        for eid in essay_ids:
            rs = rule_scores.get(eid, {"score": 0, "why": []})
            es = embed_agg.get(eid, {"score": 0, "top": []})

            final_score = (0.55 * es["score"]) + (0.45 * rs["score"])

            why_parts = []
            if rs["score"] > 0:
                why_parts.append(f"Rules={rs['score']:.2f} ({' | '.join(rs['why'])})")
            if es["score"] > 0:
                top_str = ", ".join(
                    [f"{h['text'][:20]}... ({h['score']:.2f})" for h in es["top"][:1]]
                )
                why_parts.append(f"Embeds={es['score']:.2f} (top: {top_str})")

            essay_meta = essay_index.get(eid)
            if essay_meta:
                final_suggestions.append(
                    EssaySuggestion(
                        essay_id=eid,
                        title=essay_meta.title,
                        url=essay_meta.url,
                        why=" | ".join(why_parts),
                        score=final_score,
                    )
                )

        final_suggestions.sort(key=lambda x: x.score, reverse=True)
        return final_suggestions[:3]

    async def generate_verdict(
        self, slots: dict, conversation_history: list[dict], sources: list[str]
    ) -> Optional[CopilotVerdict]:
        """
        Generates a structured DTFR verdict based on diagnostic state.
        Uses Perplexity if available for grounded reasoning.
        """
        history_text = "\n".join(
            [
                f"{m.get('role')}: {m.get('parts', [{}])[0].get('text', '')}"
                if isinstance(m.get("parts"), list)
                else f"{m.get('role')}: {m.get('text', '')}"
                for m in conversation_history[-10:]
            ]
        )

        prompt = f"""
You are the Senior DTFR Reviewer. Based on the following diagnostic state and conversation, provide a formal DTFR Verdict.

DIAGNOSTIC STATE (Slots):
{json.dumps(slots, indent=2)}

RELEVANT ESSAYS:
{", ".join(sources)}

CONVERSATION HISTORY:
{history_text}

Output ONLY a JSON object matching this schema:
{{
  "mirror": "Studio Mirror reflection of user intent",
  "risks": ["risk 1", "risk 2"],
  "tradeoffs": ["tradeoff 1"],
  "unknowns": ["unknown 1"],
  "verdict": "proceed" | "pivot" | "pause",
  "citations": ["essay_id_1", "essay_id_2"]
}}
"""
        try:
            # Prefer Perplexity for grounded verdict if available
            if self.ppx_client:
                response = self.ppx_client.chat_completion(
                    model="sonar-pro", messages=[{"role": "user", "content": prompt}]
                )
                text = self.ppx_client.extract_text(response)
            elif self.model:
                response = await self.model.generate_content_async(prompt)
                text = response.text
            else:
                return None

            # Standard JSON extraction
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end != -1:
                return CopilotVerdict(**json.loads(text[start:end]))
        except Exception as e:
            logger.error(f"Verdict generation failed: {e}")
        return None

    async def evaluate(
        self,
        user_input: str,
        conversation_history: Optional[list[dict]] = None,
        mode: str = "search",
        page_context: Optional[str] = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Research-first evaluation loop delegating to dtfr.AnswerEngine.
        """
        # Context Ingestion
        context_data = await self.librarian.answer_question(user_input)
        combined_context = f"{context_data.get('answer', '')}\n\nPAGE CONTEXT:\n{page_context if page_context else ''}"

        # Delegate to Answer Engine
        async for state in self.answer_engine.generate(
            query=user_input, mode=mode, history=conversation_history
        ):
            yield state

    def check_stop_conditions(self, slots: dict, user_input: str, history_len: int) -> bool:
        """
        Stop conditions: explicit logic + turn_count safeguard.
        """
        conditions = self.engine_config.routing.stop_conditions
        turn_count = (history_len // 2) + 1

        for condition in conditions:
            if "slots.intent.filled && slots.context.filled" in condition:
                if slots.get("intent") and slots.get("context"):
                    return True
            if condition == "user_requests_verdict":
                low_input = user_input.lower()
                if any(
                    phrase in low_input
                    for phrase in ["verdict", "decision", "does it feel right", "judge"]
                ):
                    return True
            if "turn_count >=" in condition:
                try:
                    limit = int(condition.split(">=")[1].strip())
                    if turn_count >= limit:
                        return True
                except (ValueError, IndexError):
                    pass

        return False

    async def execute(self, action: str, **params) -> dict:
        """
        Main entry point. Enforces CopilotResponse Pydantic schema on output.
        """
        user_input = params.get("user_input", "")
        history = params.get("history", [])

        if action == "query":
            # 1. State extraction
            state = await self.get_engine_state(
                history + [{"role": "user", "parts": [{"text": user_input}]}]
            )
            slots = state.get("slots", {})

            # 2. Check stop conditions
            is_ready = self.check_stop_conditions(slots, user_input, len(history))

            # 3. Select Questions (Deterministic)
            questions = self.select_questions(slots, context_tags=[user_input.lower()])

            # 4. Map Essays (Hybrid)
            suggestions = await self.map_essays(user_input)

            # 5. Generate Verdict if ready
            verdict_data = None
            if is_ready:
                sources = [s.essay_id for s in suggestions]
                verdict = await self.generate_verdict(slots, history, sources)
                if verdict:
                    verdict_data = verdict.dict()

            # Validate output schema
            response_obj = {
                "success": True,
                "slots": slots,
                "is_verdict_ready": is_ready,
                "selected_questions": questions if not is_ready else [],
                "essay_suggestions": [s.dict() for s in suggestions],
                "raw_input": user_input,
            }
            if verdict_data:
                response_obj["verdict"] = verdict_data

            return response_obj

        exec_res = await super().execute(action, **params)
        return (
            exec_res
            if isinstance(exec_res, dict)
            else {"success": False, "error": "Internal error"}
        )
