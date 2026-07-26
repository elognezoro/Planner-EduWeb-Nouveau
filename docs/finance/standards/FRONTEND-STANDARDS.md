---
title: EduWeb Frontend Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-029
authors:
  - EduWeb Architecture Team
---

# FRONTEND-STANDARDS.md

> Référentiel officiel de développement Frontend de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Stack Frontend
4. Architecture Frontend
5. Organisation des dossiers
6. Conventions de nommage
7. Server Components
8. Client Components
9. Server Actions
10. Gestion des états
11. Gestion des formulaires
12. Validation
13. Navigation
14. Data Fetching
15. Gestion des erreurs
16. Gestion du chargement
17. Tables de données
18. Responsive Design
19. Accessibilité
20. Internationalisation
21. Performance
22. Sécurité Frontend
23. Tests
24. Documentation
25. Anti-patterns
26. Checklist

---

# 1. Objectifs

Le Frontend EduWeb doit être :

- rapide ;
- accessible ;
- maintenable ;
- évolutif ;
- cohérent ;
- agréable à utiliser.

Chaque interface doit offrir une expérience fluide aussi bien sur ordinateur que sur tablette et smartphone.

---

# 2. Principes

Le développement Frontend repose sur :

- Component First ;
- Server First ;
- Progressive Enhancement ;
- Responsive by Default ;
- Accessibility by Design ;
- Performance by Design.

Chaque écran doit privilégier les Server Components lorsque cela est possible.

---

# 3. Stack Frontend

Le Frontend officiel utilise exclusivement :

- Next.js 15
- React 19
- TypeScript Strict
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Lucide Icons

Aucune bibliothèque supplémentaire ne doit être introduite sans validation de l'équipe Architecture.

---

# 4. Architecture Frontend

Architecture recommandée :

```
src/

├── app/
├── components/
├── features/
├── layouts/
├── lib/
├── hooks/
├── services/
├── styles/
├── types/
└── utils/
```

Les composants métier sont isolés des composants génériques.

---

# 5. Organisation des dossiers

```
components/
    ui/
    layout/
    feedback/
    navigation/

features/
    students/
    teachers/
    planner/
    evaluations/
    reports/
```

Chaque Feature possède :

- composants ;
- hooks ;
- types ;
- services ;
- validations.

---

# 6. Conventions de nommage

## Composants

```
StudentCard.tsx

TeacherTable.tsx

TimetableEditor.tsx
```

---

## Hooks

```
useStudents.ts

usePlanner.ts

useAuthentication.ts
```

---

## Pages

```
page.tsx

layout.tsx

loading.tsx

error.tsx
```

---

# 7. Server Components

Les Server Components sont utilisés par défaut.

Ils sont privilégiés pour :

- lecture des données ;
- tableaux ;
- listes ;
- dashboards ;
- rapports.

Ils ne contiennent aucun état interactif.

---

# 8. Client Components

Les Client Components sont réservés :

- aux interactions utilisateur ;
- aux animations ;
- aux formulaires ;
- au Drag & Drop ;
- aux composants nécessitant des Hooks React.

Toujours ajouter :

```tsx
"use client";
```

uniquement lorsque nécessaire.

---

# 9. Server Actions

Toutes les opérations d'écriture utilisent les Server Actions.

Exemples :

- création d'élève ;
- modification d'une classe ;
- suppression d'une matière ;
- génération d'un emploi du temps.

Les appels REST internes sont évités lorsqu'une Server Action suffit.

---

# 10. Gestion des états

Hiérarchie recommandée :

## État local

```
useState()
```

---

## État dérivé

```
useMemo()

useCallback()
```

---

## État global léger

Context API uniquement lorsque nécessaire.

---

Les états globaux volumineux doivent être évités.

---

# 11. Gestion des formulaires

Tous les formulaires utilisent :

- React Hook Form
- Zod

Exemple :

```tsx
const form = useForm({
  resolver: zodResolver(schema),
});
```

Aucun formulaire manuel n'est autorisé.

---

# 12. Validation

Validation :

- côté client ;
- côté serveur.

Les règles Zod sont partagées lorsque possible.

Les messages d'erreur sont homogènes.

---

# 13. Navigation

Navigation officielle :

Next.js App Router.

Utiliser :

```
<Link>

redirect()

router.push()
```

Éviter les manipulations directes de `window.location`.

---

# 14. Data Fetching

Les données sont récupérées :

- côté serveur lorsque possible ;
- côté client uniquement si nécessaire.

Ordre de priorité :

```
Server Component

↓

Server Action

↓

Client Fetch
```

Limiter les requêtes répétitives.

---

# 15. Gestion des erreurs

Chaque page possède :

```
error.tsx
```

Les composants critiques disposent également de Error Boundaries.

Les erreurs utilisateur restent compréhensibles.

---

# 16. Gestion du chargement

Chaque route dispose de :

```
loading.tsx
```

Utiliser :

- Skeletons ;
- Progress Indicators ;
- Suspense.

Éviter les écrans entièrement blancs.

---

# 17. Tables de données

Les tableaux doivent proposer :

- pagination ;
- recherche ;
- tri ;
- filtres ;
- export.

Les grandes collections utilisent une pagination serveur.

---

# 18. Responsive Design

Le Responsive est obligatoire.

Breakpoints recommandés :

```
Mobile

Tablet

Laptop

Desktop

Wide Screen
```

Le Mobile First est privilégié.

---

# 19. Accessibilité

Respect des recommandations WCAG.

Les interfaces doivent proposer :

- navigation clavier ;
- contraste suffisant ;
- focus visible ;
- labels explicites ;
- textes alternatifs ;
- structure HTML sémantique.

Tous les composants shadcn/ui doivent conserver leurs propriétés d'accessibilité.

---

# 20. Internationalisation

Prévoir l'internationalisation.

Les textes ne doivent jamais être codés directement dans les composants.

Prévoir :

- Français
- Anglais

avec possibilité d'ajouter d'autres langues.

---

# 21. Performance

Optimisations obligatoires :

- Lazy Loading ;
- Dynamic Import ;
- Memoization lorsque pertinente ;
- Optimisation des images ;
- Streaming ;
- Suspense.

Éviter les re-rendus inutiles.

---

# 22. Sécurité Frontend

Interdits :

- secrets dans le navigateur ;
- logique métier critique côté client ;
- validation uniquement côté client.

Les autorisations sont toujours vérifiées côté serveur.

---

# 23. Tests

Les composants critiques disposent de :

- tests unitaires ;
- tests d'intégration ;
- tests E2E.

Les parcours principaux sont automatiquement validés.

---

# 24. Documentation

Chaque Feature documente :

- architecture ;
- composants ;
- Hooks ;
- formulaires ;
- dépendances.

Les composants réutilisables possèdent une documentation dédiée.

---

# 25. Anti-patterns

Interdits :

❌ Tout transformer en Client Component.

❌ Props Drilling excessif.

❌ CSS inline.

❌ Styles dupliqués.

❌ Requêtes API dans plusieurs composants.

❌ Logique métier complexe dans les composants.

❌ Formulaires sans React Hook Form.

❌ Validation uniquement côté client.

❌ Composants de plusieurs centaines de lignes.

❌ Duplication de composants similaires.

---

# 26. Checklist

Avant chaque Pull Request :

- [ ] Server Components privilégiés.
- [ ] Client Components limités.
- [ ] Formulaires avec React Hook Form.
- [ ] Validation Zod.
- [ ] Responsive vérifié.
- [ ] Accessibilité contrôlée.
- [ ] Performance optimisée.
- [ ] Tests exécutés.
- [ ] Documentation mise à jour.
- [ ] Conventions de nommage respectées.

---

# Documents associés

- UI-STANDARDS.md
- NEXTJS-STANDARDS.md
- REACT-STANDARDS.md
- TYPESCRIPT-STANDARDS.md
- API-STANDARDS.md
- SECURITY-STANDARDS.md
- TESTING-STANDARDS.md
- PERFORMANCE-STANDARDS.md

---

# Fin du document
