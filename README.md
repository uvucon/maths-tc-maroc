# MathSprint TC

Application mobile-first en français pour apprendre les mathématiques du Tronc Commun Sciences marocain : 15 chapitres, cours vidéo, quiz et 45 exercices avec correction LLM configurable.

## Installation et lancement complet

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
cp .env.example .env
```

Éditer `.env` :

- `ADMIN_TOKEN` : secret long et aléatoire obligatoire pour consulter ou modifier la configuration depuis `/admin` ;
- `LLM_BASE_URL` : endpoint OpenAI-compatible, par défaut `https://api.openai.com/v1` ;
- `LLM_MODEL` : nom exact du modèle ;
- `LLM_API_KEY` : clé du fournisseur, côté serveur uniquement ;
- `HOST` et `PORT` : écoute Express, par défaut `127.0.0.1:4173`.

Puis lancer le build et le serveur Express qui sert `dist` :

```bash
npm run start
```

Ouvrir `http://127.0.0.1:4173`. La route `/admin` permet de remplacer temporairement l’URL, le modèle ou la clé. Le jeton admin saisi reste uniquement dans l’état React de la page. La clé est en écriture seule : les API de statut et l’interface ne la renvoient jamais.

### Développement Vite conservé

```bash
npm run dev -- --host 127.0.0.1
npm run preview -- --host 127.0.0.1
```

`npm run dev` ne lance pas Express : les appels `/api/*` nécessitent donc le serveur complet ou un proxy local. `npm run preview` sert uniquement le build Vite. Pour tester la correction de bout en bout, utiliser `npm run start`.

## Exercices et correction

Chaque chapitre expose exactement trois exercices topic-specific avec énoncé, type de réponse et barème. L’élève peut rédiger une solution et joindre au plus une image JPG/PNG/WebP ou un PDF de 5 Mo maximum. Les brouillons et les corrections réellement reçues sont enregistrés dans `localStorage` sous `mathsprint-tc-exercises-v1`. Une erreur ou une configuration LLM absente est affichée comme telle : l’interface ne fabrique pas de correction.

Le backend :

- valide `courseId` et `exerciseId` contre `shared/exercises.json` ;
- refuse réponse vide, identifiant arbitraire, type interdit et fichier supérieur à 5 Mo ;
- limite `/api/correct` à 10 requêtes par adresse IP sur 15 minutes ;
- appelle `/chat/completions` avec une consigne française, pédagogique, JSON strict et sans chaîne de pensée ;
- valide le JSON du fournisseur avant de le transmettre au navigateur ;
- ne journalise ni réponses d’élèves, ni octets joints, ni clés.

La configuration faite dans `/admin` vit seulement dans la mémoire du processus et disparaît au redémarrage. Pour une configuration durable, utiliser les variables d’environnement du serveur. Aucun secret `LLM_*` ou `ADMIN_TOKEN` ne doit être préfixé par `VITE_` : cela l’intégrerait au bundle public.

## Confidentialité et limites

Une demande de correction transmet le texte tapé au fournisseur LLM configuré. Informer les élèves des règles de confidentialité et de conservation de ce fournisseur avant un déploiement réel ; éviter toute donnée personnelle dans une copie.

Cette première implémentation accepte un fichier pour préparer le flux, mais n’envoie jamais ses octets au LLM : seules les métadonnées `nom`, `type MIME` et `taille` sont incluses dans la consigne et enregistrées avec la correction locale. Le serveur garde brièvement le fichier en mémoire pendant la requête puis le libère. L’interface le dit explicitement. Une analyse vision/PDF nécessiterait une implémentation fournisseur spécifique, une politique de confidentialité et des contrôles supplémentaires.

Le rate limiting est en mémoire et par processus. Derrière un proxy ou avec plusieurs instances, configurer correctement l’adresse IP de confiance et utiliser un magasin partagé avant la production. La configuration admin en mémoire n’est pas un gestionnaire de secrets. Utiliser HTTPS, un secret manager, des en-têtes de sécurité et un contrôle d’accès réseau pour un déploiement public.

Le séquençage et les barèmes doivent être validés par un enseignant marocain de mathématiques avant usage scolaire officiel.

## Vérification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Les tests Node utilisent un client LLM injecté et ne réalisent aucun appel réel. Ils couvrent la validation de configuration, les identifiants/réponses, l’indisponibilité sans clé, les pièces jointes, la limitation à 10 requêtes et la protection du statut admin.

## Programme

Les 15 chapitres couvrent ensembles, arithmétique, vecteurs, projection, ordre, droite, polynômes, équations/inéquations/systèmes, trigonométrie I & II, fonctions, transformations, produit scalaire, géométrie de l’espace et statistiques. Le séquençage s’appuie sur le référentiel public [Le Mathémagicien — Mathématiques Tronc Commun](https://lemathemagicien.ma/lycee/mathematiques-tronc-commun/), à valider par l’enseignant. MathSprint TC est indépendant.
