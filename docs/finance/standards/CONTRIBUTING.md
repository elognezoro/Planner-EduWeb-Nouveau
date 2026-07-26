---
title: EduWeb Contributing Guide
version: 1.0
status: Official
category: Engineering Governance
code: STD-039
authors:
  - EduWeb Architecture Team
---

# CONTRIBUTING.md

> Guide officiel de contribution aux projets de l'écosystème **EduWeb**.

---

# Sommaire

1. Objectif
2. Philosophie
3. Valeurs
4. Types de contributions
5. Gouvernance
6. Workflow Git
7. Gestion des branches
8. Convention des commits
9. Développement local
10. Qualité du code
11. Documentation
12. Tests
13. Pull Requests
14. Code Review
15. Gestion des Bugs
16. Gestion des Évolutions
17. Sécurité
18. Communication
19. Bonnes pratiques
20. Checklist

---

# 1. Objectif

Ce document décrit les règles officielles de contribution à l'ensemble des projets EduWeb.

Les objectifs sont :

- garantir la qualité du code ;
- assurer la cohérence technique ;
- faciliter la collaboration ;
- réduire la dette technique ;
- assurer la maintenabilité.

Tous les contributeurs doivent respecter ce document.

---

# 2. Philosophie

Les contributions reposent sur cinq principes fondamentaux :

- Simplicité
- Lisibilité
- Qualité
- Respect des standards
- Collaboration

Une contribution n'est pas évaluée uniquement sur sa capacité à fonctionner, mais également sur sa qualité de conception et sa facilité de maintenance.

---

# 3. Valeurs

Chaque contributeur s'engage à :

- travailler avec bienveillance ;
- documenter son travail ;
- accepter les retours de revue ;
- respecter les standards EduWeb ;
- favoriser le partage des connaissances.

---

# 4. Types de contributions

Les contributions acceptées comprennent notamment :

- nouvelles fonctionnalités ;
- corrections de bugs ;
- amélioration des performances ;
- optimisation de l'interface utilisateur ;
- documentation ;
- tests ;
- sécurité ;
- refactoring.

Toute contribution importante doit être précédée d'une spécification (`FEATURE-TEMPLATE.md`).

---

# 5. Gouvernance

Les principaux rôles sont :

| Rôle | Responsabilités |
|------|-----------------|
| Product Owner | Vision produit |
| Architecte | Validation technique |
| Lead Developer | Revue de code |
| Développeur | Développement |
| QA | Validation fonctionnelle |
| DevOps | Déploiement |
| Documentation | Mise à jour documentaire |

---

# 6. Workflow Git

Le workflow officiel est basé sur un **GitFlow simplifié**.

```text
main
 │
 ├── develop
 │      │
 │      ├── feature/*
 │      ├── fix/*
 │      ├── hotfix/*
 │      └── chore/*
 │
 └── release/*
```

La branche `main` contient uniquement du code prêt pour la production.

---

# 7. Gestion des branches

Conventions :

```text
feature/student-management

feature/timetable-generator

fix/authentication

hotfix/login

docs/api-update

refactor/planner

test/scheduler
```

Les noms doivent être :

- explicites ;
- en minuscules ;
- séparés par des tirets.

---

# 8. Convention des commits

Convention officielle :

```
Conventional Commits
```

Exemples :

```text
feat(planner): génération automatique des emplois du temps

fix(auth): correction du renouvellement de session

docs(api): ajout des exemples OpenAPI

refactor(database): simplification des repositories

test(planner): ajout des tests E2E

chore(ci): mise à jour du pipeline
```

Types autorisés :

- feat
- fix
- docs
- style
- refactor
- perf
- test
- build
- ci
- chore
- revert

---

# 9. Développement local

Avant toute contribution :

```bash
pnpm install

pnpm prisma generate

pnpm prisma migrate dev

pnpm dev
```

Le projet doit démarrer sans erreur.

---

# 10. Qualité du code

Avant toute Pull Request :

- TypeScript sans erreur ;
- ESLint sans erreur ;
- Prettier appliqué ;
- architecture respectée ;
- conventions de nommage respectées ;
- composants réutilisables.

Les standards officiels (`STD-001` à `STD-040`) font référence.

---

# 11. Documentation

Toute modification significative implique la mise à jour :

- README ;
- documentation technique ;
- documentation API ;
- ADR (si nécessaire) ;
- guides utilisateurs.

Une fonctionnalité non documentée est considérée comme incomplète.

---

# 12. Tests

Chaque contribution doit inclure les tests appropriés.

## Tests unitaires

- logique métier ;
- utilitaires ;
- composants.

## Tests d'intégration

- services ;
- base de données ;
- API.

## Tests E2E

- parcours critiques.

Les nouveaux développements ne doivent pas faire diminuer la couverture de tests.

---

# 13. Pull Requests

Chaque Pull Request comprend :

- un titre explicite ;
- une description ;
- le contexte ;
- les captures d'écran (si UI) ;
- les impacts ;
- les tests réalisés ;
- les références vers les tickets et ADR.

Les Pull Requests trop volumineuses sont à éviter.

---

# 14. Code Review

Chaque revue vérifie :

## Architecture

- respect du DDD ;
- découplage ;
- responsabilité unique.

## Qualité

- lisibilité ;
- duplication ;
- simplicité.

## Sécurité

- validation ;
- authentification ;
- autorisations.

## Performance

- complexité ;
- requêtes SQL ;
- cache.

Une Pull Request ne peut être fusionnée sans validation.

---

# 15. Gestion des Bugs

Chaque bug comprend :

| Champ | Description |
|--------|-------------|
| Identifiant | BUG-XXX |
| Gravité | Critique / Majeure / Mineure |
| Priorité | Haute / Moyenne / Faible |
| Reproductibilité | Oui / Non |
| Environnement | Dev / Test / Prod |

Les étapes de reproduction doivent être détaillées.

---

# 16. Gestion des Évolutions

Toute évolution suit le processus suivant :

```text
Besoin

↓

Analyse

↓

Feature Specification

↓

Développement

↓

Tests

↓

Revue

↓

Déploiement
```

Les évolutions majeures nécessitent une validation de l'architecture.

---

# 17. Sécurité

Les contributeurs doivent :

- protéger les secrets ;
- ne jamais versionner les fichiers `.env` ;
- appliquer les règles RBAC ;
- valider les données côté serveur ;
- signaler toute vulnérabilité.

Les dépendances sont régulièrement mises à jour.

---

# 18. Communication

Les échanges techniques doivent être :

- respectueux ;
- argumentés ;
- constructifs ;
- documentés.

Les décisions importantes sont formalisées via des ADR.

---

# 19. Bonnes pratiques

Toujours :

- développer par petites étapes ;
- écrire un code lisible ;
- supprimer le code mort ;
- éviter la duplication ;
- documenter les choix complexes ;
- maintenir les tests ;
- respecter les conventions.

Ne jamais :

- fusionner du code non testé ;
- contourner les revues ;
- ignorer les alertes de sécurité ;
- introduire une dépendance sans validation.

---

# 20. Checklist

## Développement

- [ ] Branche conforme
- [ ] Commits conformes
- [ ] Standards respectés

## Qualité

- [ ] Lint réussi
- [ ] TypeScript valide
- [ ] Tests réussis

## Documentation

- [ ] README mis à jour
- [ ] API documentée
- [ ] ADR créé si nécessaire

## Revue

- [ ] Pull Request complète
- [ ] Code Review validée
- [ ] Corrections appliquées

## Déploiement

- [ ] Checklist Release validée
- [ ] Migration vérifiée
- [ ] Changelog mis à jour

---

# Documents associés

- CLAUDE.md
- GIT-STANDARDS.md
- GITHUB-STANDARDS.md
- DOCUMENTATION-STANDARDS.md
- CHECKLIST-RELEASE.md
- ENGINEERING-HANDBOOK.md
- FEATURE-TEMPLATE.md
- MODULE-TEMPLATE.md
- API-TEMPLATE.md

---

# Fin du document
