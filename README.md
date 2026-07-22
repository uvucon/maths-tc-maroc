# MathSprint TC

Première maquette interactive, en français, pour apprendre les mathématiques du **Tronc Commun Sciences marocain**.

## Lancer localement

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Build de production :

```bash
npm run typecheck
npm run lint
npm run build
npm run preview -- --host 127.0.0.1
```

## Contenu du premier draft

- 15 chapitres structurés en deux semestres : ensembles, arithmétique, vecteurs, projection, ordre, droite, polynômes, équations/inéquations/systèmes, trigonométrie I & II, fonctions, transformations, produit scalaire, géométrie de l’espace, statistiques.
- Chaque chapitre comprend une **vidéo YouTube intégrée**, sélectionnée selon le titre et la description de cours « Tronc Commun / TCS Maroc » trouvés publiquement, avec un lien direct pour l’ouvrir sur YouTube. La sélection pédagogique finale reste à valider par un enseignant.
- Le programme est aussi regroupé par compétences : fondations, algèbre, géométrie du plan, trigonométrie/fonctions, puis espace/données.
- Tableau de bord, parcours, lecteur de chapitre, étapes à cocher et quiz de validation.
- Suivi local : chapitres terminés, étapes, scores de quiz, XP, niveau, séries, focus de 15 minutes et reprise automatique.
- Révision espacée simple : les chapitres partiellement étudiés ou ayant le score le plus faible remontent dans « Révision ».
- Gamification volontairement légère : XP, badges, objectif hebdomadaire et sprint de concentration.

## Données et périmètre

Les données sont enregistrées uniquement dans `localStorage` sous la clé `mathsprint-tc-progress-v1`. Aucun compte ni serveur n’est nécessaire pour ce prototype. Le bouton Profil permet de réinitialiser ces données.

Le séquençage s’appuie sur le référentiel public [Le Mathémagicien — Mathématiques Tronc Commun](https://lemathemagicien.ma/lycee/mathematiques-tronc-commun/). **Référence de séquençage pour cette maquette, à valider par l’enseignant.**

Avant une mise en production : faire valider la granularité, les exercices, les vidéos et les évaluations par un enseignant marocain de mathématiques ; ajouter un catalogue vidéo curé avec consentement/licences et, si nécessaire, une authentification et une sauvegarde serveur.
