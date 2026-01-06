"""Bridge utility for coordinating with the Claude Chrome Extension.

This module formats DTFR mission objectives into prompts optimized for the
Claude for Chrome extension, leveraging its browser automation and
debugging capabilities.
"""

from datetime import datetime
from typing import Any, Optional


class ClaudeBrowserBridge:
    """
    Formats DTFR task data for consumption by the Claude for Chrome extension.
    """

    def __init__(self):
        self.timestamp = datetime.now().isoformat()

    def format_mission_prompt(
        self,
        objective: str,
        context: Optional[dict[str, Any]] = None,
        requirements: Optional[list[str]] = None,
    ) -> str:
        """
        Formats a mission prompt specifically for the Claude Chrome Extension.

        Args:
            objective: The main goal (e.g., "Find the latest SWE-bench results for Claude 4")
            context: Additional context like current repo or relevant files
            requirements: Specific constraints or things to look for
        """

        prompt = ["# DTFR BROWSER MISSION", f"**Objective**: {objective}", ""]

        if context:
            prompt.append("## Context")
            for key, value in context.items():
                prompt.append(f"- **{key}**: {value}")
            prompt.append("")

        if requirements:
            prompt.append("## Requirements")
            for req in requirements:
                prompt.append(f"- {req}")
            prompt.append("")

        prompt.append("---")
        prompt.append("## Extension Instructions")
        prompt.append("Please use the Claude for Chrome extension to execute the following:")
        prompt.append(
            "1. **Verify**: Use the extension to read the current page state or search the web."
        )
        prompt.append(
            "2. **Execute**: Navigate and interact with the browser as needed to fulfill the objective."
        )
        prompt.append("3. **Summarize**: Provide a structured summary of your findings back here.")
        prompt.append(
            "4. **Debug**: (If applicable) Read console logs or network traces for any issues encountered."
        )

        return "\n".join(prompt)

    def generate_debugging_payload(self, error_message: str, stack_trace: str) -> str:
        """
        Formats an error report for Claude to debug using the browser extension.
        """
        prompt = [
            "# DTFR DEBUGGING REQUEST",
            "I've encountered an issue in the browser that needs analysis.",
            "",
            f"**Error**: {error_message}",
            "**Stack Trace**:",
            "```",
            stack_trace,
            "```",
            "",
            "Please use the Claude for Chrome extension to:",
            "- Read the `console.log` and `error` streams.",
            "- Inspect the `Network` tab for failed requests.",
            "- Check the DOM for missing or malformed elements.",
            "Explain the root cause and suggest a fix.",
        ]

        return "\n".join(prompt)


if __name__ == "__main__":
    # Quick demo
    bridge = ClaudeBrowserBridge()
    mission = bridge.format_mission_prompt(
        objective="Verify the deployment of the DTFR landing page updates",
        context={"URL": "https://isaacsight.github.io/does-this-feel-right-/"},
        requirements=[
            "Check that 'Copilot' is renamed to 'Extensions'",
            "Verify 'Latest Runs' section exists",
        ],
    )
    print(mission)
