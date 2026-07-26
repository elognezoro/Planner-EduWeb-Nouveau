---
title: Accessibility Standards
version: 1.0
status: Official
category: Enterprise Architecture
code: STD-049
authors:
  - EduWeb Architecture Team
---

# ACCESSIBILITY-STANDARDS.md

> Standard officiel de conception, de développement et de validation de l'accessibilité numérique des plateformes EduWeb.

---

# Sommaire

1. Objectif
2. Champ d'application
3. Références
4. Principes
5. Architecture de l'accessibilité
6. Structure HTML
7. Navigation clavier
8. Contrastes et couleurs
9. Typographie
10. Images et médias
11. Formulaires
12. Composants interactifs
13. Tableaux
14. Documents téléchargeables
15. Responsive Design
16. Internationalisation
17. Tests
18. Audit
19. Intelligence Artificielle
20. Anti-patterns
21. Checklist
22. Documents associés

---

# 1. Objectif

L'accessibilité garantit que chaque utilisateur puisse utiliser les plateformes EduWeb, indépendamment de ses capacités physiques, sensorielles ou cognitives.

Les objectifs sont :

- assurer l'égalité d'accès ;
- améliorer l'expérience utilisateur ;
- respecter les normes internationales ;
- faciliter l'utilisation sur tous les appareils ;
- garantir la conformité réglementaire.

---

# 2. Champ d'application

Le présent standard s'applique à :

- EduWeb Planner ;
- EduWeb Governance ;
- EduWeb Family ;
- EduWeb Booking ;
- E-School EduWeb ;
- applications mobiles ;
- Progressive Web Apps ;
- tableaux de bord ;
- documents PDF générés.

---

# 3. Références

Les développements doivent respecter notamment :

- WCAG 2.2 niveau AA (minimum) ;
- WAI-ARIA ;
- HTML5 sémantique ;
- RGAA (lorsqu'applicable) ;
- EN 301 549 (référence européenne).

---

# 4. Principes

Chaque interface doit être :

- perceptible ;
- utilisable ;
- compréhensible ;
- robuste.

Ces quatre principes constituent la base de toute conception.

---

# 5. Architecture de l'accessibilité

```text
Design System

↓

Composants UI

↓

Pages

↓

Tests automatiques

↓

Audit manuel

↓

Validation
```

L'accessibilité est intégrée dès la conception.

---

# 6. Structure HTML

Les pages utilisent une structure sémantique.

Exemple :

```html
<header>

<nav>

<main>

<section>

<article>

<footer>
```

Les balises génériques (`div`) ne remplacent jamais les balises sémantiques lorsqu'elles existent.

---

# 7. Navigation clavier

Toutes les fonctionnalités doivent être accessibles sans souris.

Exigences :

- ordre logique de tabulation ;
- indicateur de focus visible ;
- raccourcis documentés si présents ;
- aucun piège clavier.

Le focus ne doit jamais être masqué.

---

# 8. Contrastes et couleurs

Les couleurs ne constituent jamais le seul moyen de transmettre une information.

Contrastes recommandés :

| Élément | Ratio minimal |
|---------|---------------:|
| Texte normal | 4.5:1 |
| Grand texte | 3:1 |
| Icônes | 3:1 |

Les palettes EduWeb doivent être vérifiées avant toute mise en production.

---

# 9. Typographie

Les interfaces doivent permettre :

- le zoom à 200 % sans perte fonctionnelle ;
- une hauteur de ligne confortable ;
- des tailles adaptatives ;
- une bonne lisibilité.

Éviter les textes uniquement en majuscules.

---

# 10. Images et médias

Toutes les images informatives possèdent un texte alternatif.

Exemple :

```html
<img
  src="planning.png"
  alt="Emploi du temps hebdomadaire de la classe de Terminale A"
/>
```

Les images décoratives utilisent un attribut `alt=""`.

Les vidéos importantes comportent :

- sous-titres ;
- transcription lorsque nécessaire.

---

# 11. Formulaires

Les formulaires doivent comporter :

- un libellé (`label`) associé à chaque champ ;
- des messages d'erreur explicites ;
- une indication des champs obligatoires ;
- des aides contextuelles.

Les erreurs doivent être annoncées aux technologies d'assistance.

---

# 12. Composants interactifs

Tous les composants personnalisés doivent respecter WAI-ARIA.

Exemples :

- menus ;
- modales ;
- accordéons ;
- onglets ;
- listes déroulantes ;
- calendriers.

Les composants du Design System sont préférés aux implémentations ad hoc.

---

# 13. Tableaux

Les tableaux de données utilisent :

- `<table>` ;
- `<thead>` ;
- `<tbody>` ;
- `<th>` pour les en-têtes.

Les tableaux complexes incluent des en-têtes correctement associés aux cellules.

---

# 14. Documents téléchargeables

Les documents générés (PDF, Word, etc.) doivent :

- contenir une structure logique ;
- utiliser des titres hiérarchisés ;
- intégrer les métadonnées ;
- permettre la lecture par un lecteur d'écran lorsque le format le permet.

---

# 15. Responsive Design

Les interfaces restent utilisables sur :

- smartphone ;
- tablette ;
- ordinateur portable ;
- grand écran.

Aucune fonctionnalité ne doit disparaître sur mobile sans justification.

---

# 16. Internationalisation

Les composants accessibles doivent fonctionner avec :

- différentes langues ;
- textes plus longs ;
- écritures de droite à gauche (si supportées à l'avenir).

Les libellés ne doivent jamais être codés en dur.

---

# 17. Tests

Les tests comprennent :

### Automatiques

- analyse WCAG ;
- contraste ;
- structure HTML.

### Manuels

- navigation clavier ;
- lecteur d'écran ;
- zoom ;
- formulaires.

Les anomalies sont suivies jusqu'à leur résolution.

---

# 18. Audit

Chaque version majeure fait l'objet d'un audit d'accessibilité.

L'audit documente :

- les critères conformes ;
- les écarts ;
- les actions correctives ;
- la date de validation.

---

# 19. Intelligence Artificielle

L'IA peut assister :

- la génération de textes alternatifs ;
- la simplification de contenus ;
- la traduction ;
- la détection d'anomalies d'accessibilité.

Les propositions sont validées avant publication.

---

# 20. Anti-patterns

Les pratiques suivantes sont interdites :

- texte dans une image sans alternative ;
- contraste insuffisant ;
- absence de focus visible ;
- formulaire sans label ;
- contenu inaccessible au clavier ;
- messages d'erreur uniquement en couleur.

---

# 21. Checklist

## Structure

- [ ] HTML sémantique
- [ ] Titres hiérarchisés
- [ ] Navigation cohérente

### Interface

- [ ] Contrastes conformes
- [ ] Focus visible
- [ ] Responsive

### Contenus

- [ ] Textes alternatifs
- [ ] Sous-titres
- [ ] Formulaires accessibles

### Qualité

- [ ] Tests automatiques
- [ ] Audit manuel
- [ ] Corrections validées

---

# 22. Documents associés

## Standards fondamentaux

- STD-013 — ARCHITECTURE-STANDARDS
- STD-019 — FRONTEND-STANDARDS
- STD-020 — PERFORMANCE-STANDARDS
- STD-034 — UI-STANDARDS
- STD-040 — ENGINEERING-HANDBOOK

## Standards Enterprise

- STD-041 — MULTI-TENANCY-STANDARDS
- STD-042 — AUDIT-STANDARDS
- STD-045 — SEARCH-STANDARDS
- STD-046 — NOTIFICATION-STANDARDS
- STD-048 — AI-STANDARDS
- STD-050 — INTERNATIONALIZATION-STANDARDS

---

# Historique des versions

| Version | Date | Auteur | Description |
|---------:|------|--------|-------------|
| 1.0 | 2026 | EduWeb Architecture Team | Première version officielle |

---

# Fin du document
