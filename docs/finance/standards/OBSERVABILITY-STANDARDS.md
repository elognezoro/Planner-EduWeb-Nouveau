---
title: EduWeb Observability Standards
version: 1.0
status: Official
category: Engineering Standards
code: STD-021
authors:
  - EduWeb Architecture Team
---

# OBSERVABILITY-STANDARDS.md

> Référentiel officiel d'observabilité de l'écosystème EduWeb.

---

# Sommaire

1. Objectifs
2. Principes
3. Les trois piliers de l'observabilité
4. Architecture d'observabilité
5. Métriques techniques
6. Métriques métier
7. Traces distribuées
8. Corrélation des événements
9. Dashboards
10. Alerting
11. SLI / SLO / SLA
12. Supervision des traitements planifiés
13. Monitoring des bases de données
14. Monitoring des API
15. Monitoring Frontend
16. Gestion des incidents
17. Anti-patterns
18. Checklist

---

# 1. Objectifs

L'observabilité permet de comprendre à tout moment :

- l'état de la plateforme ;
- les performances ;
- les anomalies ;
- les comportements utilisateurs ;
- les processus métier.

Elle constitue un outil essentiel pour garantir la disponibilité et la qualité de service d'EduWeb.

---

# 2. Principes

Toute fonctionnalité développée doit être observable.

Chaque composant doit produire :

- des métriques ;
- des journaux ;
- des traces.

Les informations collectées doivent permettre de répondre rapidement aux questions :

- Que s'est-il passé ?
- Où ?
- Quand ?
- Pourquoi ?
- Avec quel impact ?

---

# 3. Les trois piliers de l'observabilité

## 3.1 Logs

Les logs décrivent les événements.

Exemples :

- connexion utilisateur ;
- erreur API ;
- génération d'un emploi du temps.

---

## 3.2 Metrics

Les métriques mesurent.

Exemples :

- CPU ;
- mémoire ;
- nombre d'utilisateurs connectés ;
- temps moyen de réponse.

---

## 3.3 Traces

Les traces permettent de suivre une requête complète.

Exemple :

```
Navigateur

↓

Next.js

↓

Server Action

↓

Service

↓

Repository

↓

Prisma

↓

Neon PostgreSQL
```

Chaque étape est mesurée.

---

# 4. Architecture d'observabilité

Architecture cible :

```
Application

↓

Logs

↓

Metrics

↓

Traces

↓

Collecteurs

↓

Dashboards

↓

Alertes
```

L'observabilité est indépendante de la logique métier.

---

# 5. Métriques techniques

Surveiller notamment :

## Serveur

- CPU
- RAM
- disque
- réseau

## Base de données

- connexions ;
- requêtes lentes ;
- index utilisés ;
- temps de réponse.

## API

- latence ;
- erreurs ;
- débit.

## Frontend

- Core Web Vitals ;
- temps de chargement ;
- erreurs JavaScript.

---

# 6. Métriques métier

EduWeb doit également suivre des indicateurs fonctionnels.

Exemples :

### Gestion scolaire

- nombre d'établissements actifs ;
- nombre d'élèves ;
- nombre d'enseignants ;
- nombre de parents.

### EduWeb Planner

- emplois du temps générés ;
- emplois du temps publiés ;
- conflits détectés ;
- conflits résolus.

### Évaluations

- notes saisies ;
- bulletins publiés ;
- conseils de classe réalisés.

### Gouvernance

- décisions produites ;
- documents validés ;
- actes administratifs publiés.

### Booking

- réservations ;
- taux d'occupation des ressources.

Ces métriques permettent de suivre l'utilisation réelle de la plateforme.

---

# 7. Traces distribuées

Chaque requête possède un identifiant unique.

Exemple :

```
Request ID

↓

Trace ID

↓

Span ID
```

Toutes les opérations liées à une requête sont corrélées.

---

# 8. Corrélation des événements

Chaque événement critique contient :

- identifiant utilisateur ;
- établissement ;
- année académique ;
- module ;
- horodatage ;
- Request ID.

Cette corrélation facilite les investigations.

---

# 9. Dashboards

Des tableaux de bord sont disponibles pour :

## Exploitation

- disponibilité ;
- charge ;
- incidents.

## Développement

- erreurs ;
- performances ;
- requêtes SQL.

## Direction

- indicateurs métier ;
- statistiques nationales ;
- activité des établissements.

Chaque profil visualise uniquement les informations autorisées.

---

# 10. Alerting

Des alertes sont configurées pour :

- indisponibilité ;
- erreurs répétées ;
- dépassement des SLO ;
- saturation mémoire ;
- saturation CPU ;
- échec des sauvegardes ;
- échec des traitements planifiés.

Les alertes sont priorisées selon leur criticité.

---

# 11. SLI / SLO / SLA

## SLI

Exemples :

- disponibilité ;
- temps de réponse ;
- taux d'erreur.

---

## SLO

Exemple :

```
Disponibilité

99,9 %
```

---

## SLA

Les SLA définissent les engagements contractuels vis-à-vis des établissements et partenaires.

---

# 12. Supervision des traitements planifiés

Surveiller :

- sauvegardes ;
- exports ;
- imports ;
- synchronisations ;
- notifications ;
- génération automatique des emplois du temps ;
- archivages.

Chaque tâche planifiée possède :

- un statut ;
- une durée ;
- un historique ;
- un journal.

---

# 13. Monitoring des bases de données

Mesurer notamment :

- temps moyen des requêtes ;
- verrouillages ;
- index inutilisés ;
- croissance des tables ;
- fragmentation éventuelle.

Les requêtes lentes sont analysées régulièrement.

---

# 14. Monitoring des API

Suivre :

- nombre d'appels ;
- taux de succès ;
- erreurs 4xx ;
- erreurs 5xx ;
- latence ;
- consommation des ressources.

Les endpoints critiques disposent d'un suivi renforcé.

---

# 15. Monitoring Frontend

Surveiller :

- Largest Contentful Paint (LCP) ;
- Interaction to Next Paint (INP) ;
- Cumulative Layout Shift (CLS) ;
- erreurs JavaScript ;
- taux d'abandon ;
- temps de rendu.

L'expérience utilisateur est un indicateur majeur de qualité.

---

# 16. Gestion des incidents

En cas d'incident :

1. Détection.
2. Qualification.
3. Analyse des logs.
4. Analyse des métriques.
5. Analyse des traces.
6. Correction.
7. Vérification.
8. Retour d'expérience.

Chaque incident important donne lieu à un rapport.

---

# 17. Anti-patterns

Interdits :

❌ Logs sans contexte.

❌ Métriques jamais consultées.

❌ Alertes excessives (Alert Fatigue).

❌ Dashboards surchargés.

❌ Traces incomplètes.

❌ Surveillance limitée aux seuls serveurs.

❌ Aucune supervision des indicateurs métier.

❌ Suppression prématurée des données d'observabilité.

---

# 18. Checklist

Avant chaque mise en production :

- [ ] Les métriques sont publiées.
- [ ] Les logs sont correctement structurés.
- [ ] Les traces distribuées sont activées.
- [ ] Les dashboards sont disponibles.
- [ ] Les alertes sont configurées.
- [ ] Les SLO sont définis.
- [ ] Les traitements planifiés sont supervisés.
- [ ] Les métriques métier sont suivies.
- [ ] Les tableaux de bord sont documentés.
- [ ] Les procédures d'incident sont validées.

---

# Documents associés

- PERFORMANCE-STANDARDS.md
- LOGGING-STANDARDS.md
- ERROR-HANDLING-STANDARDS.md
- BACKEND-STANDARDS.md
- API-STANDARDS.md
- SECURITY-STANDARDS.md
- DEPLOYMENT-STANDARDS.md

---

# Fin du document
