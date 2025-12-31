import json
import logging
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger("PerplexityClient")


class PerplexityClient:
    """
    A lightweight client for the Perplexity API.
    Perplexity uses an OpenAI-compatible API format.
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.perplexity.ai"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def chat_completion(
        self, model: str, messages: List[Dict[str, str]], **kwargs
    ) -> Dict[str, Any]:
        """
        Sends a chat completion request to Perplexity.
        """
        if not self.api_key:
            return {"error": "Perplexity API Key not found."}

        url = f"{self.base_url}/chat/completions"
        payload = {"model": model, "messages": messages, **kwargs}

        try:
            response = requests.post(
                url, headers=self.headers, json=payload, timeout=kwargs.get("timeout", 60)
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Perplexity request failed: {e}")
            if hasattr(e, "response") and e.response is not None:
                try:
                    error_data = e.response.json()
                    return {"error": str(e), "details": error_data}
                except:
                    return {"error": str(e), "text": e.response.text}
            return {"error": str(e)}

    async def chat_completion_async(
        self, model: str, messages: List[Dict[str, str]], **kwargs
    ) -> Dict[str, Any]:
        """
        Asynchronously sends a chat completion request to Perplexity.
        """
        import httpx

        url = f"{self.base_url}/chat/completions"
        payload = {"model": model, "messages": messages, **kwargs}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, headers=self.headers, json=payload, timeout=kwargs.get("timeout", 60)
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Perplexity async request failed: {e}")
            return {"error": str(e)}

    async def chat_completion_stream_async(
        self, model: str, messages: list[dict[str, str]], **kwargs
    ) -> Any:
        """
        Asynchronously stream chat completions from Perplexity.
        """
        import httpx
        import json

        url = f"{self.base_url}/chat/completions"
        payload = {"model": model, "messages": messages, "stream": True, **kwargs}

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST", url, headers=self.headers, json=payload, timeout=kwargs.get("timeout", 60)
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            yield json.loads(data_str)
                        except json.JSONDecodeError:
                            logger.error(f"Failed to decode stream line: {line}")

    def extract_text(self, response: Dict[str, Any]) -> str:
        """
        Helper to extract the text content from a Perplexity response (full or chunk).
        """
        if "error" in response:
            return f"Error: {response['error']}"

        try:
            # Handle full response
            if "choices" in response and len(response["choices"]) > 0:
                choice = response["choices"][0]
                if "message" in choice:
                    return choice["message"]["content"]
                elif "delta" in choice:
                    return choice["delta"].get("content", "")
            return ""
        except (KeyError, IndexError):
            return ""

    def extract_citations(self, response: dict[str, Any]) -> list[str]:
        """
        Extracts citations from the Perplexity response if available.
        """
        return response.get("citations", [])
