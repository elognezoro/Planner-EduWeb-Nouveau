# Cartographie EventStorming
## Architecture DDD / CQRS / Event-Driven
### EduWeb Planner

Version : 1.0

---

# Objectif

Le présent document décrit la cartographie fonctionnelle complète d'EduWeb Planner selon la méthode **EventStorming**.

Il permet de :

- identifier les domaines métier ;
- définir les Bounded Contexts ;
- cartographier les flux métier ;
- identifier les Commands ;
- identifier les Domain Events ;
- définir les Aggregates ;
- définir les Policies ;
- construire les Read Models ;
- préparer l'architecture microservices.

---

# Vision globale

```
                    EduWeb Planner

        ┌──────────────────────────────┐
        │      Gouvernance             │
        └──────────────────────────────┘
                    │
        ┌──────────────────────────────┐
        │      Scolarité               │
        └──────────────────────────────┘
                    │
        ┌──────────────────────────────┐
        │      Pédagogie               │
        └──────────────────────────────┘
                    │
        ┌──────────────────────────────┐
        │      Finance                 │
        └──────────────────────────────┘
                    │
        ┌──────────────────────────────┐
        │      Comptabilité            │
        └──────────────────────────────┘
                    │
        ┌──────────────────────────────┐
        │      RH                      │
        └──────────────────────────────┘
                    │
        ┌──────────────────────────────┐
        │      Patrimoine              │
        └──────────────────────────────┘
                    │
        ┌──────────────────────────────┐
        │      IA                      │
        └──────────────────────────────┘
```

---

# Bounded Contexts

Le système est découpé en contextes métiers autonomes.

## BC-01 Gouvernance

Responsabilités :

- décisions ;
- règlements ;
- workflow ;
- signatures ;
- organisation.

---

## BC-02 Scolarité

Responsabilités :

- élèves ;
- inscriptions ;
- classes ;
- affectations ;
- présences.

---

## BC-03 Pédagogie

Responsabilités :

- emplois du temps ;
- enseignements ;
- évaluations ;
- progression ;
- compétences.

---

## BC-04 Finance

Responsabilités :

- facturation ;
- paiements ;
- trésorerie ;
- budgets.

---

## BC-05 Comptabilité

Responsabilités :

- écritures ;
- journaux ;
- clôtures ;
- états financiers.

---

## BC-06 Ressources Humaines

Responsabilités :

- personnel ;
- carrières ;
- congés ;
- formations.

---

## BC-07 Patrimoine

Responsabilités :

- immobilisations ;
- maintenance ;
- inventaires.

---

## BC-08 Achats

Responsabilités :

- demandes ;
- commandes ;
- fournisseurs ;
- contrats.

---

## BC-09 Stocks

Responsabilités :

- mouvements ;
- inventaires ;
- approvisionnements.

---

## BC-10 Intelligence Artificielle

Responsabilités :

- copilote ;
- prédictions ;
- recommandations ;
- génération documentaire.

---

# Acteurs

Les principaux acteurs sont :

- Super Administrateur
- Administrateur National
- DRENA
- Chef d'établissement
- Gestionnaire
- Comptable
- Économe
- Responsable RH
- Responsable pédagogique
- Enseignant
- Élève
- Parent
- Auditeur
- IA
- API externe

---

# Commands

## Scolarité

RegisterStudent

TransferStudent

ArchiveStudent

AssignClass

RecordAttendance

---

## Finance

CreateInvoice

IssueInvoice

RegisterPayment

RefundPayment

ApproveBudget

CloseBudget

---

## Comptabilité

CreateJournalEntry

ValidateJournal

CloseAccountingPeriod

GenerateBalance

---

## RH

CreateEmployee

ApproveLeave

GeneratePayroll

AssignTraining

---

## Achats

CreatePurchaseRequest

ApprovePurchaseRequest

CreatePurchaseOrder

ReceiveGoods

---

## Patrimoine

CreateAsset

ScheduleMaintenance

DisposeAsset

---

# Aggregates

Les principaux agrégats sont :

Student

Enrollment

Class

Teacher

Course

Invoice

Payment

Budget

AccountingEntry

Supplier

PurchaseOrder

Asset

Employee

Notification

Document

Decision

---

# Domain Events

Exemples :

StudentRegistered

EnrollmentValidated

AttendanceRecorded

InvoiceIssued

InvoicePaid

BudgetApproved

PurchaseOrderCreated

GoodsReceived

AssetCreated

MaintenanceCompleted

DecisionPublished

NotificationSent

AIRecommendationGenerated

---

# Policies

Les policies réagissent aux événements.

Exemple :

```
InvoiceIssued

↓

Créer l'écriture comptable

↓

Notifier le parent

↓

Mettre à jour le tableau de bord

↓

Analyser le risque IA
```

---

Autre exemple :

```
StockBelowMinimum

↓

Créer une demande d'achat

↓

Notifier l'économe

↓

Prévoir la date de rupture (IA)
```

---

# Read Models

Le système produit des vues spécialisées :

- Tableau de bord DG
- Tableau de bord DRENA
- Tableau de bord établissement
- Tableau de bord financier
- Tableau de bord RH
- Tableau de bord pédagogique
- Tableau de bord IA

---

# Saga

Certaines opérations utilisent des Sagas.

Exemple :

Inscription d'un élève

↓

Créer le dossier

↓

Affecter la classe

↓

Créer les frais

↓

Créer les accès numériques

↓

Notifier les responsables

↓

Terminer

En cas d'échec :

↓

Compensation automatique

---

# Intégration IA

Les événements alimentent :

- prédictions ;
- détection d'anomalies ;
- recommandations ;
- génération automatique de rapports ;
- indicateurs prédictifs.

---

# Event Catalog

Chaque événement possède :

- UUID
- Version
- Horodatage
- Aggregate
- Payload
- CorrelationId
- CausationId
- Tenant
- Auteur

---

# CQRS

Les écritures utilisent :

Commands

↓

Domain

↓

Events

Les lectures utilisent :

Read Models

↓

API

↓

Interface utilisateur

---

# Diagramme simplifié

```
Commande

↓

Aggregate

↓

Domain Event

↓

Event Bus

↓

Policies

↓

Read Models

↓

Notifications

↓

IA

↓

Tableaux de bord
```

---

# Frontières de contexte

Les échanges entre Bounded Contexts se font exclusivement :

- par événements ;
- par API publiques documentées ;
- par contrats versionnés.

Aucun contexte ne lit directement la base de données d'un autre contexte.

---

# Règles métier

## RM-2700

Toute modification importante génère un Domain Event.

---

## RM-2701

Les Commands ne retournent jamais directement les Read Models.

---

## RM-2702

Les événements sont immuables.

---

## RM-2703

Chaque Aggregate protège ses invariants métier.

---

## RM-2704

Les Policies ne modifient jamais directement un Aggregate externe.

---

## RM-2705

Les Bounded Contexts communiquent uniquement par contrats explicites.

---

# Tests

Le système devra vérifier :

✓ invariants des Aggregates ;

✓ publication des événements ;

✓ exécution des Policies ;

✓ cohérence des Read Models ;

✓ compensation des Sagas ;

✓ intégrité des flux inter-contextes.

---

# KPI

- Nombre de Commands
- Nombre de Domain Events
- Nombre de Policies
- Temps moyen de propagation d'un événement
- Nombre de Sagas exécutées
- Nombre d'échecs compensés
- Latence des Read Models

---

# Évolutions prévues

Le dispositif pourra intégrer :

- Event Sourcing sur les domaines critiques ;
- Process Managers avancés ;
- orchestration BPMN ;
- simulation de processus métier ;
- optimisation automatique des workflows par IA.

---

# Conclusion

La cartographie EventStorming fournit une représentation commune des processus métier d'EduWeb Planner. Elle sert de fondation à l'architecture DDD, CQRS et Event-Driven, facilite la collaboration entre les équipes et réduit les ambiguïtés lors de la conception et du développement.
