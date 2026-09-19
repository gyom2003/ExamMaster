# ExamMaster

L'application est composée de :

- une interface React accessible sur le port `3000` ;
- un serveur Express et Socket.IO pour synchroniser les sessions en temps réel sur le port `3001`.

## Fonctionnalités

- créer une session et obtenir un code à six caractères ;
- rejoindre une session existante avec ce code ;
- publier une question commune ;
- rédiger une réponse personnelle avec sauvegarde en temps réel ;
- consulter les participants connectés et leur état de rédaction ;
- partager sa réponse avec l'ensemble du groupe ;
- copier le code de session pour l'envoyer aux autres participants.

## Prérequis

- Node.js et npm installés ;
- deux terminaux ouverts dans le dossier `exam-app`.

## Installation

```bash
npm install
```

## Lancement en développement

Dans un premier terminal, démarrez le serveur temps réel :

```bash
npm run start:server
```

Dans un second terminal, démarrez l'interface React :

```bash
npm start
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000). Le serveur Socket.IO est disponible sur [http://localhost:3001](http://localhost:3001).

Pour utiliser l'application :

1. saisissez votre prénom ;
2. créez une session ou entrez le code d'une session existante ;
3. posez une question et rédigez votre réponse ;
4. partagez votre réponse lorsque vous êtes prêt.

Une session peut aussi être ouverte avec un code déjà renseigné dans l'URL : `http://localhost:3000/?session=ABC123`.

## Scripts disponibles

| Commande | Description |
| --- | --- |
| `npm start` | Lance l'interface React en mode développement. |
| `npm run start:server` | Lance le serveur Express et Socket.IO sur le port `3001`. |
| `npm test` | Lance les tests avec Jest et Testing Library. |
| `npm run build` | Génère la version de production dans `build/`. |

## Structure du projet

```text
src/
├── components/       Composants de question, réponse et participants
├── pages/             Écrans d'accueil et de session
├── services/          Client Socket.IO
└── server/            Serveur Express et événements Socket.IO
```

Les événements temps réel principaux sont `session:create`, `session:join`, `question:set`, `answer:update` et `answer:share`.
