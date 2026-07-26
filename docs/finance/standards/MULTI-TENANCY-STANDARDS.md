---
title: Multi-Tenancy Standards
version: 1.0
status: Official
category: Enterprise Architecture
code: STD-041
authors:
  - EduWeb Architecture Team
---

# MULTI-TENANCY-STANDARDS.md

> Standard officiel de conception, de développement et d'exploitation des architectures **Multi-Tenant** de l'écosystème EduWeb.

---

# Sommaire

1. Objectif
2. Champ d'application
3. Définitions
4. Vision d'architecture
5. Principes fondamentaux
6. Les modèles Multi-Tenant
7. Choix retenu pour EduWeb
8. Identification d'un Tenant
9. Cycle de vie d'un Tenant
10. Architecture générale
11. Architecture logique
12. Architecture physique
13. Isolation des données
14. Hiérarchie institutionnelle
15. Documents associés

---

# 1. Objectif

Ce document définit les normes d'architecture permettant à l'ensemble des applications EduWeb d'héberger simultanément plusieurs organisations indépendantes sur une même plateforme tout en garantissant :

- l'isolation complète des données ;
- la sécurité ;
- les performances ;
- la personnalisation ;
- la montée en charge ;
- la simplicité d'exploitation.

Le présent standard s'applique à tous les modules de l'écosystème :

- EduWeb Planner
- EduWeb Governance
- EduWeb Booking
- EduWeb Family
- E-School
- futurs modules.

---

# 2. Champ d'application

Le standard concerne notamment :

- établissements scolaires ;
- universités ;
- CAFOP ;
- inspections pédagogiques ;
- DRENA ;
- Directions centrales ;
- ministères ;
- diocèses ;
- collectivités territoriales ;
- entreprises partenaires.

Chaque entité est considérée comme un **Tenant**.

---

# 3. Définitions

## 3.1 Tenant

Organisation indépendante utilisant la plateforme.

Exemples :

- Lycée Moderne de Yamoussoukro
- CAFOP de Bouaké
- Université Félix Houphouët-Boigny
- DRENA d'Abidjan 1

Chaque Tenant possède :

- ses utilisateurs ;
- ses données ;
- ses paramètres ;
- ses permissions ;
- ses statistiques.

---

## 3.2 Super Tenant

Organisation pilotant plusieurs tenants.

Exemples :

- Ministère
- Direction Générale
- Enseignement Catholique
- Réseau d'établissements

---

## 3.3 Platform Owner

Exploitant technique.

Dans EduWeb :

```
EdTech EduWeb
```

Le Platform Owner dispose d'une visibilité globale.

---

# 4. Vision d'architecture

L'objectif est de permettre une croissance de :

```
1 établissement

↓

100 établissements

↓

10 000 établissements

↓

Plusieurs pays
```

sans modifier l'architecture.

Le système doit être **Cloud Native**.

---

# 5. Principes fondamentaux

Les principes suivants sont obligatoires.

## 5.1 Isolation

Les données d'un tenant ne doivent jamais être accessibles à un autre.

---

## 5.2 Mutualisation

Les ressources communes sont mutualisées lorsque cela est pertinent.

---

## 5.3 Personnalisation

Chaque tenant peut personnaliser :

- logo ;
- couleurs ;
- nom ;
- fuseau horaire ;
- langue ;
- calendrier ;
- paramètres pédagogiques.

---

## 5.4 Scalabilité

L'ajout de nouveaux tenants ne nécessite aucune modification du code.

---

## 5.5 Sécurité

Le système doit empêcher :

- fuite de données ;
- erreurs de routage ;
- confusion d'identité ;
- élévation de privilèges.

---

# 6. Les modèles Multi-Tenant

Trois modèles principaux existent.

---

## Modèle A

### Shared Database

```
Database

├── Tenant A
├── Tenant B
├── Tenant C
└── Tenant D
```

Chaque table contient :

```
tenant_id
```

### Avantages

- économique
- simple
- très scalable

### Inconvénients

- nécessite une excellente isolation logique

---

## Modèle B

### Shared Database
### Separate Schema

```
Database

├── schema_a

├── schema_b

├── schema_c
```

Chaque tenant possède son propre schéma.

### Avantages

- meilleure isolation

### Inconvénients

- maintenance plus complexe

---

## Modèle C

### Database per Tenant

```
Tenant A

↓

Database A

Tenant B

↓

Database B

Tenant C

↓

Database C
```

### Avantages

- isolation maximale

### Inconvénients

- coût élevé
- administration importante

---

# 7. Choix retenu pour EduWeb

Le standard officiel est une architecture hybride.

## Niveau 1

Petits établissements

↓

Shared Database

---

## Niveau 2

Grandes institutions

↓

Dedicated Schema

---

## Niveau 3

Ministères

↓

Dedicated Database

---

Cette approche permet :

- faible coût initial ;
- montée en charge progressive ;
- migration transparente.

---

# 8. Identification d'un Tenant

Chaque requête doit résoudre le tenant.

Les stratégies autorisées sont :

## Domaine

```
abidjan.eduweb.ci

bouake.eduweb.ci
```

---

## Sous-domaine

```
planner.eduweb.ci

↓

tenant1.planner.eduweb.ci
```

---

## URL

```
planner.eduweb.ci/t/lycee-moderne
```

---

## Header HTTP

```
X-Tenant-ID
```

---

## JWT

Le token contient :

```json
{
  "tenantId": "...",
  "userId": "...",
  "role": "...",
  "permissions": []
}
```

---

# 9. Cycle de vie d'un Tenant

```
Création

↓

Configuration

↓

Activation

↓

Utilisation

↓

Évolution

↓

Archivage

↓

Suppression
```

Chaque étape est historisée.

---

# 10. Architecture générale

```text
                  Utilisateur

                       │

               Authentication

                       │

              Tenant Resolver

                       │

           Tenant Context Builder

                       │

            Authorization (RBAC)

                       │

              Business Services

                       │

             Repository Layer

                       │

              Prisma ORM

                       │

           Neon PostgreSQL
```

Le **Tenant Resolver** constitue le point central de l'architecture.

---

# 11. Architecture logique

Chaque requête possède un contexte :

```typescript
interface TenantContext {

    tenantId: string

    organizationId: string

    regionId: string

    countryId: string

    language: string

    timezone: string

    branding: Branding

    subscription: Subscription

}
```

Le contexte est immuable durant toute la requête.

---

# 12. Architecture physique

Le système est organisé ainsi :

```text
Cloud

│

├── Load Balancer

│

├── Next.js

│

├── Server Actions

│

├── Prisma

│

├── PostgreSQL

│

└── Object Storage
```

Tous les services doivent être **stateless**.

---

# 13. Isolation des données

Toutes les tables métier doivent comporter :

```sql
tenant_id UUID NOT NULL
```

Exemple :

```sql
CREATE TABLE students (

    id UUID,

    tenant_id UUID,

    first_name,

    last_name,

    ...

);
```

Aucune requête SQL ne peut ignorer le filtre :

```
tenant_id
```

---

# 14. Hiérarchie institutionnelle

EduWeb adopte une hiérarchie permettant un déploiement multi-pays.

```text
Plateforme EduWeb

│

├── Pays

│     ├── Région

│     │      ├── Département

│     │      │      ├── DRENA

│     │      │      │      ├── Établissements

│     │      │      │      │      ├── Classes

│     │      │      │      │      └── Utilisateurs
```

Cette hiérarchie est extensible selon les organisations (enseignement public, privé, confessionnel, technique ou universitaire).

---

# 15. Documents associés

- STD-013 — ARCHITECTURE-STANDARDS
- STD-014 — DDD-STANDARDS
- STD-016 — SECURITY-STANDARDS
- STD-018 — RBAC-STANDARDS
- STD-028 — CONFIGURATION-STANDARDS
- STD-040 — ENGINEERING-HANDBOOK

---

## PARTIE 2/4 — Implémentation avec Next.js 15, Prisma ORM et Neon PostgreSQL

---

# Sommaire de la partie

16. Principes d'implémentation
17. Organisation des projets
18. Modèle Prisma
19. Middleware de résolution du Tenant
20. Tenant Context
21. Repositories Multi-Tenant
22. Server Actions
23. API Routes
24. Transactions
25. Performances
26. Cache
27. Migrations
28. Seed
29. Tests
30. Checklist

---

# 16. Principes d'implémentation

Toutes les applications EduWeb utilisent le même principe :

```
HTTP Request

↓

Middleware

↓

Tenant Resolver

↓

Tenant Context

↓

Authentication

↓

Authorization

↓

Business Layer

↓

Repository

↓

Prisma

↓

Neon PostgreSQL
```

Aucun composant métier ne doit rechercher lui-même le tenant.

Le Tenant Context est construit une seule fois.

---

# 17. Organisation des projets

Structure recommandée.

```text
src/

├── app/

├── components/

├── features/

├── lib/

│      ├── tenant/

│      ├── auth/

│      ├── prisma/

│      └── cache/

├── repositories/

├── services/

├── middleware.ts

└── prisma/
```

---

Le dossier `tenant/` contient :

```text
tenant/

├── resolver.ts

├── context.ts

├── tenant.service.ts

├── tenant.repository.ts

├── tenant.types.ts

└── tenant.errors.ts
```

---

# 18. Modèle Prisma

Tous les modèles métier héritent d'un socle commun.

```prisma
model School {

    id String @id @default(uuid())

    tenantId String

    name String

    city String

    country String

}
```

---

Exemple :

```prisma
model Student {

    id String @id @default(uuid())

    tenantId String

    classId String

    firstName String

    lastName String

}
```

---

Chaque modèle doit posséder :

- tenantId
- createdAt
- updatedAt

---

Les index sont obligatoires.

```prisma
@@index([tenantId])

@@index([tenantId, classId])

@@index([tenantId, lastName])
```

---

Aucun modèle métier ne peut être créé sans index tenant.

---

# 19. Middleware de résolution du Tenant

Toutes les requêtes passent par un middleware.

```text
Incoming Request

↓

Resolve Tenant

↓

Resolve User

↓

Create Context

↓

Continue
```

---

Exemple simplifié.

```typescript
export function resolveTenant(request) {

    const hostname = request.headers.get("host");

    ...

}
```

---

Priorité officielle :

1.

Sous-domaine

↓

2.

Header HTTP

↓

3.

JWT

↓

4.

URL

---

Le middleware ne doit jamais interroger plusieurs fois la base.

---

# 20. Tenant Context

Le Tenant Context devient disponible partout.

```typescript
type TenantContext = {

    tenantId: string;

    organizationId: string;

    language: string;

    timezone: string;

    subscription: Subscription;

};
```

---

Ce contexte est injecté automatiquement.

Exemple.

```typescript
const tenant = getTenantContext();
```

---

Le contexte est :

- immutable ;
- typé ;
- partagé.

---

# 21. Repositories Multi-Tenant

Tous les repositories appliquent automatiquement :

```
WHERE tenant_id = currentTenant
```

Exemple.

```typescript
await prisma.student.findMany({

    where: {

        tenantId

    }

});
```

---

Interdiction absolue :

```typescript
findMany()
```

sans clause :

```
tenantId
```

---

Bonne pratique.

Créer une classe de base.

```typescript
BaseRepository
```

qui ajoute automatiquement le filtre.

---

Exemple.

```typescript
class StudentRepository extends BaseRepository {

}
```

---

Le BaseRepository garantit :

- isolation ;
- sécurité ;
- cohérence.

---

# 22. Server Actions

Toutes les Server Actions reçoivent :

```
Tenant Context

+

Current User
```

Exemple.

```typescript
export async function createStudent(

    data

) {

    const tenant = getTenantContext();

}
```

---

La Server Action ne doit jamais recevoir :

```
tenantId
```

depuis le navigateur.

Le tenant provient uniquement du serveur.

---

# 23. API Routes

Même principe.

```text
Route

↓

Middleware

↓

Tenant Resolver

↓

Business Service
```

---

Toutes les API répondent uniquement sur le tenant courant.

---

Exemple.

```typescript
GET

/api/students
```

↓

Retourne uniquement :

```
Tenant A
```

si connecté sur :

```
Tenant A
```

---

# 24. Transactions

Les transactions Prisma respectent également :

```
tenantId
```

Exemple.

```typescript
await prisma.$transaction([
...
]);
```

---

Les transactions inter-tenant sont interdites.

---

Exception.

Migration administrateur.

---

# 25. Performances

Objectifs.

| Élément | Cible |
|----------|-------|
| Résolution Tenant | <10 ms |
| Context Builder | <5 ms |
| Prisma Query | <100 ms |

---

Optimisations.

Toujours :

- indexer tenantId ;

- utiliser des index composites ;

- paginer ;

- limiter les colonnes.

---

Éviter.

```typescript
include: {

    ...

}
```

sur plusieurs niveaux.

---

# 26. Cache

Le cache est segmenté par tenant.

Jamais :

```
students
```

Toujours :

```
tenantA:students
```

ou

```
tenantId:students
```

---

Exemple.

```
cache:

tenant_458

↓

dashboard
```

---

Le cache d'un tenant ne doit jamais être partagé.

---

# 27. Migrations

Les migrations suivent :

```
Prisma

↓

Migration

↓

Validation

↓

Déploiement
```

---

Chaque migration est :

- versionnée ;

- testée ;

- documentée.

---

Les migrations de structure sont identiques pour tous les tenants.

---

Les migrations de données peuvent être :

- globales ;

- ciblées ;

- progressives.

---

# 28. Seed

Le seed initialise.

Exemple.

```
Tenant Demo

↓

School

↓

Users

↓

Classes

↓

Students
```

---

Les données de démonstration doivent être clairement identifiées.

---

Jamais de données réelles.

---

# 29. Tests

Chaque fonctionnalité est testée sur plusieurs tenants.

Exemple.

```
Tenant A

↓

Créer étudiant

↓

OK

Tenant B

↓

Aucun étudiant visible
```

---

Tests obligatoires.

- isolation

- authentification

- permissions

- pagination

- recherche

- statistiques

---

Tests E2E.

```text
Créer

↓

Modifier

↓

Supprimer

↓

Changer de Tenant

↓

Vérifier l'isolation
```

---

# 30. Checklist

## Architecture

- [ ] Tenant Resolver unique

- [ ] Context immutable

- [ ] Middleware validé

---

## Prisma

- [ ] tenantId partout

- [ ] Index présents

- [ ] Contraintes

---

## Backend

- [ ] Repository sécurisé

- [ ] Server Actions sécurisées

- [ ] API sécurisées

---

## Performance

- [ ] Cache segmenté

- [ ] Index composites

- [ ] Pagination

---

## Tests

- [ ] Multi-tenant

- [ ] Sécurité

- [ ] Régression

---

## Documents associés

- STD-005 — PRISMA-STANDARDS
- STD-006 — NEON-STANDARDS
- STD-011 — API-STANDARDS
- STD-012 — BACKEND-STANDARDS
- STD-020 — PERFORMANCE-STANDARDS
- STD-025 — CICD-STANDARDS

---

## PARTIE 3/4 — Sécurité, RBAC, Gouvernance et Exploitation SaaS

---

# Sommaire de la partie

31. Sécurité Multi-Tenant
32. Isolation applicative
33. RBAC Multi-Tenant
34. Gestion des abonnements
35. Quotas
36. Personnalisation (Branding)
37. Domaines personnalisés
38. Gouvernance des Tenants
39. Monitoring
40. Journalisation
41. Sauvegardes
42. Archivage
43. Migration d'un Tenant
44. Suppression d'un Tenant
45. Conformité
46. Checklists Enterprise

---

# 31. Sécurité Multi-Tenant

La sécurité constitue le pilier principal de l'architecture Multi-Tenant.

Chaque requête doit garantir simultanément :

- l'identification du tenant ;
- l'authentification de l'utilisateur ;
- l'autorisation des actions ;
- l'isolation des données ;
- la traçabilité.

Une violation de l'un de ces principes constitue un incident critique.

---

## Principe fondamental

```
Utilisateur

↓

Authentification

↓

Tenant

↓

RBAC

↓

Business Rules

↓

Database
```

L'ordre est impératif.

---

# 32. Isolation applicative

L'isolation doit exister à plusieurs niveaux.

## Niveau 1 — Interface

Un utilisateur ne doit jamais voir :

- le logo d'un autre établissement ;
- les menus d'un autre établissement ;
- les données d'un autre établissement.

---

## Niveau 2 — API

Toutes les routes API doivent vérifier :

```
tenantId

+

userId
```

---

## Niveau 3 — Base de données

Toutes les requêtes comportent :

```sql
WHERE tenant_id = ?
```

---

## Niveau 4 — Cache

Le cache est totalement isolé.

Exemple :

```
tenant-a:dashboard

tenant-b:dashboard
```

Jamais :

```
dashboard
```

---

## Niveau 5 — Stockage

Les fichiers sont organisés ainsi :

```text
storage/

├── tenant-a/

├── tenant-b/

├── tenant-c/
```

Aucun répertoire partagé n'est autorisé pour les données métier.

---

# 33. RBAC Multi-Tenant

Les rôles sont définis à deux niveaux.

## Niveau Plateforme

- Platform Owner
- Platform Administrator
- Support
- Billing

Ces rôles sont gérés exclusivement par EduWeb.

---

## Niveau Tenant

Chaque tenant possède sa propre hiérarchie.

Exemple :

```
Directeur

↓

Proviseur

↓

Censeur

↓

Économe

↓

Secrétaire

↓

Enseignant

↓

Élève

↓

Parent
```

---

Les permissions sont toujours évaluées dans le contexte du tenant.

Exemple :

```text
Utilisateur A

↓

Directeur

↓

Tenant A
```

n'est jamais directeur dans :

```
Tenant B
```

---

## Permissions

Exemple :

```typescript
Permission

↓

student.read

student.create

student.update

student.delete

schedule.generate

teacher.assign

report.export
```

---

Chaque permission est :

- explicite ;
- documentée ;
- testée.

---

# 34. Gestion des abonnements

Chaque tenant possède un abonnement.

Exemple :

```text
Free

↓

Starter

↓

Professional

↓

Enterprise

↓

Government
```

---

Les fonctionnalités sont pilotées par abonnement.

Exemple :

| Fonctionnalité | Free | Pro |
|---------------|------|-----|
| Emploi du temps | ✔ | ✔ |
| IA | ✘ | ✔ |
| API | ✘ | ✔ |
| Multi-campus | ✘ | ✔ |
| Domaine personnalisé | ✘ | ✔ |

---

Aucune règle métier ne doit être codée "en dur".

Les fonctionnalités doivent être pilotées par des **Feature Flags**.

---

# 35. Quotas

Chaque abonnement définit des limites.

Exemple.

| Élément | Free | Enterprise |
|----------|------|------------|
| Élèves | 500 | Illimité |
| Enseignants | 50 | Illimité |
| Stockage | 5 Go | 2 To |
| IA | 100 requêtes/jour | Illimité |

---

Les quotas sont vérifiés avant toute opération.

---

# 36. Personnalisation (Branding)

Chaque tenant possède sa propre identité.

## Logo

```text
/logo.png
```

---

## Couleurs

```yaml
primary:

secondary:

accent:
```

---

## Police

Le tenant peut choisir une police parmi une liste validée.

---

## Paramètres

Exemple :

```yaml
Nom

Devise

Pays

Langue

Fuseau horaire

Adresse

Téléphone

Email

Site Web
```

---

La personnalisation ne doit jamais modifier le comportement métier.

---

# 37. Domaines personnalisés

Exemples.

```
planner.eduweb.ci
```

↓

```
planning.lycee-x.ci
```

↓

```
campus.universite-y.edu
```

---

Le système doit gérer automatiquement :

- SSL ;
- DNS ;
- redirections ;
- renouvellement des certificats.

---

# 38. Gouvernance des Tenants

Chaque tenant possède un état.

```
Créé

↓

En attente

↓

Actif

↓

Suspendu

↓

Archivé

↓

Supprimé
```

---

Les changements d'état sont historisés.

---

Exemple.

```text
2027-02-15

↓

Activation

↓

Administrateur
```

---

# 39. Monitoring

Les indicateurs sont suivis par tenant.

Exemple.

- nombre de connexions ;

- utilisateurs actifs ;

- emplois du temps générés ;

- stockage utilisé ;

- temps de réponse ;

- erreurs ;

- consommation IA.

---

Dashboard.

```text
Tenant

↓

Usage

↓

Performance

↓

Sécurité

↓

Facturation
```

---

# 40. Journalisation

Tous les événements critiques sont enregistrés.

Exemple.

```
Connexion

Déconnexion

Création utilisateur

Suppression

Modification

Export

Import

Paiement

Activation IA
```

---

Exemple.

```json
{
    "tenantId": "...",
    "userId": "...",
    "action": "CREATE_STUDENT",
    "timestamp": "...",
    "ip": "...",
    "device": "..."
}
```

---

Les journaux sont immuables.

---

# 41. Sauvegardes

Politique officielle.

## Quotidienne

Toutes les nuits.

---

## Hebdomadaire

Chaque dimanche.

---

## Mensuelle

Premier jour du mois.

---

## Annuelle

Archive complète.

---

Chaque sauvegarde est testée.

---

# 42. Archivage

Lorsqu'un établissement quitte la plateforme.

```
Actif

↓

Suspendu

↓

Archivé

↓

Suppression
```

---

L'archivage est :

- compressé ;
- chiffré ;
- indexé.

---

Durée recommandée.

```
10 ans
```

pour les données administratives.

---

# 43. Migration d'un Tenant

Exemple.

```
Shared Database

↓

Dedicated Schema

↓

Dedicated Database
```

---

La migration doit être :

- transparente ;

- atomique ;

- réversible.

---

Étapes.

```
Sauvegarde

↓

Validation

↓

Migration

↓

Tests

↓

Bascule

↓

Surveillance
```

---

# 44. Suppression d'un Tenant

Avant suppression.

- sauvegarde ;

- validation ;

- export ;

- confirmation.

---

Suppression logique.

```
deleted_at
```

---

Suppression physique uniquement après expiration du délai légal.

---

# 45. Conformité

Le système doit permettre le respect des réglementations applicables.

Exigences.

- confidentialité ;

- intégrité ;

- disponibilité ;

- auditabilité ;

- portabilité des données ;

- droit à l'effacement lorsque la réglementation le permet.

---

Chaque accès aux données personnelles est journalisé.

---

Les exports doivent être disponibles dans des formats ouverts.

---

# 46. Checklists Enterprise

## Sécurité

- [ ] Tenant identifié

- [ ] Utilisateur authentifié

- [ ] RBAC appliqué

- [ ] Permissions vérifiées

- [ ] Journalisation active

---

## Isolation

- [ ] Base de données

- [ ] Cache

- [ ] Stockage

- [ ] API

- [ ] Interface

---

## Gouvernance

- [ ] Abonnement valide

- [ ] Quotas contrôlés

- [ ] Branding configuré

- [ ] Domaine validé

---

## Exploitation

- [ ] Sauvegarde effectuée

- [ ] Monitoring actif

- [ ] Alertes configurées

- [ ] Archivage documenté

---

## Documents associés

- STD-016 — SECURITY-STANDARDS
- STD-017 — AUTH-STANDARDS
- STD-018 — RBAC-STANDARDS
- STD-021 — OBSERVABILITY-STANDARDS
- STD-022 — LOGGING-STANDARDS
- STD-024 — DEPLOYMENT-STANDARDS
- STD-042 — AUDIT-STANDARDS

---

## PARTIE 4/4 — Exploitation Enterprise, Haute Disponibilité et Gouvernance

---

# Sommaire de la partie

47. Haute Disponibilité
48. Scalabilité
49. Architecture Multi-Pays
50. Résilience
51. Disaster Recovery
52. CI/CD Multi-Tenant
53. Observabilité
54. SLA, SLO et SLI
55. Capacity Planning
56. Coût d'exploitation
57. Anti-patterns
58. Bonnes pratiques
59. ADR recommandés
60. Checklist finale Enterprise
61. Conclusion
62. Documents associés

---

# 47. Haute Disponibilité

L'ensemble des services EduWeb doit être conçu pour assurer une disponibilité minimale de :

```
99,9 %
```

Pour les offres Government et Enterprise :

```
99,95 %
```

Pour y parvenir :

- services stateless ;
- déploiements sans interruption ;
- montée en charge horizontale ;
- supervision continue ;
- sauvegardes automatiques.

---

## Architecture recommandée

```text
                Internet

                    │

          Load Balancer (HA)

                    │

      ┌─────────────┴─────────────┐

      │                           │

 Next.js Instance 1        Next.js Instance 2

      │                           │

      └─────────────┬─────────────┘

                    │

              Prisma ORM

                    │

          Neon PostgreSQL (HA)

                    │

          Object Storage (HA)
```

Tous les composants critiques doivent être redondés.

---

# 48. Scalabilité

Le système doit évoluer sans modification du code.

Objectifs :

| Élément | Capacité cible |
|----------|---------------:|
| Pays | Illimité |
| Régions | Illimité |
| Établissements | > 100 000 |
| Utilisateurs | > 10 000 000 |
| Sessions simultanées | > 100 000 |

---

## Scalabilité horizontale

Toujours privilégier :

```
Ajouter des instances

plutôt que

Augmenter la puissance d'un serveur
```

---

## Scalabilité verticale

Autorisée uniquement :

- temporairement ;
- lors de migrations ;
- pour des traitements exceptionnels.

---

# 49. Architecture Multi-Pays

EduWeb est conçu pour fonctionner dans plusieurs États.

Hiérarchie de référence :

```text
EduWeb

│

├── Pays

│     ├── Ministère

│     │      ├── Académie

│     │      │      ├── Région

│     │      │      │      ├── Inspection

│     │      │      │      │      ├── Établissement

│     │      │      │      │      │      ├── Classe

│      │      │      │      │      │      └── Utilisateurs
```

---

Chaque pays peut personnaliser :

- calendrier scolaire ;
- devise ;
- fuseau horaire ;
- langues ;
- programmes scolaires ;
- niveaux d'enseignement ;
- règles administratives.

Le cœur applicatif reste unique.

---

# 50. Résilience

L'application doit continuer à fonctionner malgré :

- la perte d'une instance ;
- une coupure réseau temporaire ;
- une panne de cache ;
- un redémarrage applicatif.

---

Les traitements longs doivent être :

- asynchrones ;
- rejouables ;
- idempotents.

---

Exemple :

```
Génération des emplois du temps

↓

Queue

↓

Worker

↓

Notification
```

---

# 51. Disaster Recovery

Chaque environnement possède un PRA (Plan de Reprise d'Activité).

Objectifs :

| Indicateur | Cible |
|------------|------:|
| RPO | ≤ 15 min |
| RTO | ≤ 1 h |

---

## Procédure

```text
Incident

↓

Détection

↓

Alerte

↓

Analyse

↓

Restauration

↓

Validation

↓

Reprise
```

---

Chaque scénario doit être testé au minimum une fois par an.

---

# 52. CI/CD Multi-Tenant

Le pipeline de déploiement est unique.

```text
GitHub

↓

CI

↓

Tests

↓

Build

↓

Analyse Sécurité

↓

Préproduction

↓

Validation

↓

Production
```

---

Les migrations sont :

- compatibles avec les versions précédentes ;
- sans interruption de service lorsque possible ;
- réversibles.

---

Les Feature Flags permettent un déploiement progressif.

Exemple :

```
Nouvelle IA

↓

5 % des tenants

↓

25 %

↓

50 %

↓

100 %
```

---

# 53. Observabilité

Chaque tenant dispose de métriques dédiées.

## Indicateurs techniques

- temps de réponse ;
- consommation CPU ;
- mémoire ;
- erreurs ;
- disponibilité.

---

## Indicateurs métier

- emplois du temps générés ;
- enseignants actifs ;
- élèves inscrits ;
- connexions quotidiennes ;
- exports réalisés.

---

## Tableau de bord

```text
Tenant

↓

Disponibilité

↓

Performance

↓

Sécurité

↓

Utilisation

↓

Facturation
```

---

Les métriques sont historisées.

---

# 54. SLA, SLO et SLI

## SLA (Service Level Agreement)

Engagement contractuel.

Exemple :

```
99,95 % de disponibilité
```

---

## SLO (Service Level Objective)

Objectif interne.

Exemple :

```
Temps de réponse moyen

< 300 ms
```

---

## SLI (Service Level Indicator)

Mesure réelle.

Exemple :

```
Temps moyen observé

245 ms
```

---

Les tableaux de bord doivent afficher ces trois niveaux.

---

# 55. Capacity Planning

Une analyse de capacité est réalisée périodiquement.

Éléments suivis :

- croissance des utilisateurs ;
- volume des données ;
- stockage ;
- bande passante ;
- traitements IA ;
- génération des emplois du temps.

---

Les projections sont établies sur :

- 12 mois ;
- 24 mois ;
- 60 mois.

---

# 56. Coût d'exploitation

Le coût est analysé par tenant.

Exemples :

- stockage ;
- calcul ;
- IA ;
- bande passante ;
- notifications ;
- sauvegardes.

---

Objectif :

optimiser les ressources sans dégrader les performances.

---

# 57. Anti-patterns

Les pratiques suivantes sont interdites.

## Accès sans tenant

```typescript
prisma.student.findMany()
```

❌ Interdit.

---

## Tenant transmis par le client

```typescript
createStudent({

    tenantId: "...",

})
```

❌ Interdit.

Le serveur détermine seul le tenant.

---

## Cache partagé

```
dashboard
```

❌

Toujours :

```
tenantId:dashboard
```

---

## Permissions codées en dur

```typescript
if(user.role === "ADMIN")
```

❌

Toujours utiliser un service RBAC.

---

## SQL sans filtre

```sql
SELECT *

FROM students;
```

❌

Toujours :

```sql
SELECT *

FROM students

WHERE tenant_id = ?;
```

---

# 58. Bonnes pratiques

Toujours :

- centraliser la résolution du tenant ;
- injecter le contexte métier ;
- journaliser les opérations sensibles ;
- utiliser des identifiants UUID ;
- tester plusieurs tenants simultanément ;
- documenter les migrations ;
- surveiller les quotas.

---

Ne jamais :

- mélanger les données ;
- contourner le middleware ;
- exposer les identifiants internes ;
- désactiver les contrôles RBAC.

---

# 59. ADR recommandés

Les décisions suivantes doivent être documentées sous forme d'ADR :

- choix du modèle Multi-Tenant ;
- stratégie de migration ;
- politique de sauvegarde ;
- architecture des abonnements ;
- politique de cache ;
- stratégie de branding ;
- gestion des domaines personnalisés ;
- politique de journalisation.

Chaque ADR doit suivre le modèle :

```
STD-036 — ADR-TEMPLATE
```

---

# 60. Checklist finale Enterprise

## Architecture

- [ ] Tenant Resolver unique
- [ ] Tenant Context immuable
- [ ] Architecture documentée

---

## Base de données

- [ ] `tenantId` présent sur tous les modèles
- [ ] Index validés
- [ ] Migrations testées

---

## Sécurité

- [ ] Isolation vérifiée
- [ ] RBAC opérationnel
- [ ] Journaux d'audit actifs

---

## SaaS

- [ ] Abonnements configurés
- [ ] Quotas actifs
- [ ] Branding personnalisé

---

## Exploitation

- [ ] Sauvegardes automatiques
- [ ] Monitoring actif
- [ ] Alertes configurées
- [ ] PRA testé

---

## Performance

- [ ] Cache segmenté
- [ ] Pagination
- [ ] Optimisation SQL

---

## Qualité

- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Tests E2E
- [ ] Tests multi-tenant

---

# 61. Conclusion

L'architecture Multi-Tenant constitue le socle de l'ensemble des applications EduWeb.

Elle permet :

- une exploitation mutualisée ;
- une isolation stricte des organisations ;
- une montée en charge progressive ;
- une personnalisation complète ;
- une gouvernance centralisée.

Le respect de ce standard est obligatoire pour tout nouveau module intégré à l'écosystème EduWeb.

---

# 62. Documents associés

## Standards fondamentaux

- STD-013 — ARCHITECTURE-STANDARDS
- STD-014 — DDD-STANDARDS
- STD-016 — SECURITY-STANDARDS
- STD-017 — AUTH-STANDARDS
- STD-018 — RBAC-STANDARDS
- STD-020 — PERFORMANCE-STANDARDS
- STD-021 — OBSERVABILITY-STANDARDS
- STD-022 — LOGGING-STANDARDS
- STD-024 — DEPLOYMENT-STANDARDS
- STD-025 — CICD-STANDARDS
- STD-028 — CONFIGURATION-STANDARDS
- STD-036 — ADR-TEMPLATE
- STD-040 — ENGINEERING-HANDBOOK

## Standards Enterprise

- STD-042 — AUDIT-STANDARDS
- STD-043 — SCHEDULER-STANDARDS
- STD-044 — REPORTING-STANDARDS
- STD-045 — SEARCH-STANDARDS
- STD-046 — NOTIFICATION-STANDARDS
- STD-047 — IMPORT-EXPORT-STANDARDS
- STD-048 — AI-STANDARDS
- STD-049 — ACCESSIBILITY-STANDARDS
- STD-050 — INTERNATIONALIZATION-STANDARDS

---

# Historique des versions

| Version | Date | Auteur | Description |
|---------:|------|--------|-------------|
| 1.0 | 2026 | EduWeb Architecture Team | Première version officielle |

---

# Fin du document
