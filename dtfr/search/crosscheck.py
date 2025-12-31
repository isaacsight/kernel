# dtfr/search/crosscheck.py
import re
import json
from typing import List

EXTRACT_CLAIMS_SYSTEM = """Extract up to 6 key factual claims from the answer.
Return JSON array of strings. No prose.
Claims must be checkable (not opinions).
"""

VERIFY_CLAIM_SYSTEM = """You are a fact-checker.
Given a claim and sources, decide:
- supported
- contradicted
- unclear

Return JSON:
{"verdict":"supported|contradicted|unclear","supporting":[1,2],"notes":"short"}
No prose outside JSON.
"""


async def extract_claims(router, model: str, answer_text: str) -> list[str]:
    resp = await router.complete_async(
        model=model,
        system=EXTRACT_CLAIMS_SYSTEM,
        user=answer_text[:8000],
        temperature=0.0,
    )
    try:
        # Find JSON
        start = resp.find("[")
        end = resp.rfind("]") + 1
        if start == -1 or end == 0:
            return []

        claims = json.loads(resp[start:end])
        if isinstance(claims, list):
            return [str(c)[:300] for c in claims][:6]
    except Exception:
        pass
    # fallback: naive sentence selection
    sents = re.split(r"(?<=[.!?])\s+", answer_text)
    return [s[:300] for s in sents if len(s) > 40][:4]


async def verify_claim(router, model: str, claim: str, sources_compact: str) -> dict:
    resp = await router.complete_async(
        model=model,
        system=VERIFY_CLAIM_SYSTEM,
        user=f"Claim: {claim}\n\nSources:\n{sources_compact}"[:12000],
        temperature=0.0,
    )
    try:
        # Find JSON
        start = resp.find("{")
        end = resp.rfind("}") + 1
        if start == -1 or end == 0:
            return {"verdict": "unclear", "supporting": [], "notes": "No JSON found."}

        data = json.loads(resp[start:end])
        if isinstance(data, dict) and "verdict" in data:
            return data
    except Exception:
        pass
    return {"verdict": "unclear", "supporting": [], "notes": "Could not parse verifier output."}


async def cross_check(router, model: str, answer_text: str, sources_compact: str) -> list[str]:
    claims = await extract_claims(router, model, answer_text)
    notes: list[str] = []
    for c in claims:
        v = await verify_claim(router, model, c, sources_compact)
        verdict = v.get("verdict", "unclear")
        sup = v.get("supporting", [])
        if verdict == "contradicted":
            notes.append(f"Sources contradict claim: “{c}”. Check sources {sup}.")
        elif verdict == "unclear":
            notes.append(f"Could not verify claim: “{c}”.")
    return notes
