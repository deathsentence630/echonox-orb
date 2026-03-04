
# 🗺️ ECHONOX — Roadmap officielle

Cette roadmap décrit l’évolution du projet **ECHONOX** de manière claire, progressive et compréhensible par tous.
Chaque phase est pensée pour être **fonctionnelle, stable et cohérente** avant de passer à la suivante.

---

## 🧭 Principes directeurs

ECHONOX repose sur quelques règles non négociables :

- **Local-first** : aucune dépendance cloud par défaut
- **Présence calme** : l’outil ne sollicite jamais inutilement
- **Contrôle utilisateur** : aucune action opaque ou implicite
- **Automatisation maîtrisée** : jamais autonome sans validation
- **Lisibilité avant complexité**

La roadmap est **évolutive**, mais chaque phase constitue un **socle stable**.

---

## 🚧 Phase 0 — Fondations (état actuel)

### Objectif

Mettre en place une base technique saine, stable et compréhensible.

### Fonctionnalités

- Interface Electron minimaliste
- Orb visuelle animée (idle / listen / think / talk)
- Intégration LLM local (via Ollama)
- Architecture claire (main / renderer / UI)
- Stockage local sécurisé (Electron safeStorage)

### Critère de sortie
>
> L’application peut fonctionner durablement sans instabilité, sans dépendance externe, et sans surprise pour l’utilisateur.

---

## 🌱 Phase 1 — Interaction naturelle

### Objectif

Rendre l’interaction plus fluide et moins dépendante du clavier.

### Fonctionnalités

- Speech-to-Text (STT) local
- Text-to-Speech (TTS) local
- Activation / désactivation simple de la voix
- Réglages basiques (volume, vitesse, silence)
- Gestion affinée des états idle / écoute

### Critère de sortie
>
> Parler à ECHONOX est aussi simple et naturel qu’écrire.

---

## 🧠 Phase 2 — Mémoire & continuité

### Objectif

Assurer une continuité cohérente dans le temps, sans dérive ni intrusion.

### Fonctionnalités

- Mémoire locale explicite
  - mémoire courte (session)
  - mémoire longue (opt-in)
- Résumés automatiques de conversations
- Conversations nommables et organisables
- Recherche locale dans l’historique

### Règle clé
>
> Rien n’est mémorisé sans être visible, explicable et désactivable.

### Critère de sortie
>
> ECHONOX se souvient de manière utile, sans jamais devenir intrusif.

---

## 📚 Phase 3 — Spécialisation par RAG (Retrieval-Augmented Generation)

### Objectif

Permettre à ECHONOX de se spécialiser sur des corpus précis sans modifier le modèle de base,
tout en restant 100 % local et contrôlé.

### Fonctionnalités

- Intégration d’un système de RAG local
- Indexation de sources définies par l’utilisateur :
  - documents (PDF, Markdown, TXT, etc.)
  - notes personnelles
  - bases de connaissances locales
- Choix explicite des corpus utilisés pour chaque conversation
- Mise à jour et suppression des sources à la demande
- Séparation claire entre :
  - connaissances générales du modèle
  - connaissances injectées par RAG

### Règles clés

- Aucun document n’est indexé sans action explicite
- Les sources utilisées sont toujours visibles et listables
- Aucune remontée de données hors de la machine

### Cas d’usage visés

- Assistant spécialisé métier
- Support projet ou codebase locale
- Mémoire documentaire personnelle
- Analyse de corpus privés

### Critère de sortie
>
> ECHONOX peut répondre de manière spécialisée et fiable sur un domaine donné,
> tout en restant transparent sur l’origine de ses connaissances.

---

## 🤖 Phase 4 — Automatisation maîtrisée (Agent MCP)

### Objectif

Permettre à ECHONOX d’agir localement **avec** l’utilisateur, jamais à sa place.

### Fonctionnalités

- Intégration d’un agent MCP à périmètre limité
- Actions déclaratives possibles :
  - lecture de dossiers locaux
  - lancement de scripts autorisés
  - surveillance d’états locaux
- Gestion stricte des permissions
- Validation humaine systématique
- Retrait immédiat des accès possible

### Limites volontaires

- Pas d’accès global au système
- Pas d’autonomie complète
- Pas d’actions silencieuses

### Critère de sortie
>
> L’automatisation est compréhensible, utile et totalement contrôlée.

---

## 🧩 Phase 5 — Présence & personnalité

### Objectif

Donner à ECHONOX une identité perceptible sans anthropomorphisme excessif.

### Axes explorés

- Ajustement du ton (neutre, analytique, calme)
- Réactivité émotionnelle légère et non manipulatrice
- Évolution subtile de l’orb selon l’état
- Rythme d’intervention adaptatif

### Critère de sortie
>
> ECHONOX est reconnaissable, mais reste un outil conscient de ses limites.

---

## 🧪 Phase 6 — Expérimentations ouvertes

### Objectif

Explorer de nouvelles pistes sans impacter le socle stable.

### Exemples

- Plugins locaux
- Autres moteurs STT / TTS
- Autres modèles LLM
- Interfaces alternatives
- Mode headless (sans UI)

### Note

Ces fonctionnalités peuvent être instables et sont **hors scope par défaut**.

---

## 📌 Hors scope explicite (pour l’instant)

- Dépendance cloud obligatoire
- Surveillance réseau permanente
- Actions autonomes non validées
- Personnalité intrusive ou émotionnellement manipulatrice

---

## 🔄 Évolution de la roadmap

Cette roadmap peut évoluer selon :

- les retours utilisateurs
- les contraintes techniques
- les choix éthiques du projet

Toute évolution doit respecter les **principes directeurs** définis en tête de document.
