"""
The Translator - Localization Expert Agent

Translates content to multiple languages using Studio Node.
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin.brain.memory_store import get_memory_store
from admin.brain.metrics_collector import get_metrics_collector
from config import config

logger = logging.getLogger("Translator")


class Translator:
    """
    The Translator (Localization Expert)
    
    Mission: Make content accessible to global audiences.
    
    Responsibilities:
    - Translate blog posts to multiple languages
    - Adapt content for cultural relevance
    - Maintain translation memory
    - Ensure consistent terminology
    """
    
    SUPPORTED_LANGUAGES = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "pt": "Portuguese",
        "it": "Italian",
        "ja": "Japanese",
        "ko": "Korean",
        "zh": "Chinese"
    }
    
    def __init__(self):
        self.name = "The Translator"
        self.role = "Localization Expert"
        self.memory = get_memory_store()
        self.metrics = get_metrics_collector()
        self.node_url = config.STUDIO_NODE_URL
        self.translations_dir = os.path.join(
            os.path.dirname(__file__), '..', 'brain', 'translations'
        )
        os.makedirs(self.translations_dir, exist_ok=True)
        
    def translate_text(self, text: str, target_lang: str) -> str:
        """
        Translates text to target language using Studio Node.
        """
        lang_name = self.SUPPORTED_LANGUAGES.get(target_lang, target_lang)
        logger.info(f"[{self.name}] Translating to {lang_name}...")
        
        if self.node_url:
            import requests
            try:
                prompt = f"""
                Translate the following text to {lang_name}.
                Maintain the tone, style, and emotional nuance of the original.
                
                TEXT:
                {text}
                
                Return ONLY the translated text, nothing else.
                """
                
                response = requests.post(
                    f"{self.node_url}/generate",
                    json={"prompt": prompt, "model": "mistral"},
                    timeout=60
                )
                response.raise_for_status()
                translated = response.json().get("response", "").strip()
                
                self.metrics.track_agent_action(self.name, 'translate', True, 0)
                return translated
                
            except Exception as e:
                logger.error(f"[{self.name}] Translation failed: {e}")
        
        return f"[Translation to {lang_name} unavailable - Studio Node offline]"
    
    def translate_post(self, slug: str, target_lang: str) -> Dict:
        """
        Translates an entire blog post.
        """
        import frontmatter
        
        content_dir = config.CONTENT_DIR
        source_path = os.path.join(content_dir, f"{slug}.md")
        
        if not os.path.exists(source_path):
            return {"error": f"Post not found: {slug}"}
        
        with open(source_path, 'r') as f:
            post = frontmatter.load(f)
        
        # Translate title and content
        translated_title = self.translate_text(post.get('title', ''), target_lang)
        translated_content = self.translate_text(post.content, target_lang)
        
        # Create translated post
        translated = {
            'original_slug': slug,
            'language': target_lang,
            'title': translated_title,
            'content': translated_content,
            'translated_at': datetime.now().isoformat()
        }
        
        # Save translation
        output_path = os.path.join(self.translations_dir, f"{slug}_{target_lang}.json")
        with open(output_path, 'w') as f:
            json.dump(translated, f, indent=2, ensure_ascii=False)
        
        logger.info(f"[{self.name}] Saved translation: {output_path}")
        return translated
    
    def get_available_translations(self, slug: str) -> List[str]:
        """
        Gets list of available translations for a post.
        """
        translations = []
        
        for lang_code in self.SUPPORTED_LANGUAGES.keys():
            path = os.path.join(self.translations_dir, f"{slug}_{lang_code}.json")
            if os.path.exists(path):
                translations.append(lang_code)
        
        return translations
    
    def batch_translate(self, slug: str, languages: List[str] = None) -> Dict:
        """
        Translate a post to multiple languages.
        """
        if languages is None:
            languages = ["es", "fr", "de"]  # Default languages
        
        results = {}
        for lang in languages:
            results[lang] = self.translate_post(slug, lang)
        
        return results
    
    def translate_excerpt(self, text: str, target_lang: str, max_length: int = 200) -> str:
        """
        Translate a short excerpt (for social media, etc).
        """
        translated = self.translate_text(text[:500], target_lang)
        if len(translated) > max_length:
            translated = translated[:max_length-3] + "..."
        return translated
    
    def get_translation_stats(self) -> Dict:
        """
        Get statistics about translations.
        """
        stats = {"by_language": {}, "total": 0}
        
        for filename in os.listdir(self.translations_dir):
            if filename.endswith('.json'):
                parts = filename.replace('.json', '').split('_')
                if len(parts) >= 2:
                    lang = parts[-1]
                    stats["by_language"][lang] = stats["by_language"].get(lang, 0) + 1
                    stats["total"] += 1
        
        return stats


if __name__ == "__main__":
    translator = Translator()
    
    # Test translation
    sample = "The art of finding peace in a noisy world requires intentional silence."
    print("Original:", sample)
    print("Spanish:", translator.translate_text(sample, "es"))
    
    print("\nTranslation Stats:", translator.get_translation_stats())
