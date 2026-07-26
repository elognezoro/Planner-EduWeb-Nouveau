---
title: EduWeb Domain Driven Design Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-014
authors:
  - EduWeb Architecture Team
---

# DDD-STANDARDS.md

> Référentiel officiel Domain-Driven Design (DDD) de l'écosystème EduWeb.

---

# Sommaire

1. Vision
2. Philosophie DDD
3. Ubiquitous Language
4. Bounded Contexts
5. Context Mapping
6. Entities
7. Value Objects
8. Aggregates
9. Aggregate Roots
10. Domain Services
11. Application Services
12. Repositories
13. Domain Events
14. Factories
15. Specifications
16. Invariants
17. Transactions métier
18. Intégration entre Contextes
19. Anti-patterns
20. Checklist

---

# 1. Vision

EduWeb applique le **Domain-Driven Design (DDD)** afin que
l'architecture logicielle reflète fidèlement
l'organisation réelle des établissements scolaires.

Le domaine métier est considéré comme le cœur du système.

Les choix techniques doivent toujours servir le métier.

---

# 2. Philosophie DDD

Les règles métier ne doivent jamais être dictées par :

- Next.js
- React
- Prisma
- Neon
- un fournisseur Cloud

Le domaine doit pouvoir évoluer indépendamment des technologies.

---

# 3. Ubiquitous Language

Tous les développeurs utilisent le même vocabulaire.

Exemples :

```
Établissement

Année académique

Classe

Niveau

Série

Élève

Enseignant

Parent

Inscription

Affectation

Emploi du temps

Conseil de classe

Évaluation

Absence

Retard

Bulletin

Matière

Coefficient

Salle

Créneau horaire
```

Les termes métier sont documentés dans un glossaire unique.

---

# 4. Bounded Contexts

EduWeb est découpé en domaines fonctionnels indépendants.

```
Identity

Schools

Students

Teachers

Parents

Planning

Attendance

Evaluation

Examinations

Reporting

Documents

Payments

Notifications

Governance

Analytics

AI
```

Chaque contexte possède :

- son modèle métier ;
- ses services ;
- ses événements ;
- ses règles.

---

# 5. Context Mapping

Les contextes communiquent via des contrats.

Exemple :

```
Planning

↓

Attendance

↓

Reporting
```

Aucun contexte ne lit directement la base d'un autre contexte.

Les échanges passent par :

- Services
- API
- Domain Events

---

# 6. Entities

Une Entity possède :

- une identité ;
- un cycle de vie ;
- un comportement.

Exemples :

```
Student

Teacher

School

Classroom

Timetable

Evaluation
```

Les entités ne sont jamais réduites à de simples structures de données.

---

# 7. Value Objects

Les Value Objects sont immuables.

Exemples :

```
Email

PhoneNumber

Address

AcademicYear

SchoolCode

Period

TimeSlot

Grade
```

Deux Value Objects identiques sont interchangeables.

---

# 8. Aggregates

Les règles métier sont regroupées dans des agrégats.

Exemple :

```
School

├── Classes

├── Teachers

├── Students

└── Timetables
```

Les modifications passent par l'Aggregate Root.

---

# 9. Aggregate Roots

Chaque agrégat possède une racine.

Exemples :

```
School

Student

Timetable

Evaluation
```

Les objets internes ne sont jamais modifiés directement depuis l'extérieur.

---

# 10. Domain Services

Les Domain Services portent les règles complexes.

Exemples :

```
TimetableGenerator

PromotionDecisionService

AttendanceCalculator

StudentAssignmentService

GradeComputationService
```

Ils ne dépendent pas de Prisma.

---

# 11. Application Services

Les Application Services orchestrent les cas d'usage.

Exemples :

```
EnrollStudent

PublishTimetable

AssignTeacher

GenerateReportCards

CloseAcademicYear
```

Ils coordonnent plusieurs Domain Services.

---

# 12. Repositories

Chaque Aggregate Root possède son Repository.

Exemple :

```
StudentRepository

SchoolRepository

TimetableRepository
```

Responsabilités :

- persistance ;
- recherche ;
- pagination.

Les règles métier restent dans le domaine.

---

# 13. Domain Events

Les événements décrivent des faits métier.

Exemples :

```
StudentEnrolled

TeacherAssigned

TimetablePublished

AttendanceRecorded

GradeValidated

AcademicYearClosed
```

Les événements sont immuables.

Ils facilitent le découplage des modules.

---

# 14. Factories

Les objets complexes sont créés par des Factories.

Exemples :

```
StudentFactory

SchoolFactory

TimetableFactory
```

Les constructeurs restent simples.

---

# 15. Specifications

Les règles de validation complexes sont encapsulées dans des Specifications.

Exemples :

```
StudentEligibleForEnrollment

TeacherCanTeachSubject

RoomAvailable

StudentCanGraduate
```

Les Specifications sont réutilisables.

---

# 16. Invariants

Les invariants métier sont toujours respectés.

Exemples :

- un élève appartient à un seul établissement pour une année académique donnée ;
- une salle ne peut accueillir qu'un seul cours sur un même créneau ;
- un enseignant ne peut être affecté à deux cours simultanés ;
- une évaluation publiée ne peut être modifiée sans procédure de révision.

Les invariants sont contrôlés dans les Aggregates.

---

# 17. Transactions métier

Une transaction métier correspond à une opération complète.

Exemples :

```
Inscrire un élève

Publier un emploi du temps

Clôturer une année académique

Valider les résultats d'un examen
```

Toutes les données concernées sont mises à jour de manière atomique.

---

# 18. Intégration entre Contextes

Les échanges privilégient :

- Domain Events ;
- API internes ;
- Messages asynchrones.

Éviter les dépendances directes entre modèles métier.

---

# 19. Anti-patterns

Interdits :

❌ Aggregate géant.

❌ Entités anémiques (sans comportement).

❌ Logique métier dans Prisma.

❌ Logique métier dans React.

❌ Repositories contenant des règles métier.

❌ Dépendances circulaires entre Contextes.

❌ Accès direct aux données d'un autre Bounded Context.

❌ Vocabulaire métier incohérent.

---

# 20. Checklist

Avant toute nouvelle fonctionnalité :

- [ ] Bounded Context identifié.
- [ ] Ubiquitous Language respecté.
- [ ] Aggregate Root défini.
- [ ] Entities identifiées.
- [ ] Value Objects créés.
- [ ] Domain Services documentés.
- [ ] Domain Events définis.
- [ ] Invariants vérifiés.
- [ ] Repositories conformes.
- [ ] Documentation métier mise à jour.

---

# Documents associés

- ARCHITECTURE-STANDARDS.md
- BACKEND-STANDARDS.md
- API-STANDARDS.md
- CLEAN-CODE-STANDARDS.md
- PRISMA-STANDARDS.md

---

# Fin du document
