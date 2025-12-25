import requests
import logging
import json
from typing import List, Dict, Any, Optional

logger = logging.getLogger("OpenRouterClient")

class OpenRouterClient:
    """
    A lightweight client for the OpenRouter API.
    Supports OpenAI-compatible chat completions.
    """
    def __init__(self, api_key: str, site_url: str = "https://isaacsight.com", site_name: str = "Studio OS"):
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": site_url,
            "X-Title": site_name,
        }

    def chat_completion(self, model: str, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """
        Sends a chat completion request to OpenRouter.
        """
        if not self.api_key:
            return {"error": "OpenRouter API Key not found."}

        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            **kwargs
        }

        try:
            response = requests.post(url, headers=self.headers, json=payload, timeout=kwargs.get("timeout", 60))
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenRouter request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    return {"error": str(e), "details": error_data}
                except:
                    return {"error": str(e), "text": e.response.text}
            return {"error": str(e)}

    async def chat_completion_async(self, model: str, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """
        Async version of chat_completion (currently just wraps the sync call).
        Improved performance would use httpx or aiohttp.
        """
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.chat_completion(model, messages, **kwargs))

    def extract_text(self, response: Dict[str, Any]) -> str:
        """
        Helper to extract the text content from an OpenRouter response.
        """
        if "error" in response:
            return f"Error: {response['error']}"
        
        try:
            return response["choices"][0]["message"]["content"]
        except (KeyError, IndexError):
            return f"Error: Unexpected response format. {json.dumps(response)}"
