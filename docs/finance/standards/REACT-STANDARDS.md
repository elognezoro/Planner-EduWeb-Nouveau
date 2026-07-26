---
title: EduWeb React Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-004
authors:
  - EduWeb Architecture Team
---

# REACT-STANDARDS.md

> Référentiel officiel React de l'écosystème EduWeb.

---

# Sommaire

1. Philosophie
2. Version officielle
3. Architecture des composants
4. Server Components
5. Client Components
6. Composition
7. Props
8. État (State)
9. Hooks
10. Context
11. Formulaires
12. Gestion des listes
13. Performance
14. Accessibilité
15. Gestion des erreurs
16. Bonnes pratiques
17. Anti-patterns
18. Checklist

---

# 1. Philosophie

React est utilisé pour construire :

- une interface modulaire ;
- des composants réutilisables ;
- une expérience utilisateur rapide ;
- une application facilement maintenable.

Le projet applique les principes :

- Composition over Inheritance
- Single Responsibility Principle
- Functional Programming
- Immutability
- Predictable State

---

# 2. Version officielle

Version officielle :

```
React 19
```

Toutes les nouvelles fonctionnalités doivent être compatibles avec cette version.

---

# 3. Architecture des composants

Organisation recommandée :

```
components/

ui/

layout/

forms/

tables/

cards/

dialogs/

navigation/

feedback/
```

Les composants métiers restent dans leur **Feature**.

Exemple :

```
features/

students/

components/

StudentCard.tsx

StudentForm.tsx

StudentTable.tsx
```

---

# 4. Server Components

Par défaut :

Tous les composants sont des **Server Components**.

Ils sont utilisés pour :

- lecture des données ;
- rendu initial ;
- SEO ;
- performances.

Ils ne doivent jamais contenir :

- useState
- useEffect
- événements utilisateur

---

# 5. Client Components

Utiliser uniquement lorsque nécessaire.

Exemples :

- formulaire
- drag & drop
- calendrier
- éditeur de texte
- graphique interactif

Déclaration obligatoire :

```tsx
"use client";
```

Ne jamais transformer un composant entier en Client Component lorsqu'un seul sous-composant suffit.

---

# 6. Composition

Toujours préférer :

```
Page

↓

Section

↓

Card

↓

Widget

↓

Button
```

Plutôt que :

```
Page géante de 1200 lignes
```

Les composants sont spécialisés.

---

# 7. Props

Toujours typer les props.

Exemple :

```tsx
interface StudentCardProps {

student: Student;

readonly?: boolean;

}
```

Éviter les props de type :

```tsx
any

object
```

---

# 8. État (State)

Utiliser `useState` uniquement pour :

- interactions utilisateur ;
- état local.

Ne jamais stocker :

- des données serveur ;
- des données Prisma.

Ces données restent dans les Server Components.

---

# 9. Hooks

Toujours utiliser les Hooks React officiels lorsque cela est approprié.

Hooks personnalisés :

```
useStudents()

useAttendance()

useTeachers()

useTimetable()
```

Chaque Hook :

- possède une responsabilité unique ;
- est documenté ;
- est facilement testable.

---

# 10. Context

Le Context React est réservé aux données globales :

- thème ;
- langue ;
- session utilisateur ;
- préférences.

Ne pas utiliser le Context pour remplacer une gestion correcte des données serveur.

---

# 11. Formulaires

Tous les formulaires utilisent :

- React Hook Form
- Zod

Structure :

```
Form

↓

React Hook Form

↓

Zod

↓

Server Action

↓

Prisma

↓

Neon
```

Les validations sont toujours partagées entre client et serveur.

---

# 12. Gestion des listes

Toujours utiliser :

```tsx
items.map(...)
```

Chaque élément possède une clé stable :

```tsx
key={student.id}
```

Ne jamais utiliser :

```tsx
key={index}
```

sauf si la liste est strictement statique.

---

# 13. Performance

Toujours privilégier :

- Server Components ;
- Lazy Loading (`dynamic()`) ;
- Suspense ;
- Streaming ;
- Pagination ;
- Virtualisation des longues listes.

Éviter les re-rendus inutiles.

---

# 14. Accessibilité

Tous les composants respectent le niveau WCAG AA.

Toujours prévoir :

- navigation clavier ;
- labels explicites ;
- attributs `aria-*` lorsque nécessaire ;
- contraste suffisant.

Les composants de shadcn/ui sont privilégiés car ils intègrent déjà de nombreuses bonnes pratiques d'accessibilité.

---

# 15. Gestion des erreurs

Chaque Feature possède :

- un composant d'erreur ;
- un état vide (`Empty State`) ;
- un état de chargement (`Loading State`).

Les erreurs ne doivent jamais provoquer un écran blanc.

---

# 16. Bonnes pratiques

✓ Composants courts (≈ 200 lignes maximum)

✓ Props typées

✓ Composition plutôt qu'héritage

✓ Server Components par défaut

✓ Client Components uniquement si nécessaires

✓ Formulaires avec React Hook Form + Zod

✓ Accessibilité systématique

✓ Réutilisation maximale

✓ Nommage explicite

---

# 17. Anti-patterns

Interdits :

❌ Composants de plus de 500 lignes

❌ Props de type `any`

❌ `key={index}` sur des listes dynamiques

❌ Logique métier dans les composants

❌ Requêtes Prisma dans un Client Component

❌ Duplication de composants

❌ `useEffect` pour charger des données qui peuvent être obtenues dans un Server Component

❌ Multiplication des Contexts sans justification

---

# 18. Checklist

Avant chaque Pull Request :

- [ ] Composants découpés de manière cohérente.
- [ ] Props correctement typées.
- [ ] Aucun `any`.
- [ ] Server Component utilisé par défaut.
- [ ] Client Component justifié.
- [ ] Formulaire validé avec Zod.
- [ ] Accessibilité vérifiée.
- [ ] Performance contrôlée.
- [ ] États Loading / Empty / Error présents.
- [ ] Aucun code dupliqué.

---

# Documents associés

- CLAUDE.md
- CODING-STANDARDS.md
- TYPESCRIPT-STANDARDS.md
- NEXTJS-STANDARDS.md
- PRISMA-STANDARDS.md
- UI-STANDARDS.md
- API-STANDARDS.md

---

# Fin du document
