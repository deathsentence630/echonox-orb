#!/usr/bin/env python3
"""
Serveur WebSocket minimal pour Echonox (backend LLM simulé).
"""

import asyncio
import websockets
import json

async def handle_connection(websocket, path):
    print(f"Nouvelle connexion depuis {websocket.remote_address}")
    async for message in websocket:
        try:
            data = json.loads(message)
            print(f"Reçu: {data}")
            
            # Simuler une réponse LLM (à remplacer par un appel réel à Ollama)
            response = {
                "message": f"Réponse à: {data['content']}",
                "state": "talk"
            }
            await websocket.send(json.dumps(response))
        except Exception as e:
            print(f"Erreur: {e}")

async def main():
    server = await websockets.serve(
        handle_connection,
        "localhost",
        11434,
        ping_interval=20,
        ping_timeout=60
    )
    print(f"Serveur WebSocket démarré sur ws://localhost:11434")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())