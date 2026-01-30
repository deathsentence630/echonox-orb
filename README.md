# ECHONOX Orb

**ECHONOX** est une expérimentation autour d’une présence numérique locale :  
une entité visuelle minimaliste, interactive, et **pilotée par un LLM exécuté en local**.

L’objectif n’est pas de créer un simple assistant, mais une **présence** :
calme, non intrusive, respectueuse de la vie privée, et pensée pour évoluer.

---

## ✨ Principes clés

- 🔐 **Privacy-first**  
  Aucune donnée n’est envoyée vers des services externes.  
  Le modèle de langage s’exécute **entièrement en local**.

- 🧠 **LLM local**  
  Intégration via Ollama (par défaut), sans dépendance cloud.

- 👁️ **Présence visuelle**  
  Une orb animée, réactive à la souris et à l’état interne (idle / listen / think / talk).

- 🧱 **Architecture claire**  
  Séparation stricte entre :
  - `main.js` → logique système / LLM
  - `renderer.js` → UI / interactions
  - `index.html` / `style.css` → présentation

---

## 🖥️ Aperçu

- Orb centrale avec animation et bloom progressif
- Réaction subtile à la proximité du curseur
- États visuels pilotés par le comportement
- Interface de chat intégrée (actuellement via le panneau debug)

---

## 🚀 Installation & démarrage

ECHONOX fonctionne sur **macOS**, **Windows** et **Linux**.
L’application repose sur un **LLM exécuté localement** via Ollama.

---

## 1️⃣ Prérequis communs

Quel que soit votre système :

- **Node.js** (version LTS recommandée ≥ 18)
- **npm** (fourni avec Node.js)
- Un GPU est optionnel mais recommandé pour de meilleures performances LLM

Vérification rapide :

```bash
node -v
npm -v
```

---

## 2️⃣ Installation de Node.js

### macOS

- Télécharger depuis : <https://nodejs.org>
- Ou via Homebrew :

```bash
brew install node
```

### Windows

- Télécharger l’installeur officiel : <https://nodejs.org>
- Pendant l’installation, accepter l’option **"Add to PATH"**

### Linux (générique)

#### Debian / Ubuntu

```bash
sudo apt update
sudo apt install nodejs npm
```

#### Arch

```bash
sudo pacman -S nodejs npm
```

#### Fedora

```bash
sudo dnf install nodejs npm
```

---

## 3️⃣ Installation d’Ollama (LLM local)

ECHONOX utilise **Ollama** pour exécuter les modèles de langage localement.

### macOS

```bash
brew install ollama
```

ou via l’installeur officiel :
<https://ollama.com>

### Windows

- Télécharger l’installeur officiel : <https://ollama.com>
- Lancer Ollama une fois installé (service local)

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

---

## 4️⃣ Installation d’un modèle LLM

Exemple recommandé (bon équilibre qualité / français) :

```bash
ollama pull qwen2.5:7b
```

Autres modèles possibles :

- `llama3.2:3b` → très rapide, plus léger
- tout modèle compatible Ollama

---

## 5️⃣ Lancer Ollama

Avant de démarrer ECHONOX, le service Ollama doit être actif.

```bash
ollama serve
```

(Ollama peut aussi se lancer automatiquement selon l’OS.)

---

## 6️⃣ Installation d’ECHONOX

Cloner le dépôt :

```bash
git clone https://github.com/deathsentence630/echonox-orb.git
cd echonox-orb
```

Installer les dépendances :

```bash
npm install
```

---

## 7️⃣ Lancer l’application

```bash
LLM_MODEL="qwen2.5:7b" npm start
```

Sous Windows (PowerShell) :

```powershell
$env:LLM_MODEL="qwen2.5:7b"
npm start
```

---

## 🧠 Variables d’environnement utiles

```bash
LLM_MODEL=qwen2.5:7b
LLM_BASE_URL=http://127.0.0.1:11434
```

Par défaut, ECHONOX refuse toute URL LLM non locale
(choix volontaire orienté confidentialité).

---

## ✅ Dépannage rapide

- **L’application démarre mais ne répond pas**
  → Vérifier que `ollama serve` est actif

- **Erreur de connexion LLM**
  → Vérifier `LLM_BASE_URL`

- **Performances lentes**
  → Utiliser un modèle plus léger (`3b`) ou activer le GPU si disponible

---

## 🔧 Configuration

Variables d’environnement utiles :

```bash
LLM_MODEL=qwen2.5:7b
LLM_BASE_URL=http://127.0.0.1:11434
```

Par défaut, l’application refuse toute URL LLM non locale
(choix volontaire, orienté confidentialité).

---

## 🔐 Sécurité & stockage des données

ECHONOX intègre un **système de stockage sécurisé** pour les conversations et états internes.

### Safe Storage (Electron)

- Les conversations sont stockées **localement sur la machine**
- Le contenu est **chiffré au repos** via l’API `safeStorage` d’Electron
- Sur macOS, le chiffrement s’appuie sur le **Trousseau système (Keychain)**
- Les fichiers générés sont **illisibles** s’ils sont ouverts manuellement

Emplacement typique du fichier :

- macOS : `~/Library/Application Support/ECHONOX/chat-threads.enc`
- Windows : `%APPDATA%\\ECHONOX\\chat-threads.enc`
- Linux : `~/.config/ECHONOX/chat-threads.enc`

Aucune donnée n’est envoyée vers des services externes.

---

## ⌨️ Commandes intégrées (Chat)

Une fois ECHONOX lancé, certaines commandes peuvent être saisies directement dans le chat.

### Commandes disponibles

- `/new`  
  Démarre une **nouvelle conversation** (l’historique précédent est conservé).

D’autres commandes (rename, delete, résumé automatique) sont prévues.

---

## 🧪 Statut du projet

🚧 Projet expérimental / en évolution

ECHONOX est un terrain d’exploration :
 • comportement des LLM locaux
 • interaction homme / présence numérique
 • UI minimaliste et non intrusive

Ce n’est pas un produit fini, mais une base saine pour expérimenter.

---

## ⚖️ Licence

Ce projet est distribué sous licence open-source.
Voir le fichier LICENSE pour plus de détails.

Toute utilisation commerciale ou dérivée doit respecter l’esprit du projet :
transparence, respect des utilisateurs, et confidentialité.

---

## 🤍 Intention

ECHONOX est né d’une volonté simple :

reprendre le contrôle sur nos outils,
comprendre ce que l’on exécute,
et redonner une place à des systèmes plus humains, plus calmes, et plus respectueux.

---

## 📌 Notes

 • Aucune donnée utilisateur n’est collectée
 • Aucun tracking
 • Aucun appel réseau externe par défaut

---

## ECHONOX — local, libre, et conscient
