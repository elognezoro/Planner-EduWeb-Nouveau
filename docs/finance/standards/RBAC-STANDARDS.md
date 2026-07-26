---
title: EduWeb Role-Based Access Control Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-018
authors:
  - EduWeb Architecture Team
---

# RBAC-STANDARDS.md

> Référentiel officiel du contrôle d'accès basé sur les rôles (RBAC) de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Architecture RBAC
4. Modèle d'autorisation
5. Hiérarchie des rôles
6. Permissions
7. Portée des permissions
8. Héritage des rôles
9. Délégation
10. Contrôle d'accès aux ressources
11. Contrôle d'accès aux API
12. Contrôle d'accès aux Server Actions
13. Permissions métier
14. Audit des permissions
15. Évolution des rôles
16. Sécurité
17. Anti-patterns
18. Checklist

---

# 1. Objectifs

Le modèle RBAC d'EduWeb garantit :

- une gestion centralisée des droits ;
- une administration simple ;
- un contrôle précis des accès ;
- une traçabilité complète ;
- le respect du principe du moindre privilège.

Chaque utilisateur ne dispose que des autorisations nécessaires à ses fonctions.

---

# 2. Principes

Le contrôle d'accès repose sur les principes suivants :

- Least Privilege ;
- Separation of Duties ;
- Need to Know ;
- Zero Trust ;
- Security by Design.

Les permissions sont attribuées aux rôles et non directement aux utilisateurs, sauf exception documentée.

---

# 3. Architecture RBAC

```
Utilisateur

↓

Authentification

↓

Rôle(s)

↓

Permission(s)

↓

Vérification

↓

Accès autorisé ou refusé
```

L'autorisation est vérifiée avant toute opération métier.

---

# 4. Modèle d'autorisation

Chaque décision d'accès prend en compte :

- l'identité de l'utilisateur ;
- son ou ses rôles ;
- les permissions associées ;
- la portée de ces permissions ;
- le contexte métier.

Une autorisation est toujours évaluée côté serveur.

---

# 5. Hiérarchie des rôles

Hiérarchie de référence :

```
Super Administrateur

↓

Administrateur National

↓

Administrateur Régional

↓

Directeur d'Établissement

↓

Censeur / Responsable pédagogique

↓

Personnel Administratif

↓

Enseignant

↓

Éducateur

↓

Parent

↓

Élève
```

Des rôles supplémentaires peuvent être définis pour des besoins spécifiques (inspection, partenaires, auditeurs, etc.).

---

# 6. Permissions

Les permissions sont exprimées sous forme d'actions métier.

Exemples :

```
student.read

student.create

student.update

student.delete

teacher.assign

school.manage

planning.generate

planning.publish

attendance.validate

grades.publish

reports.export

users.manage
```

Les permissions doivent être atomiques et explicites.

---

# 7. Portée des permissions

Une permission peut être limitée à une portée.

Exemples :

- plateforme entière ;
- ministère ;
- direction régionale ;
- établissement ;
- année académique ;
- classe ;
- groupe ;
- élève.

Exemple :

```
planning.publish

Scope :

Établissement A
```

Cette permission ne s'applique pas aux autres établissements.

---

# 8. Héritage des rôles

Les rôles peuvent hériter des permissions de niveaux inférieurs.

Exemple :

```
Directeur

↓

hérite des permissions

↓

Censeur

↓

hérite des permissions

↓

Enseignant
```

Les héritages doivent être clairement documentés afin d'éviter les privilèges inattendus.

---

# 9. Délégation

Une délégation peut être accordée :

- temporairement ;
- pour une mission précise ;
- avec une date d'expiration.

Exemple :

```
Chef d'établissement

↓

délègue

↓

Validation des emplois du temps

↓

Adjoint

↓

Pendant 15 jours
```

Toutes les délégations sont journalisées.

---

# 10. Contrôle d'accès aux ressources

Chaque ressource possède des règles d'accès.

Exemples :

Un enseignant :

- consulte ses classes ;
- consulte ses élèves ;
- saisit les notes de ses classes.

Il ne peut pas accéder aux classes d'un autre établissement sans autorisation explicite.

---

# 11. Contrôle d'accès aux API

Chaque endpoint vérifie :

- authentification ;
- rôle ;
- permission ;
- portée.

Une API ne doit jamais supposer qu'un utilisateur est autorisé en se basant uniquement sur son interface.

---

# 12. Contrôle d'accès aux Server Actions

Les Server Actions appliquent systématiquement :

```
Authentification

↓

RBAC

↓

Validation

↓

Service

↓

Repository
```

Les vérifications sont effectuées avant toute logique métier.

---

# 13. Permissions métier

Quelques exemples :

## Gestion des élèves

```
student.read

student.create

student.update

student.archive
```

## Gestion des enseignants

```
teacher.read

teacher.assign

teacher.evaluate
```

## Gestion des emplois du temps

```
planning.read

planning.generate

planning.validate

planning.publish
```

## Gestion des évaluations

```
grades.read

grades.enter

grades.validate

grades.publish
```

## Administration

```
users.manage

roles.manage

permissions.manage

audit.read
```

La nomenclature des permissions est stable et documentée.

---

# 14. Audit des permissions

Toutes les modifications de droits sont tracées.

Journaliser notamment :

- création d'un rôle ;
- suppression d'un rôle ;
- ajout d'une permission ;
- retrait d'une permission ;
- délégation ;
- révocation.

Les journaux sont conservés conformément à la politique de rétention.

---

# 15. Évolution des rôles

L'ajout d'un rôle suit un processus de gouvernance.

Étapes :

1. Analyse du besoin.
2. Définition des responsabilités.
3. Définition des permissions.
4. Validation.
5. Documentation.
6. Déploiement.

Les rôles redondants sont évités.

---

# 16. Sécurité

Le modèle RBAC applique :

- le principe du moindre privilège ;
- des permissions minimales par défaut ;
- une séparation des responsabilités ;
- une réévaluation périodique des droits.

Les comptes inactifs ou obsolètes voient leurs autorisations retirées.

---

# 17. Anti-patterns

Interdits :

❌ Vérifier uniquement le rôle sans vérifier la permission.

❌ Affecter directement des permissions aux utilisateurs sans justification.

❌ Utiliser des rôles génériques comme :

```
admin2

manager1

test
```

❌ Donner des privilèges globaux lorsqu'une portée limitée suffit.

❌ Faire confiance aux permissions envoyées par le client.

❌ Dupliquer les règles RBAC dans plusieurs modules.

---

# 18. Checklist

Avant toute mise en production :

- [ ] Les rôles sont documentés.
- [ ] Les permissions sont atomiques.
- [ ] Les portées sont définies.
- [ ] Les Server Actions vérifient le RBAC.
- [ ] Les API appliquent les contrôles d'accès.
- [ ] Les délégations sont temporaires.
- [ ] Les modifications de droits sont journalisées.
- [ ] Les rôles inutilisés sont supprimés.
- [ ] Les tests RBAC sont exécutés.
- [ ] La documentation est à jour.

---

# Documents associés

- AUTH-STANDARDS.md
- SECURITY-STANDARDS.md
- API-STANDARDS.md
- BACKEND-STANDARDS.md
- LOGGING-STANDARDS.md
- OBSERVABILITY-STANDARDS.md
- DDD-STANDARDS.md

---

# Fin du document
