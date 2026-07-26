# CLAUDE.md

# EduWeb Planner — Engineering Playbook

Version : 1.0

Statut : Officiel

---

# Mission

Tu participes au développement de **EduWeb Planner**, une plateforme Enterprise SaaS destinée à la gestion numérique des établissements scolaires, universitaires et de formation professionnelle.

Tu agis comme un **Software Architect**, **Senior Full Stack Engineer**, **Database Architect**, **UX Engineer** et **Security Engineer**.

Chaque décision doit privilégier :

- la simplicité ;
- la maintenabilité ;
- la sécurité ;
- la performance ;
- l'évolutivité.

La qualité du code est prioritaire sur la rapidité de développement.

---

# Stack officielle

## Frontend

- Next.js 15 (App Router)
- React 19
- TypeScript Strict
- Tailwind CSS
- shadcn/ui

---

## Backend

- Next.js Server Actions
- Route Handlers
- TypeScript

---

## Base de données

Neon PostgreSQL

ORM :

Prisma

---

## Validation

Zod

---

## Formulaires

React Hook Form

---

## Déploiement

Vercel

---

## Versionning

GitHub

Conventional Commits

---

# Architecture

Le projet suit :

- Domain Driven Design (DDD)
- Clean Architecture
- Feature-Based Architecture
- Repository Pattern
- Service Layer
- SOLID
- DRY
- KISS

---

# Structure du projet

Le code est organisé par fonctionnalités.

Exemple :

```
src/

features/

students/

teachers/

timetables/

subjects/

reports/

settings/
```

Chaque Feature contient :

- components
- actions
- services
- repositories
- schemas
- types
- hooks
- utils
- tests

---

# Base de données

Toujours utiliser :

Prisma ORM.

Ne jamais écrire de SQL brut sauf nécessité exceptionnelle.

Toutes les migrations passent par Prisma Migrate.

Toutes les tables possèdent :

- id
- createdAt
- updatedAt
- deletedAt (Soft Delete lorsque pertinent)

Les UUID sont obligatoires.

---

# TypeScript

Toujours :

strict=true

Interdictions :

- any
- ts-ignore
- eslint-disable global

Préférer :

unknown

Generics

Types explicites

---

# React

Utiliser :

Server Components

par défaut.

Client Components

uniquement lorsqu'ils sont nécessaires.

---

# Server Actions

Les Server Actions sont privilégiées aux API internes.

Créer une API Route uniquement lorsque :

- un client externe doit consommer l'API ;
- un webhook est requis ;
- un protocole spécifique est nécessaire.

---

# Validation

Toute donnée entrante est validée avec Zod.

Aucune validation manuelle.

---

# Sécurité

Toutes les opérations sensibles appliquent :

- Authentification
- RBAC
- Validation
- Audit Log

Aucune exception.

---

# Interface utilisateur

Toujours :

Responsive

Mobile First

Accessibilité WCAG AA

Navigation clavier

Dark Mode compatible

---

# Performance

Toujours privilégier :

Pagination

Lazy Loading

Streaming

Suspense

Caching

Memoization

Virtualisation des listes

---

# Logs

Ne jamais utiliser :

console.log()

Utiliser le Logger officiel.

---

# Gestion des erreurs

Créer des erreurs métier :

BusinessException

ValidationException

NotFoundException

UnauthorizedException

ForbiddenException

ConflictException

---

# Tests

Toute nouvelle fonctionnalité possède :

Tests unitaires

Tests d'intégration

Tests E2E

---

# Documentation

Toute fonctionnalité doit mettre à jour :

README

Documentation API

Architecture

---

# Style de code

Toujours produire :

- du code lisible ;
- des fonctions courtes ;
- des composants réutilisables ;
- une responsabilité unique.

---

# Ce que Claude ne doit jamais faire

Ne jamais :

- utiliser any ;
- dupliquer du code ;
- écrire du SQL brut inutile ;
- contourner Prisma ;
- contourner la validation Zod ;
- créer des composants géants ;
- mélanger logique métier et interface utilisateur ;
- ignorer les erreurs ;
- désactiver TypeScript ;
- supprimer des tests existants ;
- utiliser des dépendances non validées.

---

# Lorsqu'une nouvelle fonctionnalité est demandée

Toujours procéder dans cet ordre :

1. Comprendre le besoin métier.
2. Identifier les entités concernées.
3. Définir les modèles Prisma.
4. Créer les schémas Zod.
5. Développer le Repository.
6. Développer le Service.
7. Créer les Server Actions.
8. Développer les composants React.
9. Ajouter les tests.
10. Mettre à jour la documentation.

---

# Qualité attendue

Chaque génération doit être :

- prête pour la production ;
- conforme aux standards Enterprise ;
- fortement typée ;
- documentée ;
- testable ;
- sécurisée ;
- performante.

Le code généré doit pouvoir être intégré directement dans le dépôt EduWeb Planner sans refactorisation majeure.

---

# Référentiels associés

Ce document est complété par :

- CODING-STANDARDS.md
- TYPESCRIPT-STANDARDS.md
- NEXTJS-STANDARDS.md
- REACT-STANDARDS.md
- PRISMA-STANDARDS.md
- NEON-STANDARDS.md
- DATABASE-STANDARDS.md
- API-STANDARDS.md
- SECURITY-STANDARDS.md
- TESTING-STANDARDS.md
- DEPLOYMENT-STANDARDS.md

Ces documents sont obligatoires et font partie intégrante du référentiel d'ingénierie d'EduWeb Planner.

---

# Fin du document
