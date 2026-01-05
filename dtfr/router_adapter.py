from typing import Optional, AsyncGenerator
from collections.abc import AsyncGenerator as ABCAsyncGenerator
from admin.brain.model_router import TaskType
import google.generativeai as genai
from admin.config import config
import logging
import asyncio
import time

logger = logging.getLogger("RouterAdapter")

# Retry configuration
MAX_RETRIES = 3
BASE_DELAY = 1.0  # seconds
MAX_DELAY = 8.0
COOLDOWN_DURATION = 60.0  # seconds
FAILURE_THRESHOLD = 3


class CircuitBreaker:
    """
    Simple circuit breaker for provider health tracking.
    """

    def __init__(self):
        self._failures: dict[str, int] = {}
        self._cooldown_until: dict[str, float] = {}

    def record_failure(self, provider: str) -> None:
        """Record a failure for a provider."""
        self._failures[provider] = self._failures.get(provider, 0) + 1
        if self._failures[provider] >= FAILURE_THRESHOLD:
            self._cooldown_until[provider] = time.time() + COOLDOWN_DURATION
            logger.warning(f"Circuit breaker OPEN for {provider} (cooldown {COOLDOWN_DURATION}s)")

    def record_success(self, provider: str) -> None:
        """Reset failure count on success."""
        self._failures[provider] = 0
        if provider in self._cooldown_until:
            del self._cooldown_until[provider]

    def is_available(self, provider: str) -> bool:
        """Check if provider is available (not in cooldown)."""
        cooldown_end = self._cooldown_until.get(provider, 0)
        if time.time() >= cooldown_end:
            # Cooldown expired, allow retry
            if provider in self._cooldown_until:
                del self._cooldown_until[provider]
                self._failures[provider] = 0
                logger.info(f"Circuit breaker CLOSED for {provider} (cooldown expired)")
            return True
        return False

    def get_status(self) -> dict:
        """Get current circuit breaker status."""
        return {
            "failures": dict(self._failures),
            "cooldowns": {
                k: v - time.time() for k, v in self._cooldown_until.items() if v > time.time()
            },
        }


class RouterAdapter:
    """
    Wraps the DTFR ModelRouter to provide a standardized interface for AnswerEngine.
    Includes exponential backoff retry and circuit breaker for reliability.
    """

    def __init__(self, model_router, ppx_client=None):
        self.router = model_router
        self.ppx_client = ppx_client
        self.circuit_breaker = CircuitBreaker()

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
            if self.circuit_breaker.is_available("perplexity"):
                return config.DTFR_SYNTHESIS_MODEL

        if (task == "verify" or task == "rewrite") and config.DTFR_VERIFY_PROVIDER == "perplexity":
            if self.circuit_breaker.is_available("perplexity"):
                return config.DTFR_VERIFY_MODEL

        # Priority: Use Perplexity (Sonar) if available and circuit is closed
        if self.ppx_client and self.circuit_breaker.is_available("perplexity"):
            if task == "synthesis":
                return "sonar-pro"
            elif task == "verify":
                return "sonar"
            elif task == "rewrite":
                return "sonar"

        # Select model via router
        result = self.router.select_model(task_type)
        model = result.get("selected", "gemini-1.5-flash")

        # Fallback to Gemini
        if "sonar" not in model.lower():
            if task == "synthesis" or task == "verify":
                return "gemini-flash-latest"
            return "gemini-flash-latest"

        return model

    async def _retry_with_backoff(
        self, coro_factory, provider: str, max_retries: int = MAX_RETRIES
    ):
        """
        Execute a coroutine with exponential backoff retry.

        Args:
            coro_factory: Callable that returns a new coroutine each call
            provider: Provider name for circuit breaker tracking
            max_retries: Maximum retry attempts
        """
        last_error = None

        for attempt in range(max_retries):
            try:
                result = await coro_factory()
                self.circuit_breaker.record_success(provider)
                return result
            except Exception as e:
                last_error = e
                self.circuit_breaker.record_failure(provider)

                if attempt < max_retries - 1:
                    delay = min(BASE_DELAY * (2**attempt), MAX_DELAY)
                    logger.warning(
                        f"Attempt {attempt + 1} failed for {provider}: {e}. Retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"All {max_retries} attempts failed for {provider}: {e}")

        raise last_error

    async def complete_async(
        self,
        model: str,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        Executes an async completion with model normalization and retry logic.
        """
        effective_model = model.replace("models/", "")

        # Try Perplexity with retry if available
        if "sonar" in effective_model.lower() and self.ppx_client:
            if self.circuit_breaker.is_available("perplexity"):
                try:

                    async def ppx_call():
                        resp = await self.ppx_client.chat_completion_async(
                            model=effective_model,
                            messages=[
                                {"role": "system", "content": system},
                                {"role": "user", "content": user},
                            ],
                            temperature=temperature,
                        )
                        return self.ppx_client.extract_text(resp)

                    return await self._retry_with_backoff(ppx_call, "perplexity")
                except Exception as e:
                    logger.warning(f"Perplexity failed after retries: {e}. Falling back to Gemini.")

        # Fallback to Gemini with retry
        async def gemini_call():
            m = genai.GenerativeModel(model_name=effective_model, system_instruction=system)
            resp = await m.generate_content_async(
                user,
                generation_config={"temperature": temperature, "max_output_tokens": max_tokens},
            )
            return resp.text

        try:
            return await self._retry_with_backoff(gemini_call, "gemini")
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
        Note: Retry logic for streaming is best-effort at the start.
        """
        effective_model = model.replace("models/", "")

        # Try Perplexity if available
        if "sonar" in effective_model.lower() and self.ppx_client:
            if self.circuit_breaker.is_available("perplexity"):
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
                    self.circuit_breaker.record_success("perplexity")
                    return
                except Exception as e:
                    self.circuit_breaker.record_failure("perplexity")
                    logger.error(f"Perplexity stream failed: {e}. Falling back to Gemini.")

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
            self.circuit_breaker.record_success("gemini")
        except Exception as e:
            self.circuit_breaker.record_failure("gemini")
            yield f"Stream error for {effective_model}: {e}"

    def get_health_status(self) -> dict:
        """Get current provider health status."""
        return {
            "circuit_breaker": self.circuit_breaker.get_status(),
            "perplexity_available": self.ppx_client is not None
            and self.circuit_breaker.is_available("perplexity"),
            "gemini_available": self.circuit_breaker.is_available("gemini"),
        }
