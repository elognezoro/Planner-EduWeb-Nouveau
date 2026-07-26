---
title: EduWeb Backend Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-012
authors:
  - EduWeb Architecture Team
---

# BACKEND-STANDARDS.md

> Référentiel officiel de développement Backend de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Philosophie
3. Architecture Backend
4. Organisation des dossiers
5. Couche Domaine
6. Couche Application
7. Couche Infrastructure
8. Repositories
9. Services
10. Server Actions
11. Route Handlers
12. Transactions
13. Gestion des erreurs
14. Validation
15. Journalisation
16. Tâches asynchrones
17. Planification des traitements
18. Événements métier
19. Performance
20. Sécurité
21. Tests
22. Documentation
23. Anti-patterns
24. Checklist

---

# 1. Objectifs

Le Backend EduWeb doit être :

- fiable ;
- sécurisé ;
- évolutif ;
- modulaire ;
- facilement testable ;
- indépendant de l'interface utilisateur.

La logique métier constitue le cœur du système.

---

# 2. Philosophie

Le Backend applique :

- Domain Driven Design (DDD)
- Clean Architecture
- SOLID
- Repository Pattern
- Service Layer
- Dependency Inversion Principle

Les frameworks sont considérés comme des détails d'implémentation.

---

# 3. Architecture Backend

Architecture officielle :

```
Client

↓

Server Action

↓

Application Service

↓

Domain Service

↓

Repository

↓

Prisma

↓

Neon PostgreSQL
```

Chaque couche possède une responsabilité unique.

---

# 4. Organisation des dossiers

Structure recommandée :

```
src/

features/

students/

actions/

services/

repositories/

schemas/

types/

validators/

events/

jobs/

hooks/

tests/
```

Les fonctionnalités sont isolées les unes des autres.

---

# 5. Couche Domaine

Le domaine contient :

- entités ;
- objets valeur ;
- règles métier ;
- événements métier ;
- services de domaine.

Cette couche ne dépend ni de Prisma, ni de Next.js.

---

# 6. Couche Application

La couche Application orchestre les cas d'usage.

Exemples :

- inscrire un élève ;
- générer un emploi du temps ;
- publier un bulletin ;
- affecter un enseignant.

Elle coordonne les services du domaine sans contenir de logique technique.

---

# 7. Couche Infrastructure

La couche Infrastructure contient :

- Prisma ;
- Neon ;
- stockage des fichiers ;
- envoi d'e-mails ;
- notifications ;
- intégrations externes.

Elle implémente les interfaces définies par le domaine.

---

# 8. Repositories

Chaque agrégat possède son Repository.

Exemples :

```
StudentRepository

TeacherRepository

SchoolRepository

TimetableRepository
```

Responsabilités :

- lecture ;
- écriture ;
- pagination ;
- recherche.

Les règles métier ne sont jamais implémentées dans un Repository.

---

# 9. Services

Deux catégories de services :

### Services de domaine

Ils implémentent les règles métier.

Exemple :

```
TimetableGeneratorService
```

### Services applicatifs

Ils orchestrent plusieurs services.

Exemple :

```
SchoolEnrollmentService
```

---

# 10. Server Actions

Les Server Actions constituent le point d'entrée principal.

Structure :

```
Validation

↓

Authentification

↓

Autorisation

↓

Service

↓

Repository

↓

Réponse
```

Les Server Actions restent légères et ne contiennent pas de logique métier.

---

# 11. Route Handlers

Utilisés uniquement pour :

- API publiques ;
- Webhooks ;
- OAuth ;
- intégrations externes ;
- export/import.

Les traitements suivent la même architecture que les Server Actions.

---

# 12. Transactions

Toute opération impliquant plusieurs écritures utilise :

```typescript
await prisma.$transaction(async (tx) => {
  ...
});
```

Les transactions doivent être courtes afin de limiter les verrous.

---

# 13. Gestion des erreurs

Utiliser des exceptions métier explicites.

Exemples :

```
ValidationException

BusinessException

ConflictException

NotFoundException

UnauthorizedException

ForbiddenException
```

Les erreurs sont converties en réponses homogènes.

---

# 14. Validation

Toutes les données entrantes sont validées avec Zod.

Ordre recommandé :

```
Requête

↓

Validation

↓

Transformation

↓

Service

↓

Repository
```

La logique métier ne s'exécute jamais sur des données non validées.

---

# 15. Journalisation

Utiliser un logger centralisé.

Niveaux :

- DEBUG
- INFO
- WARN
- ERROR

Chaque journal contient :

- identifiant utilisateur ;
- horodatage ;
- identifiant de requête ;
- contexte fonctionnel.

---

# 16. Tâches asynchrones

Les traitements longs sont exécutés de manière asynchrone.

Exemples :

- génération de rapports ;
- export Excel ;
- génération PDF ;
- envoi d'e-mails ;
- synchronisation avec des services externes.

Les tâches sont rejouables en cas d'échec.

---

# 17. Planification des traitements

Le Backend prend en charge des traitements planifiés.

Exemples :

- génération automatique des emplois du temps ;
- archivage annuel ;
- sauvegardes ;
- rappels aux parents ;
- notifications d'échéances ;
- recalcul des statistiques.

Les traitements sont idempotents et journalisés.

---

# 18. Événements métier

Le Backend peut publier des événements.

Exemples :

```
StudentCreated

TeacherAssigned

TimetablePublished

AttendanceValidated
```

Les événements facilitent le découplage des modules.

---

# 19. Performance

Objectifs :

- limiter les accès à la base ;
- privilégier les traitements batch ;
- utiliser le cache lorsque pertinent ;
- réduire les échanges réseau.

Les services ne doivent pas effectuer de requêtes redondantes.

---

# 20. Sécurité

Chaque traitement applique :

- authentification ;
- RBAC ;
- validation ;
- journalisation ;
- protection contre les injections.

Les secrets sont gérés via les variables d'environnement.

---

# 21. Tests

Chaque service possède :

- tests unitaires ;
- tests d'intégration ;
- jeux de données de démonstration.

Les cas d'erreur sont testés autant que les cas nominaux.

---

# 22. Documentation

Chaque service documente :

- son objectif ;
- ses paramètres ;
- ses dépendances ;
- ses exceptions ;
- ses événements publiés.

La documentation est maintenue avec le code.

---

# 23. Anti-patterns

Interdits :

❌ Logique métier dans les Server Actions.

❌ Accès direct à Prisma depuis React.

❌ Repositories contenant des règles métier.

❌ Services géants.

❌ Transactions longues.

❌ Validation manuelle dispersée.

❌ Duplication de logique métier.

❌ Appels synchrones bloquants pour des traitements lourds.

---

# 24. Checklist

Avant chaque Pull Request :

- [ ] Cas d'usage identifié.
- [ ] Validation Zod.
- [ ] Service dédié.
- [ ] Repository conforme.
- [ ] Transactions vérifiées.
- [ ] Journalisation présente.
- [ ] Gestion des erreurs homogène.
- [ ] Tests automatisés.
- [ ] Documentation mise à jour.
- [ ] Revue d'architecture validée.

---

# Documents associés

- CLAUDE.md
- API-STANDARDS.md
- ARCHITECTURE-STANDARDS.md
- DDD-STANDARDS.md
- SECURITY-STANDARDS.md
- TESTING-STANDARDS.md

---

# Fin du document
