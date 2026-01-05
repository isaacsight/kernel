import json
import uuid
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict


@dataclass
class Operation:
    type: str  # research, spec, scaffold, dtfr, deploy, log
    status: str = "pending"  # pending, running, complete, failed, skipped
    detail: str = ""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class OperationStack:
    intent: str
    operations: List[Operation]
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


class IntentParser:
    """
    Parses natural language intent and generates an Operation Stack.
    Currently uses pattern-based generation, designed to be easily
    extended with LLM-based reasoning.
    """

    PATTERNS = {
        "build": ["research", "spec", "scaffold", "dtfr", "deploy"],
        "create": ["research", "spec", "scaffold", "dtfr", "deploy"],
        "design": ["research", "spec", "scaffold", "dtfr"],
        "research": ["research", "spec", "log"],
        "test": ["research", "dtfr"],
        "deploy": ["dtfr", "deploy"],
        "update": ["spec", "scaffold", "dtfr", "deploy"],
    }

    def parse(self, intent: str) -> OperationStack:
        intent_lower = intent.lower()

        # Default behavior: standard build pipeline
        steps = self.PATTERNS["build"]

        # Determine steps based on keywords
        for key, pattern in self.PATTERNS.items():
            if key in intent_lower:
                steps = pattern
                break

        operations = []
        for step in steps:
            detail = self._generate_detail(step, intent)
            operations.append(Operation(type=step, detail=detail))

        return OperationStack(intent=intent, operations=operations)

    def _generate_detail(self, step: str, intent: str) -> str:
        """
        Generate a contextual detail for each step based on the intent.
        """
        details = {
            "research": f"Searching for patterns related to: {intent}",
            "spec": f"Drafting technical specification for: {intent}",
            "scaffold": f"Generating code structure for: {intent}",
            "dtfr": "Validating implementation against DTFR principles",
            "deploy": "Pushing changes to production environment",
            "log": "Recording decision and outcome in research ledger",
        }
        return details.get(step, "Executing task step")


def to_json(obj):
    return json.dumps(asdict(obj), indent=2)


if __name__ == "__main__":
    import sys

    parser = IntentParser()
    intent = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Build a procedural hero section"

    stack = parser.parse(intent)
    print(to_json(stack))
