from fastapi import WebSocket
from typing import List
import logging
import asyncio

logger = logging.getLogger("ConnectionManager")

class ConnectionManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConnectionManager, cls).__new__(cls)
            cls._instance.active_connections: List[WebSocket] = []
        return cls._instance

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Connected: {len(self.active_connections)} active connections")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Disconnected: {len(self.active_connections)} remaining")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        if not self.active_connections:
            return
            
        tasks = []
        for connection in self.active_connections:
            tasks.append(connection.send_text(message))
            
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Broadcast error to connection {i}: {result}")

# Singleton helper
def get_connection_manager() -> ConnectionManager:
    return ConnectionManager()
