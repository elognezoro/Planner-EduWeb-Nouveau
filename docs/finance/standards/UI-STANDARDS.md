---
title: EduWeb UI Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-030
authors:
  - EduWeb Architecture Team
---

# UI-STANDARDS.md

> Référentiel officiel du Design System et de l'interface utilisateur de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Identité visuelle
4. Palette de couleurs
5. Typographie
6. Grille de mise en page
7. Espacements
8. Icônes
9. Boutons
10. Champs de saisie
11. Formulaires
12. Cartes (Cards)
13. Tableaux de données
14. Navigation
15. Tableaux de bord
16. États visuels
17. Notifications
18. Modales et dialogues
19. Responsive Design
20. Accessibilité
21. Thèmes
22. Cohérence UX
23. Anti-patterns
24. Checklist

---

# 1. Objectifs

Le Design System EduWeb garantit :

- une identité visuelle cohérente ;
- une excellente expérience utilisateur ;
- une réutilisation maximale des composants ;
- une maintenance simplifiée ;
- une accessibilité conforme aux standards internationaux.

Toutes les applications EduWeb (Planner, Governance, Family, Booking, E-School et futurs modules) doivent utiliser ce référentiel.

---

# 2. Principes

L'interface utilisateur repose sur les principes suivants :

- Simplicité ;
- Lisibilité ;
- Cohérence ;
- Accessibilité ;
- Responsive by Default ;
- Component First.

L'utilisateur doit retrouver les mêmes comportements dans l'ensemble des modules.

---

# 3. Identité visuelle

Les éléments graphiques doivent refléter :

- l'éducation ;
- la confiance ;
- l'innovation ;
- la modernité ;
- la sobriété institutionnelle.

Le logo EduWeb est utilisé conformément à la charte graphique officielle.

---

# 4. Palette de couleurs

## Couleurs principales

| Usage | Couleur |
|--------|----------|
| Couleur primaire | Vert bouteille EduWeb |
| Couleur secondaire | Blanc |
| Texte principal | Gris très foncé |
| Fond principal | Blanc cassé |

---

## Couleurs fonctionnelles

| Fonction | Couleur |
|-----------|----------|
| Succès | Vert |
| Information | Bleu |
| Avertissement | Orange |
| Erreur | Rouge |
| Désactivé | Gris |

Les couleurs doivent être définies via les tokens Tailwind et non directement dans les composants.

---

# 5. Typographie

Police officielle :

```
Geist Sans
```

Police technique :

```
Geist Mono
```

Hiérarchie recommandée :

| Élément | Taille |
|----------|--------:|
| H1 | 36 px |
| H2 | 30 px |
| H3 | 24 px |
| H4 | 20 px |
| Corps | 16 px |
| Petit texte | 14 px |
| Légende | 12 px |

La lisibilité prime sur les effets graphiques.

---

# 6. Grille de mise en page

Toutes les pages utilisent une grille cohérente.

Structure recommandée :

```
Header

↓

Sidebar

↓

Main Content

↓

Footer
```

Les largeurs maximales sont définies pour optimiser la lecture sur les grands écrans.

---

# 7. Espacements

Utiliser exclusivement l'échelle Tailwind.

Exemples :

```
2

4

6

8

12

16

24

32
```

Les espacements arbitraires sont interdits.

---

# 8. Icônes

Bibliothèque officielle :

```
Lucide Icons
```

Les icônes doivent :

- être cohérentes ;
- être compréhensibles ;
- être accompagnées d'un texte lorsque nécessaire.

Éviter l'utilisation excessive d'icônes décoratives.

---

# 9. Boutons

Types de boutons :

## Primary

Action principale.

---

## Secondary

Action secondaire.

---

## Outline

Action discrète.

---

## Ghost

Navigation ou action légère.

---

## Destructive

Suppression ou action irréversible.

Les boutons possèdent des états :

- normal ;
- hover ;
- focus ;
- disabled ;
- loading.

---

# 10. Champs de saisie

Tous les champs doivent proposer :

- label ;
- placeholder pertinent ;
- aide contextuelle (si nécessaire) ;
- validation ;
- message d'erreur.

Les labels ne doivent jamais être remplacés uniquement par des placeholders.

---

# 11. Formulaires

Tous les formulaires utilisent :

- React Hook Form ;
- Zod ;
- composants shadcn/ui.

Les champs obligatoires sont clairement identifiés.

Les erreurs apparaissent à proximité du champ concerné.

---

# 12. Cartes (Cards)

Les cartes sont utilisées pour :

- tableaux de bord ;
- fiches ;
- statistiques ;
- profils ;
- rapports.

Structure recommandée :

```
Header

↓

Content

↓

Footer
```

Les ombres restent discrètes.

---

# 13. Tableaux de données

Les tableaux proposent :

- pagination ;
- tri ;
- recherche ;
- filtres ;
- export.

Les lignes sont facilement sélectionnables.

Les actions sont regroupées dans une colonne dédiée.

---

# 14. Navigation

Navigation principale :

- barre latérale ;
- fil d'Ariane ;
- menus contextuels.

Navigation secondaire :

- onglets ;
- menus déroulants.

L'utilisateur doit toujours savoir où il se trouve.

---

# 15. Tableaux de bord

Les dashboards présentent :

- indicateurs clés ;
- graphiques ;
- alertes ;
- activités récentes.

Les informations critiques apparaissent en priorité.

---

# 16. États visuels

Chaque composant prévoit les états suivants :

- vide ;
- chargement ;
- succès ;
- erreur ;
- désactivé.

Les Skeletons remplacent les écrans vides durant le chargement.

---

# 17. Notifications

Types :

- succès ;
- information ;
- avertissement ;
- erreur.

Les notifications sont :

- courtes ;
- explicites ;
- temporaires lorsque possible.

Les erreurs critiques nécessitent une action utilisateur.

---

# 18. Modales et dialogues

Les modales sont réservées :

- aux confirmations ;
- aux éditions rapides ;
- aux informations importantes.

Éviter l'imbrication de plusieurs modales.

Chaque dialogue propose :

- titre ;
- contenu ;
- action principale ;
- action d'annulation.

---

# 19. Responsive Design

Approche :

```
Mobile First
```

Breakpoints recommandés :

```
sm

md

lg

xl

2xl
```

Les composants s'adaptent automatiquement aux différentes tailles d'écran.

---

# 20. Accessibilité

Conformité visée :

```
WCAG 2.2 AA
```

Exigences :

- navigation clavier complète ;
- focus visible ;
- contraste suffisant ;
- textes alternatifs ;
- rôles ARIA lorsque nécessaires ;
- ordre logique de navigation.

Les composants shadcn/ui ne doivent pas perdre leurs propriétés d'accessibilité.

---

# 21. Thèmes

Deux thèmes officiels :

- Clair ;
- Sombre.

Les couleurs sont définies via des variables de thème.

Le changement de thème ne modifie jamais la structure de l'interface.

---

# 22. Cohérence UX

Les règles suivantes sont obligatoires :

- mêmes icônes pour les mêmes actions ;
- mêmes couleurs pour les mêmes états ;
- mêmes composants pour les mêmes usages ;
- mêmes raccourcis clavier lorsque possible ;
- mêmes messages d'erreur.

L'expérience utilisateur doit être homogène sur toutes les applications EduWeb.

---

# 23. Anti-patterns

Interdits :

❌ Couleurs définies directement dans les composants.

❌ Plusieurs styles de boutons pour une même action.

❌ Icônes sans signification.

❌ Formulaires incohérents.

❌ Modales imbriquées.

❌ Tableaux sans pagination.

❌ Contraste insuffisant.

❌ Animations excessives.

❌ Utilisation de plusieurs bibliothèques UI concurrentes.

❌ Composants dupliqués au lieu d'être mutualisés.

---

# 24. Checklist

Avant chaque mise en production :

- [ ] Couleurs conformes à la charte.
- [ ] Typographie homogène.
- [ ] Responsive validé.
- [ ] Accessibilité contrôlée.
- [ ] Formulaires uniformes.
- [ ] Boutons cohérents.
- [ ] Icônes normalisées.
- [ ] Notifications homogènes.
- [ ] Thèmes testés.
- [ ] Composants documentés.

---

# Documents associés

- FRONTEND-STANDARDS.md
- REACT-STANDARDS.md
- NEXTJS-STANDARDS.md
- ACCESSIBILITY-STANDARDS.md
- PERFORMANCE-STANDARDS.md
- DESIGN-TOKENS.md *(à créer)*
- SHADCN-GUIDE.md *(à créer)*

---

# Fin du document
