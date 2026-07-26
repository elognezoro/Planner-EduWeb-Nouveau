---
title: EduWeb Prisma Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-005
authors:
  - EduWeb Architecture Team
---

# PRISMA-STANDARDS.md

> Référentiel officiel Prisma ORM de l'écosystème EduWeb Planner.

---

# Sommaire

1. Philosophie
2. Stack officielle
3. Architecture Prisma
4. Organisation du projet
5. Conventions de nommage
6. Modélisation
7. Clés primaires
8. Relations
9. Champs d'audit
10. Soft Delete
11. Index
12. Contraintes
13. Enum
14. Transactions
15. Requêtes
16. Pagination
17. Performance
18. Migrations
19. Seed
20. Multi-environnement
21. Sécurité
22. Bonnes pratiques
23. Anti-patterns
24. Checklist

---

# 1. Philosophie

Prisma est **l'unique ORM autorisé** dans EduWeb.

Toutes les opérations sur Neon PostgreSQL passent par Prisma.

Le SQL brut est interdit sauf justification technique documentée.

---

# 2. Stack officielle

ORM

- Prisma

Base de données

- Neon PostgreSQL

Validation

- Zod

Backend

- Next.js Server Actions

---

# 3. Architecture Prisma

Toujours :

```
Server Action

↓

Service

↓

Repository

↓

Prisma Client

↓

Neon PostgreSQL
```

Le Client Prisma n'est jamais appelé directement depuis les composants React.

---

# 4. Organisation du projet

```
prisma/

schema.prisma

migrations/

seed.ts

lib/

prisma.ts

repositories/

student.repository.ts

teacher.repository.ts
```

---

# 5. Conventions de nommage

Les modèles utilisent le PascalCase.

```
Student

Teacher

School

Timetable

Attendance
```

Les propriétés utilisent le camelCase.

```
firstName

lastName

birthDate
```

Les tables générées utilisent le snake_case uniquement si une convention explicite est définie via `@@map`.

---

# 6. Modélisation

Chaque modèle représente une entité métier unique.

Exemple :

```prisma
model Student {

id String @id @default(uuid())

registrationNumber String @unique

lastName String

firstName String

}
```

Les modèles ne doivent pas mélanger plusieurs responsabilités.

---

# 7. Clés primaires

Toutes les tables utilisent :

```prisma
id String @id @default(uuid())
```

Les identifiants auto-incrémentés sont interdits sauf besoin spécifique documenté.

---

# 8. Relations

Toujours expliciter les relations.

Exemple :

```prisma
model Student {

classId String

class SchoolClass

@relation(fields:[classId],references:[id])

}
```

Les relations implicites sont évitées lorsqu'elles nuisent à la lisibilité.

---

# 9. Champs d'audit

Toutes les entités persistantes possèdent au minimum :

```prisma
createdAt DateTime @default(now())

updatedAt DateTime @updatedAt
```

Lorsque pertinent :

```prisma
createdBy String?

updatedBy String?
```

---

# 10. Soft Delete

Les suppressions physiques sont évitées.

Utiliser :

```prisma
deletedAt DateTime?
```

Les requêtes métier excluent par défaut les enregistrements supprimés.

---

# 11. Index

Indexer systématiquement :

- clés étrangères ;
- colonnes de recherche fréquente ;
- colonnes de tri ;
- colonnes de filtrage.

Exemple :

```prisma
@@index([classId])

@@index([lastName])

@@index([registrationNumber])
```

---

# 12. Contraintes

Utiliser :

```prisma
@unique
```

pour les identifiants fonctionnels.

Exemple :

```prisma
registrationNumber
```

Les contraintes composites utilisent :

```prisma
@@unique([...])
```

---

# 13. Enum

Les valeurs fermées utilisent des enum Prisma.

Exemple :

```prisma
enum Gender {

MALE

FEMALE

}
```

Éviter les chaînes de caractères libres pour les domaines fermés.

---

# 14. Transactions

Toute opération impliquant plusieurs écritures utilise :

```typescript
await prisma.$transaction(async (tx) => {

...
});
```

Les transactions garantissent la cohérence des données.

---

# 15. Requêtes

Toujours privilégier :

```typescript
select
```

plutôt que :

```typescript
include
```

lorsque seules quelques colonnes sont nécessaires.

Limiter les données retournées au strict nécessaire.

---

# 16. Pagination

Toute liste potentiellement volumineuse est paginée.

Utiliser :

```typescript
take

skip

cursor
```

Préférer la pagination par curseur pour les grandes tables.

---

# 17. Performance

Bonnes pratiques :

- éviter les requêtes N+1 ;
- sélectionner uniquement les colonnes utiles ;
- limiter les jointures inutiles ;
- indexer les champs fréquemment utilisés ;
- analyser régulièrement les plans d'exécution.

---

# 18. Migrations

Toutes les évolutions passent par :

```bash
prisma migrate dev
```

En production :

```bash
prisma migrate deploy
```

Les migrations sont versionnées dans Git.

Ne jamais modifier une migration déjà appliquée.

---

# 19. Seed

Le projet dispose d'un fichier unique :

```
prisma/seed.ts
```

Les données de démonstration sont idempotentes.

Les seeds ne doivent jamais contenir de mots de passe en clair.

---

# 20. Multi-environnement

Les environnements sont séparés :

- Development
- Test
- Staging
- Production

Chaque environnement utilise sa propre base Neon.

Aucun partage de données entre environnements.

---

# 21. Sécurité

Toujours :

- utiliser les paramètres Prisma ;
- éviter toute concaténation SQL ;
- limiter les privilèges de la base ;
- chiffrer les connexions via TLS.

Les accès à la base passent exclusivement par Prisma.

---

# 22. Bonnes pratiques

✓ UUID pour toutes les clés primaires.

✓ Champs d'audit sur toutes les entités.

✓ Soft Delete lorsque pertinent.

✓ Transactions pour les opérations critiques.

✓ Pagination des listes.

✓ Index adaptés.

✓ Migrations versionnées.

✓ Sélection explicite des colonnes.

---

# 23. Anti-patterns

Interdits :

❌ SQL brut sans justification.

❌ SELECT implicite de toutes les colonnes.

❌ Tables sans index.

❌ Relations non documentées.

❌ Suppressions physiques non justifiées.

❌ Modèles "God Object".

❌ Migrations modifiées après déploiement.

❌ Accès Prisma depuis un Client Component.

---

# 24. Checklist

Avant chaque Pull Request :

- [ ] Modèles conformes aux conventions.
- [ ] UUID utilisés.
- [ ] Champs d'audit présents.
- [ ] Index vérifiés.
- [ ] Contraintes vérifiées.
- [ ] Relations explicites.
- [ ] Migration générée.
- [ ] Seed mis à jour si nécessaire.
- [ ] Tests passés.
- [ ] Documentation mise à jour.

---

# Documents associés

- CLAUDE.md
- CODING-STANDARDS.md
- TYPESCRIPT-STANDARDS.md
- NEXTJS-STANDARDS.md
- REACT-STANDARDS.md
- NEON-STANDARDS.md
- DATABASE-STANDARDS.md

---

# Fin du document
