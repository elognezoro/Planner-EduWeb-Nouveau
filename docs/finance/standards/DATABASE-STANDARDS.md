---
title: EduWeb Database Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-007
authors:
  - EduWeb Architecture Team
---

# DATABASE-STANDARDS.md

> Référentiel officiel de conception, d'organisation et de gouvernance des bases de données de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes de conception
3. Architecture des données
4. Organisation des schémas
5. Conventions de nommage
6. Types de données
7. Clés primaires
8. Clés étrangères
9. Contraintes
10. Normalisation
11. Dénormalisation
12. Tables de référence
13. Tables de liaison
14. Historisation
15. Audit
16. Soft Delete
17. Multi-tenancy
18. Intégrité référentielle
19. Indexation
20. Performances
21. Archivage
22. Sécurité
23. Gouvernance des données
24. Documentation
25. Checklist

---

# 1. Objectifs

La base de données EduWeb doit être :

- cohérente ;
- performante ;
- sécurisée ;
- évolutive ;
- facilement maintenable ;
- documentée.

Les modèles doivent pouvoir évoluer durant plusieurs années sans remise en cause majeure.

---

# 2. Principes de conception

Toutes les bases respectent :

- Domain Driven Design (DDD)
- Clean Architecture
- Normalisation
- Intégrité référentielle
- Sécurité by Design
- Performance by Design

---

# 3. Architecture des données

Organisation logique :

```
Utilisateurs

↓

Établissements

↓

Structures pédagogiques

↓

Personnes

↓

Activités

↓

Évaluations

↓

Rapports
```

Chaque domaine fonctionnel possède ses propres entités.

---

# 4. Organisation des schémas

Le schéma principal est réservé aux données métier.

Les extensions ou modules spécialisés peuvent utiliser des schémas dédiés lorsque cela améliore la lisibilité ou l'isolation.

Exemples :

```
public

audit

reporting

integration
```

---

# 5. Conventions de nommage

Tables :

```
Student

Teacher

School

Timetable

Attendance
```

Colonnes :

```
firstName

lastName

birthDate
```

Clés étrangères :

```
schoolId

classId

teacherId
```

---

# 6. Types de données

Utiliser le type le plus précis possible.

Exemples :

```
UUID

VARCHAR

BOOLEAN

DATE

TIMESTAMP

NUMERIC
```

Éviter les colonnes génériques de type texte lorsqu'un type spécialisé existe.

---

# 7. Clés primaires

Toutes les entités utilisent :

```
UUID
```

Les identifiants sont immuables.

Aucune information métier ne doit être intégrée dans la clé primaire.

---

# 8. Clés étrangères

Toutes les relations utilisent des clés étrangères explicites.

Les suppressions en cascade sont limitées aux cas justifiés.

Les contraintes doivent préserver l'intégrité référentielle.

---

# 9. Contraintes

Utiliser systématiquement :

- PRIMARY KEY
- FOREIGN KEY
- UNIQUE
- CHECK

Les contraintes métier doivent être portées autant que possible par la base de données.

---

# 10. Normalisation

Objectif :

Troisième forme normale (3NF) par défaut.

Les duplications de données sont évitées.

Toute dénormalisation doit être documentée.

---

# 11. Dénormalisation

Acceptée uniquement lorsqu'elle apporte un gain mesurable de performance.

Chaque dénormalisation doit être :

- justifiée ;
- documentée ;
- testée.

---

# 12. Tables de référence

Les valeurs de référence sont centralisées.

Exemples :

```
Country

Region

AcademicYear

Gender

SchoolType
```

Les listes codifiées sont utilisées dans toute l'application.

---

# 13. Tables de liaison

Les relations N:N utilisent une table dédiée.

Exemple :

```
TeacherSubject

StudentClub

RolePermission
```

Ces tables peuvent contenir leurs propres attributs métier.

---

# 14. Historisation

Les événements importants sont historisés.

Exemples :

- changement d'établissement ;
- changement de classe ;
- modification des affectations ;
- évolution des droits.

Les historiques sont immuables.

---

# 15. Audit

Toutes les tables métier comportent au minimum :

```
createdAt

updatedAt

createdBy

updatedBy
```

Les opérations sensibles sont enregistrées dans une table d'audit.

---

# 16. Soft Delete

La suppression logique est privilégiée.

Champ recommandé :

```
deletedAt
```

Les données supprimées restent disponibles pour :

- restauration ;
- audit ;
- conformité réglementaire.

---

# 17. Multi-tenancy

EduWeb est conçu pour héberger plusieurs organisations.

Chaque donnée est rattachée à son contexte :

```
tenantId
```

ou

```
organizationId
```

Aucune requête ne doit permettre l'accès aux données d'un autre tenant.

---

# 18. Intégrité référentielle

Toutes les relations sont vérifiées.

Les enregistrements orphelins sont interdits.

Les scripts de maintenance contrôlent régulièrement la cohérence des données.

---

# 19. Indexation

Indexer :

- clés étrangères ;
- identifiants fonctionnels ;
- colonnes de recherche ;
- colonnes de tri ;
- colonnes de filtrage.

Réévaluer les index après chaque évolution majeure.

---

# 20. Performances

Objectifs :

- requêtes prévisibles ;
- temps de réponse faible ;
- consommation mémoire maîtrisée.

Les requêtes longues sont analysées.

Les statistiques PostgreSQL sont surveillées.

---

# 21. Archivage

Les données anciennes peuvent être déplacées vers des tables d'archives.

Les données archivées restent consultables selon les droits de l'utilisateur.

L'archivage ne doit jamais casser les relations métier.

---

# 22. Sécurité

Les accès sont contrôlés par :

- authentification ;
- autorisation ;
- chiffrement TLS ;
- journalisation.

Les données sensibles peuvent être chiffrées au repos selon les exigences réglementaires.

---

# 23. Gouvernance des données

Chaque entité possède :

- un propriétaire fonctionnel ;
- une description ;
- un cycle de vie ;
- une politique de conservation.

Les évolutions de schéma sont validées en revue d'architecture.

---

# 24. Documentation

Chaque modèle est documenté.

La documentation comprend :

- description ;
- attributs ;
- relations ;
- contraintes ;
- règles métier ;
- exemples d'utilisation.

Le dictionnaire de données est maintenu à jour.

---

# 25. Checklist

Avant chaque mise en production :

- [ ] Modèle conforme aux conventions.
- [ ] Clés primaires vérifiées.
- [ ] Clés étrangères vérifiées.
- [ ] Contraintes testées.
- [ ] Index optimisés.
- [ ] Audit présent.
- [ ] Historisation vérifiée.
- [ ] Soft Delete implémenté si nécessaire.
- [ ] Documentation mise à jour.
- [ ] Validation d'architecture effectuée.

---

# Documents associés

- CLAUDE.md
- PRISMA-STANDARDS.md
- NEON-STANDARDS.md
- MIGRATION-STANDARDS.md
- SECURITY-STANDARDS.md
- ARCHITECTURE-STANDARDS.md

---

# Fin du document
