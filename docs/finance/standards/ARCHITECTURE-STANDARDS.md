---
title: EduWeb Architecture Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-013
authors:
  - EduWeb Architecture Team
---

# ARCHITECTURE-STANDARDS.md

> Référentiel officiel d'architecture logicielle de l'écosystème EduWeb.

---

# Sommaire

1. Vision
2. Objectifs
3. Principes d'architecture
4. Architecture globale
5. Domaines fonctionnels
6. Modularité
7. Dépendances
8. Flux de données
9. Architecture des couches
10. Communication
11. Évolutivité
12. Résilience
13. Sécurité
14. Observabilité
15. Décisions d'architecture (ADR)
16. Gouvernance
17. Anti-patterns
18. Checklist

---

# 1. Vision

EduWeb est une plateforme **Enterprise SaaS** dédiée à la transformation numérique de l'éducation.

Elle couvre notamment :

- EduWeb Planner
- EduWeb Governance
- EduWeb E-School
- EduWeb Family
- EduWeb Booking
- futurs modules IA
- futurs services ministériels

Tous les modules partagent une architecture commune.

---

# 2. Objectifs

L'architecture doit garantir :

- évolutivité ;
- disponibilité ;
- maintenabilité ;
- modularité ;
- sécurité ;
- simplicité.

Chaque nouvelle fonctionnalité doit pouvoir être ajoutée sans remettre en cause les modules existants.

---

# 3. Principes d'architecture

EduWeb applique les principes suivants :

- Domain Driven Design
- Clean Architecture
- SOLID
- DRY
- KISS
- YAGNI
- API First
- Security by Design
- Privacy by Design
- Performance by Design

---

# 4. Architecture globale

```
Navigateur

↓

Next.js 15

↓

Server Actions

↓

Application Services

↓

Domain Services

↓

Repositories

↓

Prisma ORM

↓

Neon PostgreSQL

↓

Cloud Storage
```

Les composants sont faiblement couplés.

---

# 5. Domaines fonctionnels

Chaque domaine possède :

- ses entités ;
- ses services ;
- ses repositories ;
- ses événements.

Exemples :

```
Identity

Schools

Students

Teachers

Planning

Attendance

Evaluation

Reporting

Administration

Payments

Notifications

Documents
```

Aucun domaine ne doit devenir un « God Module ».

---

# 6. Modularité

Chaque module est autonome.

Structure recommandée :

```
features/

students/

teachers/

schools/

planning/

reports/

governance/

family/

booking/
```

Les dépendances transversales passent par des interfaces.

---

# 7. Dépendances

Règle fondamentale :

Les dépendances pointent toujours vers le centre métier.

```
UI

↓

Application

↓

Domain

↓

Infrastructure
```

Le domaine ne dépend jamais :

- de Prisma ;
- de Next.js ;
- de React ;
- d'un fournisseur cloud.

---

# 8. Flux de données

Flux standard :

```
Interface

↓

Validation

↓

Application

↓

Domaine

↓

Repository

↓

Base de données
```

Le flux inverse ne doit jamais contourner les règles métier.

---

# 9. Architecture des couches

## Présentation

Responsable de :

- l'interface utilisateur ;
- l'expérience utilisateur.

---

## Application

Responsable :

- des cas d'usage ;
- de l'orchestration.

---

## Domaine

Responsable :

- des règles métier ;
- des entités ;
- des invariants.

---

## Infrastructure

Responsable :

- de Prisma ;
- de Neon ;
- du stockage ;
- des notifications ;
- des API externes.

---

# 10. Communication

Communication interne :

- Server Actions
- Services

Communication externe :

- REST API
- Webhooks

Les modules communiquent via des contrats stables.

---

# 11. Évolutivité

Toute évolution doit respecter :

- compatibilité ascendante ;
- faible couplage ;
- forte cohésion.

L'ajout d'un nouveau module ne doit pas nécessiter de modification des modules existants.

---

# 12. Résilience

Le système doit continuer à fonctionner en cas de défaillance partielle.

Mesures recommandées :

- retries ;
- timeouts ;
- files d'attente ;
- journalisation ;
- reprise sur incident.

---

# 13. Sécurité

Toutes les couches appliquent :

- authentification ;
- RBAC ;
- validation ;
- audit ;
- chiffrement.

La sécurité est transversale.

---

# 14. Observabilité

Toutes les opérations critiques sont observables.

Inclure :

- logs ;
- métriques ;
- traces ;
- alertes.

Chaque requête possède un identifiant de corrélation.

---

# 15. Décisions d'architecture (ADR)

Toute décision structurante fait l'objet d'un ADR.

Exemple :

```
ADR-001

Choix de Neon PostgreSQL

ADR-002

Adoption de Server Actions

ADR-003

Architecture Feature-Based

ADR-004

Adoption de Prisma ORM
```

Les ADR sont conservés dans :

```
docs/adr/
```

---

# 16. Gouvernance

Toute évolution importante :

- est revue par l'équipe architecture ;
- respecte les standards ;
- met à jour la documentation.

Les standards sont versionnés.

---

# 17. Anti-patterns

Interdits :

❌ Architecture monolithique non modulaire.

❌ Dépendances circulaires.

❌ Logique métier dans l'interface.

❌ Accès direct à Prisma depuis React.

❌ Services géants.

❌ Couplage fort entre modules.

❌ Duplication des règles métier.

❌ Modules sans propriétaire.

---

# 18. Checklist

Avant toute évolution majeure :

- [ ] Domaine identifié.
- [ ] Cas d'usage défini.
- [ ] Dépendances vérifiées.
- [ ] Interfaces documentées.
- [ ] ADR créé si nécessaire.
- [ ] Sécurité validée.
- [ ] Tests exécutés.
- [ ] Documentation mise à jour.
- [ ] Revue d'architecture effectuée.
- [ ] Compatibilité vérifiée.

---

# Documents associés

- CLAUDE.md
- BACKEND-STANDARDS.md
- API-STANDARDS.md
- DDD-STANDARDS.md
- CLEAN-CODE-STANDARDS.md
- SECURITY-STANDARDS.md

---

# Fin du document
