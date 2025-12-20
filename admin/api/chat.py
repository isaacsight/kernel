from fastapi import APIRouter, WebSocket
from admin.engineers.client_service import ClientService
from admin.api.connection_manager import get_connection_manager
import json

router = APIRouter()
manager = get_connection_manager()

@router.websocket("/ws/client")
async def websocket_client_chat(websocket: WebSocket):
    await manager.connect(websocket)
    service = ClientService() # Returns singleton
    
    try:
        while True:
            data = await websocket.receive_text()
            print(f"DEBUG: Received message via WS: {data}")
            
            # Broadcast user message to all devices
            await manager.broadcast(json.dumps({
                "type": "user_message",
                "content": data,
                "source": "web"
            }))
            
            # Stream response and broadcast chunks
            async for chunk_info in service.stream_chat(data):
                chunk_type = "reasoning_chunk" if chunk_info.get("type") == "thought" else "response_chunk"
                print(f"DEBUG: Broadcasting {chunk_type}: {chunk_info.get('content', '')[:20]}...")
                await manager.broadcast(json.dumps({
                    "type": chunk_type,
                    "content": chunk_info.get("content", "")
                }))
            
            # Broadcast completion
            await manager.broadcast(json.dumps({
                "type": "response_done"
            }))
    except Exception as e:
        print(f"Client chat error: {e}")
    finally:
        manager.disconnect(websocket)
