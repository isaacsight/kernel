import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from admin.api.connection_manager import get_connection_manager
from admin.engineers.copilot import Copilot

logger = logging.getLogger("dtfr-copilot-api")
router = APIRouter()
manager = get_connection_manager()


@router.websocket("/ws/copilot")
async def websocket_copilot(websocket: WebSocket):
    await manager.connect(websocket)
    copilot = Copilot()
    logger.info("DTFR Copilot connected.")

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received: {raw_data}")
                continue

            user_input = data.get("input", "")
            mode = data.get("mode", "research")
            history = data.get("history", [])

            if not user_input:
                continue

            # Delegate to Copilot Agent
            # Copilot.evaluate returns an AsyncGenerator yielding state dicts
            async for state in copilot.evaluate(
                user_input, conversation_history=history, mode=mode
            ):
                await manager.broadcast(json.dumps(state))

    except WebSocketDisconnect:
        logger.info("DTFR Copilot disconnected")
    except Exception as e:
        logger.error(f"Copilot WebSocket error: {e}")
        await manager.broadcast(json.dumps({"type": "error", "message": "Internal Server Error"}))
    finally:
        manager.disconnect(websocket)
