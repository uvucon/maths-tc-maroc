export type Course = {
  id: string; order: number; semester: 1 | 2; title: string; short: string; duration: number;
  objective: string; prerequisite: string; concepts: string[]; lessons: string[];
  videoUrl: string; videoId: string; videoTitle: string; theme: string;
}

const raw: Omit<Course, 'order' | 'videoUrl' | 'videoId' | 'videoTitle' | 'theme'>[] = [
  { id:'ensembles-nombres', semester:1, title:'Ensembles de nombres', short:'N, Z, D, Q et R', duration:55, objective:'Reconnaître, représenter et comparer les ensembles de nombres.', prerequisite:'Aucun — point de départ', concepts:['Appartenance et inclusion','Intervalles de R','Réunion et intersection','Valeur absolue et distance'], lessons:['Les ensembles N, Z, D, Q, R','Intervalles et droite graduée','Opérations sur les ensembles','Synthèse et quiz'] },
  { id:'arithmetique-n', semester:1, title:'Arithmétique dans N', short:'Divisibilité et nombres premiers', duration:70, objective:'Maîtriser division euclidienne, PGCD et nombres premiers.', prerequisite:'Ensembles de nombres', concepts:['Divisibilité','Division euclidienne','PGCD et PPCM','Décomposition en facteurs premiers'], lessons:['Multiples et diviseurs','Division euclidienne','PGCD et algorithme d’Euclide','Exercices guidés'] },
  { id:'calcul-vectoriel', semester:1, title:'Calcul vectoriel dans le plan', short:'Vecteurs et colinéarité', duration:75, objective:'Calculer avec des vecteurs et établir la colinéarité.', prerequisite:'Repérage du collège', concepts:['Égalité de vecteurs','Somme de vecteurs','Relation de Chasles','Colinéarité'], lessons:['Notion de vecteur','Somme et produit par un réel','Coordonnées','Colinéarité'] },
  { id:'projection-plan', semester:1, title:'Projection dans le plan', short:'Projections et Thalès', duration:50, objective:'Utiliser la projection pour démontrer des rapports.', prerequisite:'Calcul vectoriel', concepts:['Projection parallèle','Conservation du milieu','Théorème de Thalès','Rapports algébriques'], lessons:['Projection sur une droite','Propriétés','Thalès direct','Applications'] },
  { id:'ordre-r', semester:1, title:'Ordre dans R', short:'Comparaisons et encadrements', duration:65, objective:'Comparer, encadrer et manipuler les inégalités.', prerequisite:'Ensembles de nombres', concepts:['Ordre et opérations','Encadrements','Valeur absolue','Intervalles'], lessons:['Règles de comparaison','Encadrer une somme et un produit','Valeur absolue','Problèmes'] },
  { id:'droite-plan', semester:1, title:'Droite dans le plan', short:'Repères et équations', duration:80, objective:'Déterminer et exploiter l’équation d’une droite.', prerequisite:'Calcul vectoriel', concepts:['Repère du plan','Vecteur directeur','Équation cartésienne','Positions relatives'], lessons:['Coordonnées','Équation de droite','Parallélisme','Intersection de droites'] },
  { id:'polynomes', semester:1, title:'Polynômes', short:'Opérations et factorisation', duration:85, objective:'Calculer, factoriser et chercher les racines d’un polynôme.', prerequisite:'Calcul littéral', concepts:['Degré et coefficients','Opérations','Identités remarquables','Racines et factorisation'], lessons:['Vocabulaire','Opérations','Racines','Factorisation'] },
  { id:'equations-systemes', semester:1, title:'Équations, inéquations et systèmes', short:'Résoudre dans R', duration:95, objective:'Résoudre et interpréter équations, inéquations et systèmes.', prerequisite:'Ordre dans R · Polynômes', concepts:['Équations produit/quotient','Tableaux de signes','Inéquations','Systèmes 2×2'], lessons:['Équations','Signes et inéquations','Systèmes linéaires','Problèmes'] },
  { id:'trigonometrie-calcul', semester:1, title:'Trigonométrie 1', short:'Calcul trigonométrique', duration:70, objective:'Calculer avec les angles orientés et les rapports trigonométriques.', prerequisite:'Géométrie du collège', concepts:['Cercle trigonométrique','Radian','Sinus et cosinus','Relations fondamentales'], lessons:['Angles orientés','Cercle trigonométrique','Valeurs remarquables','Calculs'] },
  { id:'trigonometrie-equations', semester:2, title:'Trigonométrie 2', short:'Équations et inéquations', duration:75, objective:'Résoudre des équations et inéquations trigonométriques simples.', prerequisite:'Trigonométrie 1', concepts:['Équations trigonométriques','Périodicité','Inéquations sur le cercle','Solutions générales'], lessons:['Équations de base','Solutions sur un intervalle','Inéquations','Entraînement'] },
  { id:'fonctions', semester:2, title:'Généralités sur les fonctions', short:'Variations et représentations', duration:90, objective:'Étudier domaine, parité, variations et courbe d’une fonction.', prerequisite:'Équations et ordre', concepts:['Domaine de définition','Image et antécédent','Parité','Sens de variation'], lessons:['Définir une fonction','Lire une courbe','Parité','Variations'] },
  { id:'transformations-plan', semester:2, title:'Transformations du plan', short:'Translation, symétrie, rotation', duration:65, objective:'Reconnaître et construire les transformations usuelles.', prerequisite:'Calcul vectoriel', concepts:['Translation','Symétrie centrale','Symétrie axiale','Rotation'], lessons:['Translations','Symétries','Rotations','Compositions simples'] },
  { id:'produit-scalaire', semester:2, title:'Produit scalaire', short:'Orthogonalité et distances', duration:80, objective:'Calculer un produit scalaire et résoudre des problèmes métriques.', prerequisite:'Calcul vectoriel · Trigonométrie', concepts:['Définition géométrique','Formule analytique','Orthogonalité','Applications métriques'], lessons:['Produit scalaire','Calcul en coordonnées','Orthogonalité','Applications'] },
  { id:'geometrie-espace', semester:2, title:'Géométrie dans l’espace', short:'Plans et droites de l’espace', duration:85, objective:'Étudier positions relatives, parallélisme et orthogonalité.', prerequisite:'Géométrie du plan', concepts:['Droites et plans','Positions relatives','Parallélisme','Orthogonalité'], lessons:['Représenter l’espace','Positions relatives','Parallélisme','Orthogonalité'] },
  { id:'statistiques', semester:2, title:'Statistiques', short:'Séries et dispersion', duration:60, objective:'Résumer et interpréter une série statistique.', prerequisite:'Calcul numérique', concepts:['Effectifs et fréquences','Moyenne et médiane','Quartiles','Écart-type'], lessons:['Organiser les données','Indicateurs de position','Dispersion','Interprétation'] }
]

const videos: Record<string, Pick<Course, 'videoId' | 'videoTitle' | 'theme'>> = {
  'ensembles-nombres': { videoId:'g7rftsj2t8Y', videoTitle:'Cours 1 — Ensembles des nombres / exercices corrigés', theme:'Fondations & raisonnement' },
  'arithmetique-n': { videoId:'E6ej1J1Cu70', videoTitle:'Arithmétique dans N — Partie 1', theme:'Fondations & raisonnement' },
  'calcul-vectoriel': { videoId:'QTP2iJuTxtU', videoTitle:'Calcul vectoriel dans le plan — cours', theme:'Géométrie du plan' },
  'projection-plan': { videoId:'ZLJr_nXc4aM', videoTitle:'La projection dans le plan — résumé', theme:'Géométrie du plan' },
  'ordre-r': { videoId:'ePWzj1Oqhds', videoTitle:'Ordre dans R — leçon complète', theme:'Fondations & raisonnement' },
  'droite-plan': { videoId:'Gcqa4ULYFJ8', videoTitle:'La droite dans le plan — résumé complet', theme:'Géométrie du plan' },
  'polynomes': { videoId:'jCMMjkxl3R0', videoTitle:'Polynômes — cours complet', theme:'Algèbre & résolution' },
  'equations-systemes': { videoId:'ZWzFp3EEyRc', videoTitle:'Équations, inéquations et systèmes', theme:'Algèbre & résolution' },
  'trigonometrie-calcul': { videoId:'7sDnyXH23pc', videoTitle:'Trigonométrie — cours et exercices, partie 2', theme:'Trigonométrie & fonctions' },
  'trigonometrie-equations': { videoId:'37TxRh12rLw', videoTitle:'Équations et inéquations trigonométriques', theme:'Trigonométrie & fonctions' },
  'fonctions': { videoId:'YF1_lfDpDOk', videoTitle:'Généralités sur les fonctions — partie 1', theme:'Trigonométrie & fonctions' },
  'transformations-plan': { videoId:'7lZNSm5CLHo', videoTitle:'Transformations du plan — correction d’exercices', theme:'Géométrie du plan' },
  'produit-scalaire': { videoId:'qsndM7MXcJc', videoTitle:'Produit scalaire — partie 1', theme:'Géométrie du plan' },
  'geometrie-espace': { videoId:'B0BsNv7zDXo', videoTitle:'La géométrie dans l’espace — partie 1', theme:'Géométrie dans l’espace & données' },
  'statistiques': { videoId:'j7fQuVMXIe0', videoTitle:'Cours sur les statistiques — séance 1', theme:'Géométrie dans l’espace & données' },
}

export const courses: Course[] = raw.map((course, index) => ({
  ...course,
  ...videos[course.id],
  order:index + 1,
  videoUrl: `https://www.youtube.com/watch?v=${videos[course.id].videoId}`,
}))

export const themes = ['Fondations & raisonnement', 'Algèbre & résolution', 'Géométrie du plan', 'Trigonométrie & fonctions', 'Géométrie dans l’espace & données']

export const getCourse = (id: string) => courses.find(course => course.id === id) ?? courses[0]
