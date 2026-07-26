---
title: EduWeb Coding Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-001
authors:
  - EduWeb Architecture Team
---

# CODING-STANDARDS.md

# EduWeb Enterprise Coding Standards

> Référentiel officiel de développement logiciel de l'écosystème EduWeb.

---

# Sommaire

1. Philosophie
2. Principes fondamentaux
3. TypeScript
4. Organisation du code
5. Conventions de nommage
6. Fonctions
7. Classes
8. Interfaces
9. Gestion des erreurs
10. Logging
11. Documentation
12. Sécurité
13. Performance
14. Bonnes pratiques
15. Anti-patterns
16. Checklist avant Commit

---

# 1. Philosophie

Le code produit pour EduWeb doit être :

- simple ;
- lisible ;
- fortement typé ;
- maintenable ;
- sécurisé ;
- performant ;
- documenté ;
- testable.

Le coût de maintenance est considéré comme plus important que la vitesse de développement.

---

# 2. Principes fondamentaux

Tous les développements respectent les principes suivants :

- SOLID
- DRY
- KISS
- YAGNI
- Clean Code
- Clean Architecture
- Domain Driven Design
- Feature First
- Security by Design

---

# 3. TypeScript

## Obligatoire

Le projet fonctionne exclusivement en :

- TypeScript Strict.

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true
}
```

---

## Interdictions

Interdits :

```typescript
any

//@ts-ignore

//@ts-nocheck
```

Préférer :

```typescript
unknown

Record<string, unknown>

Generic<T>
```

---

# 4. Organisation du code

Chaque fonctionnalité possède son propre dossier.

Exemple :

```
features/

students/

components/

actions/

repositories/

services/

schemas/

types/

hooks/

utils/

tests/
```

Aucune logique métier dans les composants React.

---

# 5. Conventions de nommage

## Composants

Toujours :

```text
StudentCard

TeacherTable

TimetableCalendar
```

---

## Hooks

Toujours :

```text
useStudents()

useTeachers()

useTimetable()
```

---

## Services

Toujours :

```text
StudentService

TeacherService
```

---

## Repository

Toujours :

```text
StudentRepository

RoomRepository
```

---

## DTO

Toujours :

```text
StudentDTO

TeacherDTO
```

---

## Schémas

Toujours :

```text
StudentSchema

TeacherSchema
```

---

# 6. Fonctions

Une fonction :

- possède une responsabilité unique ;
- est courte ;
- est facilement testable.

Préférer :

```typescript
calculateAverage()
```

À :

```typescript
process()
```

Longueur recommandée :

≤ 30 lignes.

---

# 7. Classes

Une classe représente une responsabilité métier.

Préférer :

```text
StudentService

AttendanceService

ReportGenerator
```

Éviter les classes "God Objects".

---

# 8. Interfaces

Toujours utiliser des interfaces explicites.

Exemple :

```typescript
interface Student {

id: string;

lastname: string;

firstname: string;

birthDate: Date;

}
```

---

# 9. Gestion des erreurs

Créer des exceptions métier.

```text
ValidationException

BusinessException

ConflictException

UnauthorizedException

ForbiddenException

NotFoundException
```

Ne jamais masquer une erreur.

---

# 10. Logging

Interdiction :

```typescript
console.log()
```

Toujours utiliser :

```typescript
logger.info()

logger.warn()

logger.error()
```

Chaque erreur critique est journalisée.

---

# 11. Documentation

Toutes les fonctions publiques comportent une documentation.

Exemple :

```typescript
/**
 * Calcule la moyenne annuelle d'un élève.
 */
```

---

# 12. Sécurité

Toute entrée utilisateur est validée.

Toujours :

- Zod ;
- Authentification ;
- RBAC ;
- Audit.

Jamais :

- concaténation SQL ;
- validation côté client uniquement.

---

# 13. Performance

Toujours privilégier :

- pagination ;
- lazy loading ;
- cache ;
- streaming ;
- virtualisation.

Éviter :

- les requêtes N+1 ;
- les boucles inutiles ;
- les traitements bloquants.

---

# 14. Bonnes pratiques

✓ Fonctions courtes.

✓ Composants réutilisables.

✓ Imports organisés.

✓ Typage explicite.

✓ Aucun code mort.

✓ Réutilisation maximale.

✓ Tests systématiques.

✓ Messages d'erreur compréhensibles.

✓ Documentation maintenue.

---

# 15. Anti-patterns

Interdits :

❌ any

❌ console.log

❌ SQL brut inutile

❌ Composants de 800 lignes

❌ Fonction faisant plusieurs traitements

❌ Duplication de code

❌ Variables à une lettre

❌ Copier-coller

❌ Logique métier dans React

❌ Validation manuelle

---

# 16. Checklist avant Commit

Avant chaque Commit :

- [ ] Le projet compile.
- [ ] ESLint ne signale aucune erreur.
- [ ] Prettier est appliqué.
- [ ] Les tests passent.
- [ ] Aucun `console.log`.
- [ ] Aucun `TODO` oublié.
- [ ] Documentation mise à jour.
- [ ] Code relu.
- [ ] Sécurité vérifiée.
- [ ] Performance vérifiée.

---

# Documents associés

- CLAUDE.md
- TYPESCRIPT-STANDARDS.md
- NEXTJS-STANDARDS.md
- REACT-STANDARDS.md
- PRISMA-STANDARDS.md
- DATABASE-STANDARDS.md
- API-STANDARDS.md
- SECURITY-STANDARDS.md

---

# Fin du document
