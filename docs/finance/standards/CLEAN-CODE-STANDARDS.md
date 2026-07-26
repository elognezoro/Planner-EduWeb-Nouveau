---
title: EduWeb Clean Code Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-015
authors:
  - EduWeb Architecture Team
---

# CLEAN-CODE-STANDARDS.md

> Référentiel officiel des bonnes pratiques de développement de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Philosophie
3. Lisibilité du code
4. Convention de nommage
5. Organisation des fichiers
6. Fonctions
7. Classes
8. Composants React
9. Responsabilité unique
10. Gestion de la complexité
11. Duplication de code
12. Commentaires
13. Gestion des erreurs
14. Refactoring
15. Revues de code
16. Dette technique
17. Anti-patterns
18. Checklist

---

# 1. Objectifs

Le code produit dans EduWeb doit être :

- lisible ;
- simple ;
- cohérent ;
- testable ;
- évolutif ;
- documenté.

Un développeur doit comprendre rapidement un module qu'il n'a jamais vu auparavant.

---

# 2. Philosophie

Le code est écrit pour être lu par des humains avant d'être exécuté par une machine.

Chaque ligne doit apporter de la valeur.

Avant d'ajouter du code, se poser systématiquement les questions suivantes :

- Est-il nécessaire ?
- Peut-il être simplifié ?
- Peut-il être réutilisé ?
- Respecte-t-il les standards du projet ?

---

# 3. Lisibilité du code

Le code doit être explicite.

Préférer :

```typescript
const activeStudents = students.filter(student => student.isActive);
```

Éviter :

```typescript
const s = students.filter(x => x.a);
```

Les intentions doivent être évidentes.

---

# 4. Convention de nommage

Les noms doivent refléter le métier.

### Variables

```typescript
student

teacher

school

academicYear
```

### Fonctions

Toujours commencer par un verbe.

```typescript
createStudent()

assignTeacher()

publishTimetable()

calculateAverage()
```

### Booléens

Préfixes recommandés :

```typescript
isActive

hasAccess

canEdit

shouldNotify
```

### Constantes

```typescript
MAX_STUDENTS_PER_CLASS

DEFAULT_PAGE_SIZE
```

---

# 5. Organisation des fichiers

Un fichier ne contient qu'une responsabilité.

Exemple :

```
StudentCard.tsx

StudentForm.tsx

StudentRepository.ts

StudentService.ts

student.schema.ts
```

Éviter les fichiers dépassant plusieurs centaines de lignes sans justification.

---

# 6. Fonctions

Une fonction :

- réalise une seule tâche ;
- possède un nom explicite ;
- reste courte ;
- évite les effets de bord.

Préférer :

```typescript
calculateFinalGrade()
```

plutôt que :

```typescript
process()
```

Les paramètres doivent être limités.

Au-delà de quatre paramètres, envisager un objet de configuration.

---

# 7. Classes

Les classes doivent être :

- cohérentes ;
- spécialisées ;
- faciles à tester.

Une classe ne doit pas accumuler des responsabilités hétérogènes.

---

# 8. Composants React

Les composants doivent :

- être spécialisés ;
- rester compacts ;
- recevoir des propriétés explicites.

Éviter les composants « géants » mélangeant interface, logique métier et accès aux données.

---

# 9. Responsabilité unique

Principe SRP (Single Responsibility Principle).

Chaque élément du code possède une seule raison de changer.

Exemple :

```
StudentService

↓

Gestion des élèves

≠

NotificationService

↓

Envoi des notifications
```

---

# 10. Gestion de la complexité

Limiter :

- les imbrications profondes ;
- les conditions multiples ;
- les fonctions longues.

Préférer :

- le polymorphisme ;
- les stratégies ;
- les tables de correspondance ;
- les fonctions spécialisées.

---

# 11. Duplication de code

Principe DRY (Don't Repeat Yourself).

Avant de copier du code :

- rechercher une abstraction ;
- créer une fonction commune ;
- créer un composant réutilisable.

La duplication volontaire doit être justifiée.

---

# 12. Commentaires

Le meilleur commentaire est un code explicite.

Les commentaires sont réservés à :

- l'explication d'une règle métier complexe ;
- une contrainte technique ;
- un lien vers une ADR ou une norme.

Éviter les commentaires qui répètent simplement le code.

---

# 13. Gestion des erreurs

Les erreurs doivent être :

- explicites ;
- contextualisées ;
- journalisées.

Ne jamais masquer silencieusement une erreur.

Les messages destinés aux utilisateurs doivent être compréhensibles.

---

# 14. Refactoring

Le refactoring est une activité continue.

À chaque modification :

- simplifier le code lorsque possible ;
- supprimer le code mort ;
- améliorer les noms ;
- réduire la complexité.

Aucun refactoring ne doit modifier le comportement fonctionnel attendu.

---

# 15. Revues de code

Toute Pull Request fait l'objet d'une revue.

Points de contrôle :

- lisibilité ;
- conformité aux standards ;
- sécurité ;
- performances ;
- tests ;
- documentation.

Les revues visent l'amélioration du code, non l'évaluation des personnes.

---

# 16. Dette technique

La dette technique doit être :

- identifiée ;
- documentée ;
- priorisée ;
- résorbée progressivement.

Les compromis temporaires doivent être tracés dans les tickets ou ADR concernés.

---

# 17. Anti-patterns

Interdits :

❌ Fonctions de plusieurs centaines de lignes.

❌ Variables nommées :

```
a

b

tmp

data

obj
```

sans justification.

❌ Duplication massive.

❌ Commentaires obsolètes.

❌ Conditions imbriquées excessives.

❌ Classes « God Object ».

❌ Composants React mélangeant logique métier et accès aux données.

❌ Code mort conservé dans le dépôt.

---

# 18. Checklist

Avant chaque Pull Request :

- [ ] Les noms sont explicites.
- [ ] Chaque fonction a une responsabilité unique.
- [ ] Les composants sont spécialisés.
- [ ] La duplication est évitée.
- [ ] Les erreurs sont correctement gérées.
- [ ] Les commentaires sont utiles.
- [ ] Les tests passent.
- [ ] Aucun code mort n'est conservé.
- [ ] Le code respecte les standards EduWeb.
- [ ] La documentation a été mise à jour si nécessaire.

---

# Documents associés

- CLAUDE.md
- ARCHITECTURE-STANDARDS.md
- DDD-STANDARDS.md
- BACKEND-STANDARDS.md
- TYPESCRIPT-STANDARDS.md
- REACT-STANDARDS.md
- TESTING-STANDARDS.md

---

# Fin du document
