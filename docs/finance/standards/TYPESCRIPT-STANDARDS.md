---
title: EduWeb TypeScript Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-002
authors:
  - EduWeb Architecture Team
---

# TYPESCRIPT-STANDARDS.md

> Référentiel officiel TypeScript de l'écosystème EduWeb.

---

# Sommaire

1. Philosophie
2. Configuration TypeScript
3. Types
4. Interfaces
5. Type Alias
6. Génériques
7. Fonctions
8. Classes
9. Enum
10. Modules
11. Imports
12. Null Safety
13. Async
14. Erreurs
15. Performance
16. Prisma
17. Zod
18. Bonnes pratiques
19. Anti-patterns
20. Checklist

---

# 1. Philosophie

Le projet EduWeb utilise exclusivement **TypeScript Strict**.

Objectifs :

- sécurité de typage ;
- auto-complétion maximale ;
- détection précoce des erreurs ;
- documentation implicite ;
- meilleure maintenabilité.

Le compilateur est considéré comme le premier niveau de tests.

---

# 2. Configuration TypeScript

Configuration minimale obligatoire :

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "forceConsistentCasingInFileNames": true,
  "useUnknownInCatchVariables": true
}
```

---

# 3. Types

Toujours préférer :

```typescript
type StudentId = string;

type SchoolCode = string;

type AcademicYear = string;
```

aux primitives directement utilisées partout.

Créer des types métier.

---

## Exemple

```typescript
type StudentStatus =
  | "ACTIVE"
  | "TRANSFERRED"
  | "SUSPENDED";
```

---

# 4. Interfaces

Les interfaces décrivent les objets métier.

Toujours :

```typescript
interface Student {

id: StudentId;

lastname: string;

firstname: string;

gender: Gender;

}
```

---

Ne jamais créer :

```typescript
interface Data

interface Item

interface Object
```

---

# 5. Type Alias

Préférer :

```typescript
type Gender =

"MALE"

|

"FEMALE";
```

---

Utiliser Type Alias pour :

- unions
- tuples
- mapped types
- utility types

---

# 6. Génériques

Toujours typer les génériques.

Bon :

```typescript
function paginate<T>(

items: T[]

): T[] {

return items;

}
```

---

Éviter :

```typescript
function paginate(items:any[])
```

---

# 7. Fonctions

Toujours typer :

- paramètres
- retour

Exemple :

```typescript
function calculateAverage(

grades:number[]

):number {

}
```

Jamais :

```typescript
function calculateAverage(grades)
```

---

# 8. Classes

Les classes doivent rester courtes.

Une classe :

↓

Une responsabilité.

---

Toujours :

```typescript
StudentService

TeacherRepository

AttendanceManager
```

---

# 9. Enum

Préférer :

```typescript
type
```

à

```typescript
enum
```

Sauf nécessité particulière.

---

Exemple :

```typescript
type UserRole =

"ADMIN"

|

"TEACHER"

|

"PARENT";
```

---

# 10. Modules

Chaque module exporte uniquement :

- ce qui est nécessaire.

Éviter :

```typescript
export *
```

---

# 11. Imports

Ordre :

```text
Node

↓

React

↓

Next

↓

Packages

↓

Features

↓

Shared

↓

Relative
```

Toujours utiliser les alias du projet lorsque disponibles.

---

# 12. Null Safety

Toujours utiliser :

```typescript
student?.lastname

teacher ?? defaultTeacher
```

Éviter :

```typescript
if(student!=null)
```

lorsqu'un opérateur natif est plus lisible.

---

# 13. Async

Toujours :

```typescript
async

await
```

Jamais :

```typescript
.then()

.catch()
```

chaînés.

---

Toujours gérer les erreurs.

```typescript
try{

...

}catch(error){

...
}
```

---

# 14. Erreurs

Toujours utiliser :

```typescript
BusinessException

ValidationException

ConflictException

NotFoundException
```

Éviter :

```typescript
throw "Erreur"
```

---

# 15. Performance

Éviter :

```typescript
any

unknown[]

object
```

Préférer :

types précis.

---

Limiter :

- copies inutiles
- objets volumineux
- transformations multiples.

---

# 16. Prisma

Toujours typer les résultats.

Bon :

```typescript
const student:

Student

=

await prisma.student.findUnique(...)
```

Préférer :

```typescript
select
```

à

```typescript
include
```

si seules quelques colonnes sont nécessaires.

---

Utiliser :

```typescript
Prisma.Transaction
```

pour les opérations critiques.

---

# 17. Zod

Tous les DTO possèdent :

```typescript
StudentSchema
```

Puis :

```typescript
type StudentDTO =

z.infer<

typeof StudentSchema

>;
```

Ne jamais dupliquer les types.

---

# 18. Bonnes pratiques

Toujours :

✓ TypeScript Strict

✓ Types métier

✓ Fonctions courtes

✓ Interfaces explicites

✓ Génériques

✓ Types réutilisables

✓ DTO Zod

✓ Repository typés

✓ Retour explicite

---

# 19. Anti-patterns

Interdits :

❌ any

❌ ts-ignore

❌ export *

❌ enum inutile

❌ object

❌ Function

❌ Promise<any>

❌ Variables implicites

❌ Return implicite complexe

❌ Typage dupliqué

---

# 20. Checklist

Avant chaque Pull Request :

- [ ] Aucun any.
- [ ] Aucun ts-ignore.
- [ ] Tous les retours sont typés.
- [ ] Toutes les fonctions sont documentées.
- [ ] Les interfaces sont explicites.
- [ ] Les types Zod sont réutilisés.
- [ ] Les erreurs sont correctement gérées.
- [ ] Les génériques sont typés.
- [ ] Le code compile sans avertissement.
- [ ] ESLint est vert.

---

# Documents associés

- CLAUDE.md
- CODING-STANDARDS.md
- NEXTJS-STANDARDS.md
- REACT-STANDARDS.md
- PRISMA-STANDARDS.md
- DATABASE-STANDARDS.md
- API-STANDARDS.md

---

# Fin du document
