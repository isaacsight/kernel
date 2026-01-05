# dtfr/search/sanitizer.py
"""
Input Sanitization for DTFR Answer Engine.
Prevents prompt injection and malicious input patterns.
"""

import re
from typing import Optional
import logging

logger = logging.getLogger("Sanitizer")

# Patterns that commonly appear in prompt injection attempts
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions?",
    r"ignore\s+(the\s+)?(above|prior)",
    r"disregard\s+(all\s+)?instructions?",
    r"forget\s+(everything|all)",
    r"new\s+instructions?:",
    r"system\s*prompt",
    r"reveal\s+(your\s+)?prompt",
    r"show\s+(me\s+)?(your\s+)?instructions?",
    r"you\s+are\s+now\s+(?:a|an)",
    r"act\s+as\s+(?:a|an|if)",
    r"pretend\s+(you\s+are|to\s+be)",
    r"<\s*/?system\s*>",
    r"\[\s*SYSTEM\s*\]",
    r"```\s*system",
]

# Control characters and special sequences to strip
CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# Maximum query length to prevent context stuffing
MAX_QUERY_LENGTH = 4000
MAX_PROMPT_LENGTH = 8000


def sanitize_query(query: str, max_length: int = MAX_QUERY_LENGTH) -> str:
    """
    Sanitize user query before search/retrieval.

    - Strips control characters
    - Truncates excessive length
    - Removes common injection patterns

    Args:
        query: Raw user input
        max_length: Maximum allowed length

    Returns:
        Cleaned query string
    """
    if not query:
        return ""

    # Strip control characters
    cleaned = CONTROL_CHAR_PATTERN.sub("", query)

    # Normalize whitespace
    cleaned = " ".join(cleaned.split())

    # Remove injection patterns (case insensitive)
    for pattern in INJECTION_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    # Re-normalize after removals
    cleaned = " ".join(cleaned.split())

    # Truncate
    if len(cleaned) > max_length:
        logger.warning(f"Query truncated from {len(query)} to {max_length} chars")
        cleaned = cleaned[:max_length]

    return cleaned.strip()


def sanitize_for_prompt(text: str, max_length: int = MAX_PROMPT_LENGTH) -> str:
    """
    Sanitize text before inserting into LLM prompt.

    - Escapes delimiter patterns that could confuse context
    - Strips injection patterns
    - Truncates to safe length

    Args:
        text: Text to be inserted into a prompt
        max_length: Maximum allowed length

    Returns:
        Prompt-safe string
    """
    if not text:
        return ""

    # Start with query sanitization
    cleaned = sanitize_query(text, max_length=max_length)

    # Escape potential delimiter patterns
    # Replace triple backticks with single to prevent code block escape
    cleaned = cleaned.replace("```", "`‍`‍`")  # Zero-width joiner breaks pattern

    # Escape XML-like tags that might be interpreted as system markers
    cleaned = re.sub(
        r"<\s*(/?)(\s*system|\s*user|\s*assistant)\s*>", r"[\1\2]", cleaned, flags=re.IGNORECASE
    )

    return cleaned


def is_suspicious(query: str) -> bool:
    """
    Check if a query contains suspicious patterns.

    Returns True if the query matches any injection pattern.
    Useful for logging/alerting without modifying the query.
    """
    if not query:
        return False

    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, query, flags=re.IGNORECASE):
            return True
    return False


def get_sanitization_report(original: str, sanitized: str) -> Optional[dict]:
    """
    Generate a report of what was changed during sanitization.

    Returns None if no changes were made.
    """
    if original == sanitized:
        return None

    return {
        "original_length": len(original),
        "sanitized_length": len(sanitized),
        "was_truncated": len(original) > MAX_QUERY_LENGTH,
        "patterns_detected": is_suspicious(original),
        "diff_chars": len(original) - len(sanitized),
    }
