---
title: EduWeb Git Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-027
authors:
  - EduWeb Architecture Team
---

# GIT-STANDARDS.md

> Référentiel officiel des bonnes pratiques Git de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Modèle de branches
4. Cycle de développement Git
5. Convention de nommage des branches
6. Convention des commits
7. Atomicité des commits
8. Synchronisation
9. Fusion des branches
10. Gestion des conflits
11. Rebase
12. Tags
13. Gestion des Releases
14. Signature des commits
15. Git Hooks
16. Bonnes pratiques
17. Historique Git
18. Anti-patterns
19. Checklist

---

# 1. Objectifs

Git constitue le système officiel de gestion de versions de tous les projets EduWeb.

Les objectifs sont :

- conserver l'historique complet ;
- faciliter la collaboration ;
- permettre les retours arrière ;
- assurer la traçabilité ;
- garantir la reproductibilité des versions.

---

# 2. Principes

EduWeb applique les principes suivants :

- Everything Versioned ;
- Small Commits ;
- Atomic Changes ;
- History Matters ;
- Reproducibility ;
- Traceability.

Chaque modification doit pouvoir être comprise plusieurs années après sa réalisation.

---

# 3. Modèle de branches

La stratégie Git officielle est inspirée de **GitFlow**.

```
main
│
├── develop
│
├── feature/*
│
├── fix/*
│
├── hotfix/*
│
└── release/*
```

### main

Version stable en production.

### develop

Branche d'intégration.

### feature

Développement d'une nouvelle fonctionnalité.

### fix

Correction non urgente.

### hotfix

Correction critique directement liée à la production.

### release

Préparation d'une nouvelle version.

---

# 4. Cycle de développement Git

Le cycle standard est :

```
Issue

↓

Feature Branch

↓

Commits

↓

Push

↓

Pull Request

↓

Review

↓

CI

↓

Merge

↓

Deployment
```

Aucune modification n'est intégrée directement dans `main`.

---

# 5. Convention de nommage des branches

Structure :

```
feature/<nom>

fix/<nom>

hotfix/<nom>

release/<version>
```

Exemples :

```
feature/student-import

feature/timetable-generator

fix/login-timeout

fix/pdf-export

hotfix/security-patch

release/v2.0.0
```

Les noms doivent être :

- explicites ;
- en anglais ;
- en minuscules ;
- séparés par des tirets.

---

# 6. Convention des commits

EduWeb adopte **Conventional Commits**.

Format :

```
type(scope): description
```

Types autorisés :

```
feat

fix

refactor

docs

style

test

perf

build

ci

chore

revert
```

Exemples :

```
feat(planner): generate automatic timetable

fix(auth): prevent session expiration

docs(api): update authentication guide

refactor(core): simplify dependency injection

perf(database): optimize teacher queries
```

---

# 7. Atomicité des commits

Chaque commit :

- réalise une seule modification logique ;
- compile ;
- passe les tests locaux ;
- reste compréhensible indépendamment.

Éviter :

```
Fixed many things
```

Préférer :

```
fix(student): validate duplicate registration
```

---

# 8. Synchronisation

Avant toute Pull Request :

```
git fetch

git pull

git rebase origin/develop
```

Les branches longues doivent être régulièrement synchronisées avec `develop`.

---

# 9. Fusion des branches

Les stratégies autorisées sont :

### Squash Merge

Par défaut.

Permet un historique propre.

---

### Merge Commit

Réservé aux grosses fonctionnalités.

---

### Rebase Merge

Utilisé lorsque l'historique doit rester linéaire.

Le choix dépend de la politique définie dans GitHub.

---

# 10. Gestion des conflits

Les conflits doivent être résolus :

- localement ;
- avant la Pull Request ;
- après synchronisation.

Après résolution :

- exécuter les tests ;
- vérifier la compilation ;
- relire les fichiers concernés.

---

# 11. Rebase

Le rebase est recommandé pour :

- conserver un historique linéaire ;
- supprimer les commits inutiles ;
- simplifier la revue.

Ne jamais effectuer un rebase sur une branche publique déjà partagée sans coordination avec l'équipe.

---

# 12. Tags

Toutes les versions officielles possèdent un tag.

Format :

```
v1.0.0

v1.2.3

v2.0.0
```

Les tags sont immuables.

---

# 13. Gestion des Releases

Chaque Release comprend :

- numéro de version ;
- changelog ;
- migrations éventuelles ;
- compatibilité ;
- date.

Les Releases sont créées uniquement à partir de `main`.

---

# 14. Signature des commits

Les commits doivent être signés lorsque l'infrastructure le permet.

Objectifs :

- authentifier l'auteur ;
- renforcer la confiance ;
- améliorer la sécurité.

Les signatures GPG ou SSH sont recommandées.

---

# 15. Git Hooks

Les Git Hooks permettent d'automatiser certains contrôles.

Exemples :

### pre-commit

- ESLint ;
- Prettier ;
- TypeScript.

### pre-push

- tests unitaires ;
- compilation.

Les Hooks ne remplacent jamais le pipeline CI.

---

# 16. Bonnes pratiques

Toujours :

- tirer les dernières modifications avant de commencer ;
- créer une branche dédiée ;
- écrire des commits explicites ;
- effectuer des Pull Requests courtes ;
- supprimer les branches fusionnées.

Limiter la durée de vie des branches de fonctionnalités.

---

# 17. Historique Git

L'historique doit être :

- lisible ;
- cohérent ;
- documenté ;
- utile.

Chaque commit raconte une étape identifiable de l'évolution du projet.

---

# 18. Anti-patterns

Interdits :

❌ Commits géants.

❌ Messages de commit vagues.

❌ Push direct sur `main`.

❌ Commits contenant des secrets.

❌ Historique réécrit sur une branche publique sans accord.

❌ Plusieurs fonctionnalités dans un même commit.

❌ Commit cassant la compilation.

❌ Commits sans lien avec une Issue.

---

# 19. Checklist

Avant toute Pull Request :

- [ ] Branche correctement nommée.
- [ ] Historique propre.
- [ ] Commits atomiques.
- [ ] Conventional Commits respectés.
- [ ] Compilation réussie.
- [ ] Tests locaux validés.
- [ ] Branche synchronisée.
- [ ] Conflits résolus.
- [ ] Documentation mise à jour.
- [ ] Branche supprimée après fusion.

---

# Documents associés

- GITHUB-STANDARDS.md
- CICD-STANDARDS.md
- DEPLOYMENT-STANDARDS.md
- CONTRIBUTING.md
- ENGINEERING-HANDBOOK.md
- TESTING-STANDARDS.md
- DOCUMENTATION-STANDARDS.md

---

# Fin du document
