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

## 🚀 Démarrage rapide

### Prérequis
- Node.js récent
- npm
- Ollama installé et fonctionnel

### Installation du modèle (exemple)
```bash
ollama pull qwen2.5:7b
```
Lancer Ollama
```bash
ollama serve
```
Lancer l'application

```bash
LLM_MODEL="qwen2.5:7b" npm start
```
🧠 Modèles supportés

ECHONOX n’est pas lié à un modèle spécifique.
Tout modèle compatible avec l’API Ollama peut être utilisé.

Exemples testés / recommandés :
	•	qwen2.5:7b → bon équilibre qualité / stabilité / français
	•	llama3.2:3b → très rapide, plus léger
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

## 🧪 Statut du projet

🚧 Projet expérimental / en évolution

ECHONOX est un terrain d’exploration :
	•	comportement des LLM locaux
	•	interaction homme / présence numérique
	•	UI minimaliste et non intrusive

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
	•	Aucune donnée utilisateur n’est collectée
	•	Aucun tracking
	•	Aucun appel réseau externe par défaut

---

## ECHONOX — local, libre, et conscient.
