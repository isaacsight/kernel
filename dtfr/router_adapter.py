from typing import Optional, AsyncGenerator
from admin.brain.model_router import TaskType
import google.generativeai as genai
from admin.config import config
import logging

logger = logging.getLogger("RouterAdapter")


class RouterAdapter:
    """
    Wraps the DTFR ModelRouter to provide a standardized interface for AnswerEngine.
    """

    def __init__(self, model_router, ppx_client=None):
        self.router = model_router
        self.ppx_client = ppx_client

    def pick(self, task: str, mode: str) -> str:
        """
        Maps AnswerEngine tasks to ModelRouter TaskTypes and ensures availability.
        """
        task_map = {
            "synthesis": TaskType.CREATIVE_WRITING,
            "verify": TaskType.ANALYSIS,
            "rewrite": TaskType.FAST_SIMPLE,
        }
        task_type = task_map.get(task, TaskType.ANALYSIS)

        # Provider Locks (Config Driven)
        if task == "synthesis" and config.DTFR_SYNTHESIS_PROVIDER == "perplexity":
            return config.DTFR_SYNTHESIS_MODEL

        if (task == "verify" or task == "rewrite") and config.DTFR_VERIFY_PROVIDER == "perplexity":
            return config.DTFR_VERIFY_MODEL

        # Priority: Use Perplexity (Sonar) if available for research tasks (Legacy fallback)
        if self.ppx_client:
            if task == "synthesis":
                return "sonar-pro"
            elif task == "verify":
                return "sonar"
            elif task == "rewrite":
                return "sonar"

        # Select model via router (this will be used if ppx_client is not available or task not prioritized for Sonar)
        result = self.router.select_model(task_type)
        model = result.get("selected", "gemini-1.5-flash")

        # Fallback to Gemini if Sonar not explicitly selected or available
        # Safety: Map non-Sonar models to working Gemini aliases found in list_models
        # Based on env check: gemini-flash-latest, gemini-pro-latest are available.
        if "sonar" not in model.lower():
            if task == "synthesis" or task == "verify":
                return "gemini-flash-latest"  # Changed from pro to flash to avoid 429s
            return "gemini-flash-latest"

        return model

    async def complete_async(
        self,
        model: str,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        Executes an async completion with model normalization.
        """
        effective_model = model.replace("models/", "")

        if "sonar" in effective_model.lower() and self.ppx_client:
            try:
                resp = await self.ppx_client.chat_completion_async(
                    model=effective_model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    temperature=temperature,
                )
                return self.ppx_client.extract_text(resp)
            except Exception as e:
                logger.error(f"Perplexity async complete failed: {e}")

        # Fallback to Gemini
        try:
            m = genai.GenerativeModel(model_name=effective_model, system_instruction=system)
            resp = await m.generate_content_async(
                user,
                generation_config={"temperature": temperature, "max_output_tokens": max_tokens},
            )
            return resp.text
        except Exception as e:
            return f"Completion failed for {effective_model}: {e}"

    async def complete_stream_async(
        self,
        model: str,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Streams completion chunks with model normalization.
        """
        effective_model = model.replace("models/", "")

        if "sonar" in effective_model.lower() and self.ppx_client:
            try:
                async for chunk in self.ppx_client.chat_completion_stream_async(
                    model=effective_model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    temperature=temperature,
                ):
                    text = self.ppx_client.extract_text(chunk)
                    if text:
                        yield text
                return
            except Exception as e:
                logger.error(f"Perplexity stream failed: {e}")

        # Fallback to Gemini stream
        try:
            m = genai.GenerativeModel(model_name=effective_model, system_instruction=system)
            resp = await m.generate_content_async(
                user,
                generation_config={"temperature": temperature, "max_output_tokens": max_tokens},
                stream=True,
            )
            async for chunk in resp:
                yield chunk.text
        except Exception as e:
            yield f"Stream error for {effective_model}: {e}"
