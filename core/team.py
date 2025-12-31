from typing import Any
from collections.abc import AsyncGenerator
import asyncio
from admin.engineers.metacognitive_principal import MetacognitivePrincipal


class FrontierTeam:
    def __init__(self):
        self.sovereign = MetacognitivePrincipal()

    async def delegate(self, prompt: str) -> AsyncGenerator[dict, None]:
        """
        Unified entry point. Delegates to the Sovereign for all processing.
        """
        async for update in self.sovereign.think_stream(prompt):
            yield update


team_orchestrator = FrontierTeam()
