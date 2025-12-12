from fastapi import APIRouter, WebSocket
from admin.engineers.client_service import ClientService
from admin.api.connection_manager import ConnectionManager
import json

router = APIRouter()
manager = ConnectionManager()

@router.websocket("/ws/client")
async def websocket_client_chat(websocket: WebSocket):
    await manager.connect(websocket)
    service = ClientService() # Returns singleton
    
    try:
        while True:
            data = await websocket.receive_text()
            # Stream response
            async for chunk in service.stream_chat(data):
                await manager.send_personal_message(json.dumps({
                    "type": "response_chunk",
                    "content": chunk
                }), websocket)
    except Exception as e:
        print(f"Client chat error: {e}")
    finally:
        manager.disconnect(websocket)
