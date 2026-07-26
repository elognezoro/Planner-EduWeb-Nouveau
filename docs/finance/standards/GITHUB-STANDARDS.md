---
title: EduWeb GitHub Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-026
authors:
  - EduWeb Architecture Team
---

# GITHUB-STANDARDS.md

> Référentiel officiel de gouvernance des dépôts GitHub de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Organisation GitHub
4. Structure des dépôts
5. Nommage des dépôts
6. Gouvernance des branches
7. Protection des branches
8. Pull Requests
9. Revue de code
10. Issues
11. Labels
12. Milestones
13. GitHub Projects
14. Releases
15. GitHub Actions
16. CODEOWNERS
17. Sécurité GitHub
18. Documentation
19. Archivage
20. Anti-patterns
21. Checklist

---

# 1. Objectifs

GitHub constitue la plateforme officielle de gestion du code source de l'ensemble des projets EduWeb.

Les objectifs sont :

- centraliser le développement ;
- assurer la qualité du code ;
- garantir la traçabilité ;
- faciliter la collaboration ;
- automatiser les workflows.

---

# 2. Principes

Les dépôts GitHub doivent respecter les principes suivants :

- Single Source of Truth ;
- Everything as Code ;
- Documentation First ;
- Security by Default ;
- Automation First.

Aucun développement officiel ne doit exister en dehors d'un dépôt GitHub.

---

# 3. Organisation GitHub

Les projets sont regroupés dans une organisation unique.

Exemple :

```
EduWeb
│
├── planner
├── governance
├── family
├── booking
├── e-school
├── shared-ui
├── shared-core
├── documentation
└── infrastructure
```

Chaque dépôt possède un responsable clairement identifié.

---

# 4. Structure des dépôts

Chaque dépôt contient au minimum :

```
README.md

LICENSE

CHANGELOG.md

CONTRIBUTING.md

CODE_OF_CONDUCT.md

CODEOWNERS

.github/

docs/

src/

tests/
```

La structure est homogène sur tous les projets.

---

# 5. Nommage des dépôts

Les noms utilisent exclusivement :

- minuscules ;
- tirets (`-`) ;
- anglais.

Exemples :

```
planner

planner-api

shared-ui

shared-core

notification-service

identity-service
```

À éviter :

```
PlannerFinal

EduWebProjet

Projet-Planning-2026
```

---

# 6. Gouvernance des branches

Branches autorisées :

```
main

develop

feature/*

fix/*

release/*

hotfix/*
```

La branche `main` représente toujours une version déployable.

---

# 7. Protection des branches

Les branches principales sont protégées.

Obligatoire :

- Pull Request ;
- revue de code ;
- pipeline CI réussi ;
- historique conservé.

Interdictions :

- push direct sur `main` ;
- suppression accidentelle ;
- merge sans validation.

---

# 8. Pull Requests

Chaque Pull Request comporte :

- un titre explicite ;
- une description ;
- le contexte ;
- les impacts ;
- les captures d'écran (si interface) ;
- les références aux Issues.

Exemple :

```
feat(planner):
Add automatic timetable conflict detection
```

Une Pull Request doit rester de taille raisonnable afin de faciliter la revue.

---

# 9. Revue de code

Chaque Pull Request est examinée selon :

## Qualité

- lisibilité ;
- simplicité ;
- cohérence.

## Architecture

- respect du DDD ;
- respect de la Clean Architecture.

## Sécurité

- absence de secrets ;
- validation des entrées ;
- gestion des erreurs.

## Performance

- requêtes optimisées ;
- absence de traitements inutiles.

La fusion nécessite au moins une approbation selon les règles du projet.

---

# 10. Issues

Chaque évolution ou anomalie fait l'objet d'une Issue.

Structure recommandée :

- résumé ;
- contexte ;
- description ;
- critères d'acceptation ;
- priorité ;
- estimation.

Une Issue représente une unité de travail clairement définie.

---

# 11. Labels

Jeu minimal de labels :

```
bug

feature

enhancement

documentation

security

performance

backend

frontend

database

api

ui

testing

refactoring

blocked

help wanted

good first issue
```

Les couleurs sont harmonisées entre tous les dépôts.

---

# 12. Milestones

Les Milestones regroupent les livraisons.

Exemple :

```
v1.0

v1.1

v2.0

Back-to-School 2027

National Deployment
```

Chaque Milestone possède :

- un objectif ;
- une date cible ;
- une liste d'Issues.

---

# 13. GitHub Projects

Les GitHub Projects pilotent les développements.

Colonnes recommandées :

```
Backlog

Ready

In Progress

Review

Testing

Done
```

Chaque carte correspond à une Issue ou une Pull Request.

---

# 14. Releases

Chaque Release comprend :

- numéro de version ;
- notes de version ;
- corrections ;
- nouvelles fonctionnalités ;
- migrations éventuelles ;
- compatibilités.

Les Releases sont créées à partir de tags Git.

---

# 15. GitHub Actions

GitHub Actions exécute automatiquement :

- lint ;
- tests ;
- build ;
- analyse de sécurité ;
- publication ;
- déploiement.

Les workflows sont versionnés dans :

```
.github/workflows/
```

---

# 16. CODEOWNERS

Chaque dépôt comporte un fichier :

```
CODEOWNERS
```

Exemple :

```
/src/domain/ @architecture-team

/src/modules/planner/ @planner-team

/docs/ @documentation-team
```

Les propriétaires sont automatiquement sollicités lors des revues.

---

# 17. Sécurité GitHub

Les fonctionnalités suivantes doivent être activées lorsque disponibles :

- Secret Scanning ;
- Dependabot Alerts ;
- Dependabot Updates ;
- CodeQL ;
- Branch Protection ;
- Signed Commits (recommandé) ;
- Two-Factor Authentication (2FA).

Les vulnérabilités critiques sont corrigées en priorité.

---

# 18. Documentation

Chaque dépôt contient une documentation à jour.

Documents minimaux :

- README ;
- guide d'installation ;
- architecture ;
- API (si applicable) ;
- guide de contribution ;
- journal des versions.

Toute évolution importante entraîne une mise à jour de la documentation.

---

# 19. Archivage

Un dépôt archivé :

- est en lecture seule ;
- ne reçoit plus de nouvelles fonctionnalités ;
- conserve son historique complet.

L'archivage est documenté et validé.

---

# 20. Anti-patterns

Interdits :

❌ Push direct sur `main`.

❌ Pull Requests sans revue.

❌ Issues sans description.

❌ Dépôt sans README.

❌ Commits volumineux sans justification.

❌ Secrets dans GitHub.

❌ Désactivation permanente des protections de branches.

❌ Fusion d'une Pull Request avec un pipeline en échec.

---

# 21. Checklist

Avant toute fusion :

- [ ] Issue associée.
- [ ] Pull Request documentée.
- [ ] Pipeline CI validé.
- [ ] Revue de code effectuée.
- [ ] Documentation mise à jour.
- [ ] Tests réussis.
- [ ] Release impact évalué.
- [ ] CODEOWNERS respecté.
- [ ] Labels renseignés.
- [ ] Milestone affectée.

---

# Documents associés

- GIT-STANDARDS.md
- CICD-STANDARDS.md
- DEPLOYMENT-STANDARDS.md
- CONTRIBUTING.md
- ENGINEERING-HANDBOOK.md
- TESTING-STANDARDS.md
- SECURITY-STANDARDS.md
- DOCUMENTATION-STANDARDS.md

---

# Fin du document
