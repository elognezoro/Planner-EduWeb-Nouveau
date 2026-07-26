---
title: EduWeb Next.js Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-003
authors:
  - EduWeb Architecture Team
---

# NEXTJS-STANDARDS.md

> Référentiel officiel Next.js de l'écosystème EduWeb.

---

# Sommaire

1. Philosophie
2. Version officielle
3. Architecture App Router
4. Structure des dossiers
5. Server Components
6. Client Components
7. Server Actions
8. Route Handlers
9. Navigation
10. Data Fetching
11. Cache
12. Streaming
13. Suspense
14. Middleware
15. Authentification
16. Métadonnées
17. Performance
18. SEO
19. Bonnes pratiques
20. Anti-patterns
21. Checklist

---

# 1. Philosophie

EduWeb utilise exclusivement :

- Next.js App Router
- React Server Components
- Server Actions

L'objectif est de produire une application :

- performante ;
- sécurisée ;
- maintenable ;
- fortement typée.

---

# 2. Version officielle

Version supportée :

```
Next.js 15
```

Aucun développement ne doit utiliser :

- Pages Router
- getServerSideProps
- getStaticProps
- getInitialProps

Ces APIs sont considérées comme obsolètes dans EduWeb.

---

# 3. Architecture App Router

Structure officielle :

```
src/

app/

(layout)

(auth)

(dashboard)

(api)

loading.tsx

error.tsx

not-found.tsx

layout.tsx

page.tsx
```

Les groupes de routes sont utilisés pour organiser les domaines fonctionnels.

---

# 4. Structure des dossiers

Exemple :

```
app/

students/

page.tsx

loading.tsx

error.tsx

actions.ts

components/

StudentTable.tsx

StudentForm.tsx
```

Les composants métiers restent dans leur feature.

---

# 5. Server Components

Règle :

Tous les composants sont des Server Components.

Exemple :

```tsx
export default async function StudentsPage() {

const students =
await studentRepository.findAll();

return (
<StudentTable students={students}/>
);

}
```

---

Les Server Components sont privilégiés pour :

- lecture des données ;
- rendu initial ;
- SEO ;
- performances.

---

# 6. Client Components

Utiliser uniquement lorsque nécessaire.

Exemples :

- formulaire interactif ;
- drag & drop ;
- calendrier ;
- graphiques ;
- état local complexe.

Toujours ajouter :

```tsx
"use client";
```

uniquement lorsque cela est indispensable.

---

# 7. Server Actions

Les Server Actions sont la méthode officielle.

Exemple :

```tsx
"use server";

export async function createStudent(
data: StudentDTO
){

...
}
```

Les Server Actions remplacent les API internes.

---

# 8. Route Handlers

Créer un Route Handler uniquement lorsque :

- API publique ;
- Webhook ;
- OAuth ;
- téléchargement de fichiers ;
- intégration externe.

Exemple :

```
app/api/students/route.ts
```

---

# 9. Navigation

Toujours utiliser :

```tsx
<Link/>
```

Éviter :

```
window.location
```

Pour la navigation programmatique :

```tsx
router.push()
```

---

# 10. Data Fetching

Toujours :

Server Component

↓

Repository

↓

Prisma

↓

Neon

Ne jamais appeler directement Prisma dans un composant Client.

---

# 11. Cache

Utiliser :

```
fetch()

revalidateTag()

revalidatePath()
```

Le cache doit être invalidé uniquement lorsque nécessaire.

---

# 12. Streaming

Toujours privilégier :

Streaming React.

Exemple :

```
Suspense

↓

Chargement progressif

↓

Hydratation
```

---

# 13. Suspense

Toutes les pages longues utilisent :

```tsx
<Suspense
fallback={<Loading/>}
>

...

</Suspense>
```

---

# 14. Middleware

Le Middleware est réservé à :

- authentification ;
- redirection ;
- sécurité ;
- internationalisation.

Il ne contient jamais de logique métier.

---

# 15. Authentification

Toute page protégée :

↓

Middleware

↓

Session

↓

RBAC

↓

Server Component

↓

Repository

---

# 16. Métadonnées

Chaque page possède :

```tsx
export const metadata = {

title,

description

}
```

Toujours renseigner :

- title ;
- description.

---

# 17. Performance

Toujours :

✓ Streaming

✓ Suspense

✓ Server Components

✓ Lazy Loading

✓ Dynamic Import

✓ Image Optimization

✓ Pagination

---

Éviter :

Hydratation inutile.

---

# 18. SEO

Utiliser :

Metadata API.

Toujours :

- title ;
- description ;
- Open Graph ;
- Twitter Card.

Images :

Toujours :

```
next/image
```

---

# 19. Bonnes pratiques

Toujours :

✓ App Router

✓ Server Actions

✓ Repository Pattern

✓ Prisma

✓ Neon

✓ Suspense

✓ Error Boundary

✓ Loading UI

✓ Server Components

✓ Layout imbriqués

---

# 20. Anti-patterns

Interdits :

❌ Pages Router

❌ getServerSideProps

❌ getStaticProps

❌ Prisma dans Client Component

❌ Hydratation excessive

❌ Fetch dans useEffect si un Server Component suffit

❌ API interne inutile

❌ Composants géants

❌ Layout dupliqués

---

# 21. Checklist

Avant chaque Pull Request :

- [ ] App Router utilisé.
- [ ] Server Component privilégié.
- [ ] Client Component justifié.
- [ ] Server Action utilisée si possible.
- [ ] Route Handler uniquement si nécessaire.
- [ ] Métadonnées renseignées.
- [ ] Loading UI présente.
- [ ] Error Boundary présente.
- [ ] Cache maîtrisé.
- [ ] Performance vérifiée.

---

# Documents associés

- CLAUDE.md
- CODING-STANDARDS.md
- TYPESCRIPT-STANDARDS.md
- REACT-STANDARDS.md
- PRISMA-STANDARDS.md
- NEON-STANDARDS.md
- API-STANDARDS.md

---

# Fin du document
