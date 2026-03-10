#!/usr/bin/env python3
"""
Serveur WebSocket minimal pour Echonox (version web).
Ce script écoute sur ws://localhost:11434 et relaye les requêtes vers un LLM local (Ollama par défaut).
"""

import asyncio
import websockets
import json
import os
from typing import Dict, Any

# Configuration par défaut (modifiable via variables d'environnement)
DEFAULT_LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:7b")
DEFAULT_LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434")

async def query_ollama(prompt: str, model: str = DEFAULT_LLM_MODEL, base_url: str = DEFAULT_LLM_BASE_URL) -> str:
    """Interroge Ollama via son API HTTP."""
    import httpx
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False}
        )
        return response.json().get("response", "")

async def handle_connection(websocket, path):
    """Gère une connexion WebSocket."""
    print(f"Nouvelle connexion depuis {websocket.remote_address}")
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get("role") == "user":
                # Simule un état "think"
                await websocket.send(json.dumps({
                    "message": "",
                    "state": "think"
                }))
                
                # Requête au LLM
                reply = await query_ollama(data["content"], model=data.get("model", DEFAULT_LLM_MODEL))
                
                # Simule un état "talk"
                await websocket.send(json.dumps({
                    "message": reply,
                    "state": "talk"
                }))
    except Exception as e:
        print(f"Erreur: {e}")
        await websocket.send(json.dumps({
            "message": f"Erreur: {str(e)}",
            "state": "idle"
        }))

async def main():
    async with websockets.serve(
        handle_connection,
        "localhost",
        11434,
        ping_interval=20,
        ping_timeout=60
    ):
        print("Serveur WebSocket démarré sur ws://localhost:11434")
        await asyncio.Future()  # Bloque indéfiniment

if __name__ == "__main__":
    asyncio.run(main())