# admin/brain/council_protocol.py
"""
Council Protocol - Specialized prompts for Cognitive Council dispatch.

These prompts are injected into agent execution based on intent classification
to guide the agent's reasoning style for the specific task type.
"""
from typing import Optional


class CouncilProtocol:
    """
    Registry of council-aware prompts for intent-specific agent guidance.
    """
    
    @staticmethod
    def get_research_prompt(inquiry: str) -> str:
        """
        Prompt for research-focused tasks.
        Prioritizes evidence gathering and source grounding.
        """
        return f"""## Council Dispatch: RESEARCH MODE

You have been dispatched by the Cognitive Council to investigate:
> {inquiry}

**Protocol Requirements**:
1. **Evidence First**: Do not form conclusions until you have gathered sources.
2. **Source Grounding**: Every factual claim must be traceable to a source.
3. **Uncertainty Surfacing**: Explicitly state confidence levels (high/medium/low).
4. **Conflict Detection**: If sources disagree, present both perspectives.

**Output Format**:
- Begin with a 1-sentence summary of findings
- Present key evidence with inline citations
- End with "Areas of Uncertainty" and "Recommended Next Steps"

Proceed with your investigation."""

    @staticmethod
    def get_generate_prompt(inquiry: str) -> str:
        """
        Prompt for generative/creative tasks.
        Prioritizes flow, clarity, and emotional resonance.
        """
        return f"""## Council Dispatch: GENERATE MODE

You have been dispatched by the Cognitive Council to create:
> {inquiry}

**Protocol Requirements**:
1. **Flow First**: Prioritize readability and emotional resonance over technical precision.
2. **Voice Consistency**: Match the established tone (calm, warm, reflective).
3. **Structure**: Use clear sections with transitions that feel natural.
4. **Signature**: End with a reflective question that invites the reader to pause.

**Output Format**:
- Title (if applicable)
- Body with clear sections
- Closing thought or question

Proceed with your creation."""

    @staticmethod
    def get_analyze_prompt(inquiry: str) -> str:
        """
        Prompt for analytical/critique tasks.
        Prioritizes edge cases, risks, and critical evaluation.
        """
        return f"""## Council Dispatch: ANALYZE MODE

You have been dispatched by the Cognitive Council to evaluate:
> {inquiry}

**Protocol Requirements**:
1. **Skeptic's Lens**: Assume the initial approach has hidden flaws.
2. **Edge Cases**: Enumerate scenarios where the approach breaks down.
3. **Risk Matrix**: Categorize issues by severity (critical/moderate/minor).
4. **Constructive Output**: For each critique, suggest a mitigation.

**Output Format**:
- Summary of what's being analyzed
- Strengths (brief)
- Weaknesses (detailed with mitigations)
- Final verdict: Proceed / Proceed with Caution / Reconsider

Proceed with your analysis."""

    @staticmethod
    def get_critique_prompt(primary_output: str, inquiry: str) -> str:
        """
        Prompt for the critique agent running in parallel.
        Provides adversarial review of the primary agent's approach.
        """
        return f"""## Council Dispatch: CRITIQUE MODE

You are the critique agent in a Cognitive Council session.

**Original Inquiry**: {inquiry}

**Primary Agent Output** (for review):
{primary_output[:2000]}...

**Your Role**:
1. **Adversarial Review**: Find weaknesses the primary agent missed.
2. **Assumption Audit**: What did the primary agent assume without stating?
3. **Alternative Paths**: Suggest one approach the primary agent didn't consider.
4. **Constructive Synthesis**: If the output is strong, acknowledge it briefly.

**Output Format**:
- Agreement Points (1-2 sentences)
- Concerns (numbered list)
- Alternative Consideration
- Recommendation: Accept / Accept with Revisions / Request Rework

Be direct but not dismissive. Your job is to strengthen the final output."""

    @staticmethod
    def get_general_prompt(inquiry: str) -> str:
        """
        Fallback prompt for general/unclassified inquiries.
        """
        return f"""## Council Dispatch: GENERAL MODE

You have been dispatched by the Cognitive Council to assist with:
> {inquiry}

**Protocol Requirements**:
1. **Clarity**: Ensure your response is immediately understandable.
2. **Actionability**: If possible, provide concrete next steps.
3. **Brevity**: Respect the user's time; be concise.

Proceed with your response."""

    @staticmethod
    def get_prompt_for_intent(intent: str, inquiry: str) -> str:
        """
        Get the appropriate council prompt for a given intent.
        
        Args:
            intent: One of 'research', 'generate', 'analyze', 'general'
            inquiry: The user's inquiry
            
        Returns:
            The formatted council prompt
        """
        prompt_map = {
            'research': CouncilProtocol.get_research_prompt,
            'generate': CouncilProtocol.get_generate_prompt,
            'analyze': CouncilProtocol.get_analyze_prompt,
            'general': CouncilProtocol.get_general_prompt,
        }
        
        prompt_fn = prompt_map.get(intent, CouncilProtocol.get_general_prompt)
        return prompt_fn(inquiry)


# Convenience function for direct access
def get_council_prompt(intent: str, inquiry: str) -> str:
    """Get council prompt for intent."""
    return CouncilProtocol.get_prompt_for_intent(intent, inquiry)


def get_critique_prompt(primary_output: str, inquiry: str) -> str:
    """Get critique prompt for parallel review."""
    return CouncilProtocol.get_critique_prompt(primary_output, inquiry)
