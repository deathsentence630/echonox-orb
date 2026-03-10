# Echonox — Version Web

**Echonox** est une interface web légère pour interagir avec un LLM local (par défaut via Ollama).
Cette version supprime l'orb visuel et propose une expérience proche d'une app macOS, avec une communication temps réel via WebSocket.

---

## ✨ Fonctionnalités
- **Interface web pure** (HTML/CSS/JS) sans dépendance à Electron.
- **Multi-conversations** avec historique et support RAG.
- **Paramètres** pour configurer le modèle, le comportement, et l'apparence.
- **Debug** pour surveiller les états et métriques.
- **WebSocket** pour une communication bidirectionnelle avec le backend LLM.

---

## 🚀 Installation & Démarrage

### 1. Prérequis
- **Python 3.8+** (pour le serveur WebSocket)
- **Node.js** (pour servir les fichiers statiques, optionnel)
- **Ollama** (ou un autre LLM local compatible avec l'API OpenAI)

Vérifiez les versions installées :
```bash
python3 --version
node --version  # Optionnel, si vous utilisez un serveur Node pour les fichiers statiques
```

---

### 2. Installation des dépendances Python
```bash
pip install websockets httpx
```

---

### 3. Installation d'Ollama
Suivez les instructions officielles : [ollama.com](https://ollama.com)

Exemple pour installer un modèle (remplacez `qwen2.5:7b` par votre modèle préféré) :
```bash
ollama pull qwen2.5:7b
```

---

### 4. Lancer le serveur WebSocket
```bash
# Depuis ce dépôt, dans la branche dev-websocket :
python3 websocket_server.py
```
> Le serveur écoute par défaut sur `ws://localhost:11434`.
> Vous pouvez changer le port en modifiant le script ou via la variable `PORT`.

---

### 5. Lancer l'interface web
Ouvrez `index.html` dans votre navigateur (via `file://` ou un serveur web local).

Pour servir les fichiers statiques avec Node.js (optionnel) :
```bash
npx serve .
```

---

### 6. Variables d'environnement utiles
| Variable               | Description                                  | Exemple                     |
|------------------------|----------------------------------------------|-----------------------------|
| `LLM_MODEL`            | Modèle LLM à utiliser.                       | `qwen2.5:7b`                |
| `LLM_BASE_URL`         | URL de base de l'API LLM.                    | `http://localhost:11434`    |

---

## 🛠 Configuration
Toutes les options sont configurables via l'interface ou en modifiant `app.js`/`websocket_server.py`.

---

## ⚠️ Notes importantes
- **Aucune donnée n'est envoyée vers des services externes** (tout reste local).
- Le serveur WebSocket doit être lancé **avant** d'ouvrir l'interface.
- Pour utiliser un autre LLM, modifiez `websocket_server.py` ou définissez `LLM_BASE_URL`.

---

## 📚 Développement
Cette branche (`dev-websocket`) est une expérience pour une version web d'Echonox.

- **Frontend** : HTML/CSS/JS pur, compatible avec tous les navigateurs modernes.
- **Backend** : Serveur WebSocket en Python, compatible avec Ollama ou d'autres LLM locaux.

---

## ⚖️ Licence
Ce projet est open-source. Voir [LICENSE](LICENSE) pour plus de détails.

---

## Echonox — local, léger, et respectueux de la vie privée.