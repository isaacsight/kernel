"""Claude Provider for DTFR Answer Engine.

This provider replaces Perplexity for synthesis, using Claude 4's
superior reasoning capabilities (72-79% SWE-bench, 83% GPQA Diamond).

Uses tier-based model routing:
- Haiku 4.5: Fast search, simple queries
- Sonnet 4: Balanced coding/analysis
- Opus 4.5: Complex synthesis, research mode
"""

import json
import logging
import os
from collections.abc import AsyncGenerator
from enum import Enum
from typing import Any, Optional

import httpx

logger = logging.getLogger("ClaudeProvider")


class ClaudeTier(Enum):
    """Model tiers for complexity-based routing."""

    FAST = "claude-haiku-4.5"
    BALANCED = "claude-sonnet-4"
    REASONING = "claude-opus-4.5"


# Map DTFR modes to Claude tiers
MODE_TO_TIER = {
    "search": ClaudeTier.FAST,
    "reasoning": ClaudeTier.BALANCED,
    "research": ClaudeTier.REASONING,
    "academic": ClaudeTier.REASONING,
}


class ClaudeClient:
    """
    Lightweight async client for Claude API.
    Replaces Perplexity for synthesis in the DTFR Answer Engine.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY") or ""
        self.base_url = "https://api.anthropic.com/v1"
        self.headers: dict[str, str] = {
            "x-api-key": self.api_key,
            "anthropic-version": "2024-06-01",
            "content-type": "application/json",
        }

    def _select_model(self, mode: str) -> str:
        """Select Claude model based on DTFR mode."""
        tier = MODE_TO_TIER.get(mode, ClaudeTier.BALANCED)
        return tier.value

    async def chat_completion_async(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        mode: str = "research",
        system: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.3,
        **kwargs,
    ) -> dict[str, Any]:
        """
        Send a chat completion request to Claude.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Explicit model name, or auto-select based on mode
            mode: DTFR mode for auto model selection
            system: System prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
        """
        if not self.api_key:
            return {"error": "ANTHROPIC_API_KEY not set"}

        selected_model = model or self._select_model(mode)

        payload = {
            "model": selected_model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
        }
        if system:
            payload["system"] = system

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    headers=self.headers,
                    json=payload,
                    timeout=kwargs.get("timeout", 60),
                )
                response.raise_for_status()
                result: dict[str, Any] = response.json()
                return result
        except Exception as e:
            logger.error(f"Claude request failed: {e}")
            return {"error": str(e)}

    async def chat_completion_stream_async(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        mode: str = "research",
        system: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.3,
        **kwargs,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Stream chat completions from Claude.

        Yields content_block_delta events with text chunks.
        """
        if not self.api_key:
            yield {"error": "ANTHROPIC_API_KEY not set"}
            return

        selected_model = model or self._select_model(mode)

        payload = {
            "model": selected_model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
            "stream": True,
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/messages",
                headers=self.headers,
                json=payload,
                timeout=kwargs.get("timeout", 120),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        event = json.loads(data_str)
                        yield event
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to decode: {line}")

    def extract_text(self, response: dict[str, Any]) -> str:
        """Extract text content from Claude response."""
        if "error" in response:
            return f"Error: {response['error']}"

        # Handle full response
        if "content" in response:
            for block in response["content"]:
                if block.get("type") == "text":
                    return str(block.get("text", ""))

        # Handle streaming delta
        if response.get("type") == "content_block_delta":
            delta = response.get("delta", {})
            return str(delta.get("text", ""))

        return ""


# Convenience function
def get_claude_client() -> ClaudeClient:
    """Get a configured Claude client."""
    return ClaudeClient()
