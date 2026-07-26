---
title: Audit Standards
version: 1.0
status: Official
category: Enterprise Architecture
code: STD-042
authors:
  - EduWeb Architecture Team
---

# AUDIT-STANDARDS.md

> Standard officiel de conception, d'implémentation et d'exploitation du système d'audit de l'écosystème EduWeb.

---

# Sommaire

1. Objectif
2. Champ d'application
3. Définitions
4. Principes fondamentaux
5. Architecture d'audit
6. Types d'audit
7. Événements auditables
8. Cycle de vie d'un événement
9. Architecture logique
10. Architecture physique
11. Documents associés

---

# 1. Objectif

L'audit constitue un élément essentiel de la gouvernance des applications EduWeb.

Il permet :

- d'assurer la traçabilité des opérations ;
- d'identifier les responsabilités ;
- de faciliter les enquêtes ;
- de répondre aux exigences réglementaires ;
- de produire des rapports fiables ;
- d'améliorer la sécurité.

Toutes les applications EduWeb doivent implémenter ce standard.

---

# 2. Champ d'application

Ce document couvre notamment :

- EduWeb Planner
- EduWeb Governance
- EduWeb Booking
- EduWeb Family
- E-School
- API publiques
- API internes
- Portails administratifs

---

Les événements concernés comprennent :

- connexions ;
- authentifications ;
- modifications de données ;
- suppressions ;
- exports ;
- imports ;
- paiements ;
- opérations IA ;
- changements de configuration.

---

# 3. Définitions

## 3.1 Audit

Enregistrement immuable d'une action significative réalisée sur la plateforme.

---

## 3.2 Audit Trail

Suite chronologique des événements permettant de reconstituer l'historique complet d'une opération.

---

## 3.3 Audit Record

Enregistrement individuel contenant toutes les informations relatives à un événement.

---

## 3.4 Audit Log

Collection structurée des Audit Records.

---

## 3.5 Audit Event

Événement déclenchant la création automatique d'un Audit Record.

---

# 4. Principes fondamentaux

Le système d'audit repose sur les principes suivants.

## Intégrité

Un journal d'audit ne peut jamais être modifié.

---

## Immutabilité

Une fois enregistré :

```
Aucune modification
```

---

## Horodatage

Tous les événements utilisent :

```
UTC
```

comme référence.

---

## Exhaustivité

Tout événement critique est enregistré.

---

## Traçabilité

Chaque action est reliée :

- à un utilisateur ;
- à un tenant ;
- à une session ;
- à un terminal.

---

## Confidentialité

Les journaux sont protégés.

Seules les personnes autorisées peuvent les consulter.

---

# 5. Architecture d'audit

```
Utilisateur

↓

Authentification

↓

Application

↓

Audit Service

↓

Audit Queue

↓

Audit Storage

↓

Reporting
```

---

Le service d'audit est totalement indépendant des règles métier.

---

# 6. Types d'audit

## Audit Fonctionnel

Suit les opérations métier.

Exemples :

- création d'un élève ;
- affectation d'un enseignant ;
- génération d'un emploi du temps.

---

## Audit Administratif

Suit :

- paramètres ;
- rôles ;
- utilisateurs ;
- établissements.

---

## Audit Sécurité

Suit :

- connexions ;
- échecs ;
- changement de mot de passe ;
- MFA ;
- permissions.

---

## Audit Technique

Suit :

- erreurs serveur ;
- déploiements ;
- migrations ;
- traitements batch.

---

## Audit IA

Suit :

- prompts ;
- modèles utilisés ;
- résultats générés ;
- validation humaine.

---

# 7. Événements auditables

Les événements sont classés.

## Authentification

- LOGIN
- LOGOUT
- LOGIN_FAILED
- PASSWORD_CHANGED
- MFA_ENABLED

---

## Utilisateurs

- USER_CREATED
- USER_UPDATED
- USER_DISABLED
- USER_DELETED

---

## Établissements

- SCHOOL_CREATED
- SCHOOL_UPDATED
- SCHOOL_ARCHIVED

---

## Élèves

- STUDENT_CREATED
- STUDENT_UPDATED
- STUDENT_TRANSFERRED
- STUDENT_DELETED

---

## Enseignants

- TEACHER_CREATED
- TEACHER_ASSIGNED
- TEACHER_REMOVED

---

## Emplois du temps

- TIMETABLE_GENERATED
- TIMETABLE_UPDATED
- TIMETABLE_PUBLISHED

---

## Documents

- EXPORT_PDF
- EXPORT_EXCEL
- IMPORT_CSV

---

## Paiements

- PAYMENT_STARTED
- PAYMENT_COMPLETED
- PAYMENT_FAILED

---

## Intelligence Artificielle

- AI_REQUEST
- AI_RESPONSE
- AI_APPROVED
- AI_REJECTED

---

# 8. Cycle de vie d'un événement

```text
Action

↓

Validation

↓

Audit Event

↓

Audit Queue

↓

Audit Storage

↓

Reporting

↓

Archivage
```

---

Le processus est entièrement automatique.

---

# 9. Architecture logique

Chaque événement est composé de :

```text
Who ?

↓

What ?

↓

When ?

↓

Where ?

↓

Why ?

↓

Result ?
```

---

Chaque Audit Record répond à ces six questions.

---

# 10. Architecture physique

```text
Application

↓

Audit Service

↓

Message Queue

↓

Audit Database

↓

Archive

↓

BI
```

---

Le stockage des audits est séparé des données métier.

---

# 11. Documents associés

- STD-016 — SECURITY-STANDARDS
- STD-021 — OBSERVABILITY-STANDARDS
- STD-022 — LOGGING-STANDARDS
- STD-041 — MULTI-TENANCY-STANDARDS
- STD-048 — AI-STANDARDS

---

## 12. Modèle de données d'audit

Le système d'audit repose sur un modèle unique permettant d'assurer la traçabilité complète des opérations.

Le modèle de référence est le suivant.

```prisma
model AuditLog {

    id              String   @id @default(uuid())

    tenantId        String?

    organizationId  String?

    userId          String?

    sessionId       String?

    eventType       String

    resourceType    String

    resourceId      String?

    action          String

    status          String

    severity        String

    ipAddress       String?

    userAgent       String?

    device          String?

    metadata        Json?

    createdAt       DateTime @default(now())

    @@index([tenantId])

    @@index([userId])

    @@index([eventType])

    @@index([createdAt])

}
```

---

Tous les champs sont documentés.

| Champ | Description |
|---------|-------------|
| tenantId | Tenant concerné |
| organizationId | Organisation |
| userId | Auteur |
| sessionId | Session |
| eventType | Catégorie |
| resourceType | Objet métier |
| resourceId | Identifiant métier |
| action | Action réalisée |
| status | Succès / Échec |
| severity | Niveau |
| metadata | Informations complémentaires |

---

## 13. Classification des événements

Les événements sont classés selon leur importance.

### Information

Aucune incidence.

Exemples :

- connexion réussie ;
- consultation d'un rapport ;
- téléchargement.

---

### Warning

Situation inhabituelle.

Exemples :

- plusieurs tentatives de connexion ;
- dépassement d'un quota ;
- accès refusé.

---

### Error

Erreur applicative.

Exemples :

- échec de sauvegarde ;
- erreur Prisma ;
- API indisponible.

---

### Critical

Incident majeur.

Exemples :

- tentative d'intrusion ;
- modification des permissions système ;
- suppression massive.

---

## 14. Taxonomie des actions

Les actions suivent une nomenclature normalisée.

```
CREATE

READ

UPDATE

DELETE

IMPORT

EXPORT

LOGIN

LOGOUT

GENERATE

VALIDATE

APPROVE

REJECT

ARCHIVE

RESTORE

CONFIGURE
```

Cette nomenclature est utilisée dans toute la plateforme.

---

## 15. Métadonnées obligatoires

Chaque événement contient obligatoirement :

```yaml
tenantId

userId

sessionId

timestamp

ipAddress

userAgent

action

resourceType

resourceId

status
```

Les métadonnées doivent être suffisantes pour reconstruire précisément le contexte d'une opération.

---

## 16. Middleware d'audit

Toutes les requêtes passent par un middleware d'audit.

```text
Request

↓

Authentication

↓

Authorization

↓

Business Logic

↓

Audit Middleware

↓

Audit Queue
```

Le middleware ne bloque jamais la réponse utilisateur.

L'écriture du journal est asynchrone.

---

## 17. Audit des Server Actions

Toutes les Server Actions critiques doivent produire un Audit Event.

Exemple.

```typescript
await auditService.record({

    action: "CREATE_STUDENT",

    resourceType: "Student",

    resourceId: student.id

});
```

Les événements sont générés automatiquement par un service dédié.

---

## 18. Audit des API

Chaque endpoint documenté est associé à un type d'événement.

Exemple.

```
POST /students

↓

STUDENT_CREATED
```


```
DELETE /students/{id}

↓

STUDENT_DELETED
```


```
POST /timetable/generate

↓

TIMETABLE_GENERATED
```

---

## 19. Audit des traitements batch

Les traitements automatiques sont également audités.

Exemple.

```
Cron

↓

Calcul des statistiques

↓

Audit

↓

Rapport
```

Les informations suivantes sont enregistrées :

- durée ;
- nombre d'enregistrements ;
- résultat ;
- erreurs éventuelles.

---

## 20. Audit des exports

Les exports constituent des événements sensibles.

Exemple.

```
Export Excel

↓

Utilisateur

↓

Classe Terminale C

↓

85 élèves
```

Le journal contient :

- format ;
- volume ;
- destinataire ;
- justification éventuelle.

---

## 21. Audit des imports

Chaque import comporte :

- fichier source ;
- utilisateur ;
- date ;
- nombre de lignes ;
- lignes rejetées ;
- erreurs détectées.

Un identifiant d'import est attribué.

---

## 22. Audit des connexions

Chaque connexion enregistre :

```yaml
Date

Heure

Adresse IP

Navigateur

Système

Ville (si disponible)

Pays (si disponible)

Succès / Échec
```

---

## 23. Audit des permissions

Chaque changement de rôle produit un événement.

Exemple.

```
ROLE_GRANTED
```


```
ROLE_REVOKED
```

Les permissions supprimées sont historisées.

---

## 24. Audit des paramètres

Toute modification de configuration est tracée.

Exemple.

```
Année scolaire

↓

2026-2027

↓

2027-2028
```

Le journal indique :

- ancienne valeur ;
- nouvelle valeur ;
- auteur ;
- justification.

---

## 25. Audit des emplois du temps

Chaque génération d'emploi du temps produit :

```
Nombre de classes

↓

Contraintes

↓

Algorithme

↓

Durée

↓

Résultat
```

Les paramètres utilisés sont archivés afin de permettre une reproduction ultérieure.

---

## 26. Audit des opérations IA

Chaque interaction IA est historisée.

Informations minimales :

- modèle utilisé ;
- version ;
- durée ;
- nombre de jetons ;
- utilisateur ;
- validation humaine.

Le contenu du prompt peut être masqué lorsqu'il contient des données sensibles.

---

## 27. Audit des erreurs

Les erreurs critiques déclenchent automatiquement :

- un Audit Event ;
- une alerte ;
- une journalisation technique.

Les erreurs sont corrélées avec les identifiants de session.

---

## 28. Recherche dans les audits

Le moteur de recherche doit permettre des filtres sur :

- tenant ;
- utilisateur ;
- période ;
- action ;
- ressource ;
- gravité ;
- résultat.

Les recherches sont paginées.

---

## 29. Conservation

Durées recommandées.

| Type | Durée |
|-------|-------|
| Audit fonctionnel | 5 ans |
| Audit administratif | 10 ans |
| Audit sécurité | 10 ans |
| Audit financier | Selon la réglementation |
| Audit IA | 5 ans |

Les archives sont chiffrées.

---

## 30. Checklist

### Architecture

- [ ] Service d'audit indépendant

- [ ] Queue configurée

- [ ] Stockage dédié

---

### Sécurité

- [ ] Journaux immuables

- [ ] Accès restreint

- [ ] Chiffrement

---

### Développement

- [ ] Middleware actif

- [ ] Server Actions auditées

- [ ] API auditées

---

### Exploitation

- [ ] Archivage

- [ ] Sauvegarde

- [ ] Rotation des journaux

---

## 31. Reporting d'audit

Le système d'audit doit permettre la production de rapports adaptés aux différents profils d'utilisateurs.

### Rapports opérationnels

Destinés aux administrateurs des établissements.

Exemples :

- connexions quotidiennes ;
- modifications des emplois du temps ;
- création de comptes ;
- exports réalisés.

---

### Rapports de sécurité

Destinés aux administrateurs techniques.

Ils présentent notamment :

- tentatives de connexion échouées ;
- comptes verrouillés ;
- élévations de privilèges ;
- modifications des rôles ;
- accès inhabituels.

---

### Rapports réglementaires

Destinés aux autorités administratives.

Ils permettent notamment de démontrer :

- l'intégrité des données ;
- la traçabilité ;
- le respect des procédures.

---

## 32. Tableau de bord d'audit

Le tableau de bord comprend plusieurs indicateurs.

### Activité

- Nombre d'événements
- Utilisateurs actifs
- Sessions ouvertes

---

### Sécurité

- Tentatives de connexion
- Comptes bloqués
- Permissions modifiées

---

### Administration

- Paramètres modifiés
- Établissements créés
- Abonnements activés

---

### IA

- Nombre de requêtes
- Temps moyen
- Validation humaine
- Rejets

---

## 33. Alertes automatiques

Certains événements déclenchent immédiatement une alerte.

Exemples :

```
10 connexions échouées

↓

Alerte sécurité
```

---

```
Suppression massive

↓

Notification Administrateur
```

---

```
Export de données sensibles

↓

Notification Responsable
```

---

Les alertes peuvent être envoyées :

- par courriel ;
- par notification interne ;
- par webhook ;
- vers un SIEM.

---

## 34. Corrélation des événements

Le système doit être capable de regrouper plusieurs événements appartenant à une même opération.

Exemple.

```
Connexion

↓

Consultation dossier élève

↓

Modification

↓

Export PDF

↓

Déconnexion
```

L'ensemble constitue une seule séquence métier.

---

## 35. Intégrité cryptographique

Les journaux critiques doivent pouvoir être vérifiés.

Approches recommandées :

- signature numérique ;
- hachage SHA-256 ;
- chaînage des événements ;
- horodatage sécurisé.

---

Exemple.

```text
Audit 001

↓

Hash

↓

Audit 002

↓

Hash

↓

Audit 003
```

Toute modification devient détectable.

---

## 36. Rotation des journaux

Afin de garantir les performances, les journaux sont archivés périodiquement.

Politique recommandée :

| Type | Rotation |
|------|----------|
| Journaux applicatifs | Quotidienne |
| Journaux techniques | Hebdomadaire |
| Journaux d'audit | Mensuelle |
| Archives | Annuelle |

Les archives restent consultables.

---

## 37. Archivage

Les archives doivent être :

- compressées ;
- chiffrées ;
- indexées ;
- signées.

Les supports d'archivage doivent être redondants.

---

## 38. Intégration SIEM

Le système d'audit doit pouvoir transmettre les événements à une plateforme SIEM.

Exemples :

- Microsoft Sentinel
- Splunk
- Elastic Security
- IBM QRadar

Formats recommandés :

- JSON
- Syslog
- CEF

---

## 39. Intégration Business Intelligence

Les données d'audit peuvent alimenter les tableaux de bord décisionnels.

Exemples d'indicateurs :

- activité par établissement ;
- évolution des connexions ;
- utilisation des fonctionnalités ;
- consommation IA ;
- taux d'utilisation des modules.

Les données BI sont anonymisées lorsque nécessaire.

---

## 40. Confidentialité

L'accès aux journaux d'audit est strictement contrôlé.

Rôles autorisés :

- Platform Administrator
- Security Officer
- Auditor
- Tenant Administrator (audit limité à son tenant)

Les utilisateurs ordinaires n'ont jamais accès aux journaux.

---

## 41. Protection des données personnelles

Les journaux ne doivent jamais contenir :

- mots de passe ;
- secrets ;
- jetons d'accès ;
- clés API ;
- données bancaires en clair.

Les informations sensibles sont masquées.

Exemple.

```text
Mot de passe

********
```

---

## 42. Audit des opérations IA

Les traitements d'intelligence artificielle nécessitent une traçabilité renforcée.

Chaque exécution conserve :

- identifiant du modèle ;
- version ;
- utilisateur ;
- durée ;
- coût estimé ;
- validation humaine ;
- décision finale.

Cette traçabilité facilite l'explicabilité des résultats.

---

## 43. Anti-patterns

Les pratiques suivantes sont interdites.

### Suppression d'un journal

❌ Interdite.

---

### Modification d'un Audit Record

❌ Interdite.

---

### Écriture synchrone bloquante

❌ Déconseillée.

Toujours privilégier :

```
Queue

↓

Traitement asynchrone
```

---

### Journal incomplet

Un Audit Record sans :

- utilisateur ;
- date ;
- action ;

est considéré comme invalide.

---

## 44. Bonnes pratiques

Toujours :

- utiliser UTC ;
- générer des UUID ;
- signer les archives ;
- documenter les événements ;
- tester les journaux.

Ne jamais :

- désactiver l'audit en production ;
- enregistrer des secrets ;
- mélanger audit et logs techniques.

---

## 45. ADR recommandés

Les décisions suivantes doivent être documentées :

- stratégie de stockage ;
- durée de conservation ;
- politique d'archivage ;
- intégration SIEM ;
- intégration BI ;
- signature des journaux.

Le modèle officiel est :

```
STD-036 — ADR-TEMPLATE
```

---

## 46. Checklist Enterprise

### Architecture

- [ ] Service d'audit indépendant
- [ ] File de messages configurée
- [ ] Stockage dédié

---

### Développement

- [ ] Toutes les Server Actions auditées
- [ ] Toutes les API critiques auditées
- [ ] Middleware actif

---

### Sécurité

- [ ] Journaux immuables
- [ ] Chiffrement actif
- [ ] Accès RBAC
- [ ] Rotation configurée

---

### Exploitation

- [ ] Archivage automatique
- [ ] Sauvegarde testée
- [ ] SIEM connecté
- [ ] BI alimentée

---

### Qualité

- [ ] Documentation complète
- [ ] ADR rédigés
- [ ] Tests validés

---

## 47. Conclusion

Le système d'audit constitue l'un des piliers de la gouvernance d'EduWeb.

Il garantit :

- la traçabilité complète ;
- la responsabilisation des acteurs ;
- la conformité réglementaire ;
- la sécurité ;
- l'analyse des usages ;
- l'amélioration continue.

Aucune fonctionnalité critique ne doit être développée sans intégration au système d'audit.

---

## Documents associés

### Standards fondamentaux

- STD-016 — SECURITY-STANDARDS
- STD-017 — AUTH-STANDARDS
- STD-018 — RBAC-STANDARDS
- STD-021 — OBSERVABILITY-STANDARDS
- STD-022 — LOGGING-STANDARDS
- STD-023 — ERROR-HANDLING-STANDARDS
- STD-036 — ADR-TEMPLATE
- STD-040 — ENGINEERING-HANDBOOK

### Standards Enterprise

- STD-041 — MULTI-TENANCY-STANDARDS
- STD-043 — SCHEDULER-STANDARDS
- STD-044 — REPORTING-STANDARDS
- STD-045 — SEARCH-STANDARDS
- STD-046 — NOTIFICATION-STANDARDS
- STD-047 — IMPORT-EXPORT-STANDARDS
- STD-048 — AI-STANDARDS

---

## Historique des versions

| Version | Date | Auteur | Description |
|---------:|------|--------|-------------|
| 1.0 | 2026 | EduWeb Architecture Team | Première version officielle |

---

# Fin du document
