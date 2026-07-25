# Catalogue des Événements
## Architecture Event-Driven – EduWeb Planner

Version : 1.0

---

# Objectif

Le présent document définit les événements utilisés dans l'ensemble de la plateforme EduWeb Planner.

Les événements permettent :

- la communication entre modules ;
- l'automatisation des traitements ;
- la synchronisation des microservices ;
- la traçabilité métier ;
- l'audit ;
- les notifications ;
- l'alimentation des tableaux de bord ;
- les traitements IA.

---

# Vision

Toute opération importante réalisée dans EduWeb Planner produit un événement métier.

Les événements représentent des faits déjà réalisés.

Ils sont :

- immuables ;
- horodatés ;
- identifiés ;
- historisés.

---

# Architecture

Utilisateur

↓

Commande (Command)

↓

Service Métier

↓

Transaction

↓

Domain Event

↓

Bus d'événements

↓

Modules abonnés

↓

Notifications

↓

Audit

↓

IA

---

# Types d'événements

Le système distingue :

## Domain Events

Événements métier.

---

## Integration Events

Communication entre services.

---

## Notification Events

Déclenchement des notifications.

---

## Audit Events

Traçabilité.

---

## System Events

Événements techniques.

---

# Convention de nommage

Tous les événements utilisent le passé.

Exemples :

StudentRegistered

StudentUpdated

InvoiceIssued

InvoiceCancelled

PaymentReceived

BudgetValidated

AssetCreated

AssetDisposed

SupplierApproved

PurchaseOrderCreated

StockAdjusted

NotificationSent

UserLoggedIn

PasswordChanged

---

# Structure d'un événement

Chaque événement contient :

eventId

eventType

aggregateId

aggregateType

tenantId

occurredAt

version

source

actor

payload

metadata

correlationId

causationId

---

# Exemple

eventType

InvoiceIssued

aggregateType

Invoice

aggregateId

UUID

payload

Montant

Devise

Client

Date

Échéance

---

# Domain Events

## Scolarité

StudentRegistered

StudentUpdated

StudentTransferred

StudentGraduated

StudentArchived

---

## Facturation

InvoiceCreated

InvoiceIssued

InvoiceCancelled

InvoicePaid

InvoiceOverdue

CreditNoteIssued

---

## Encaissements

PaymentReceived

PaymentRejected

PaymentRefunded

ReceiptGenerated

---

## Comptabilité

JournalClosed

AccountingEntryCreated

AccountingEntryUpdated

AccountingPeriodClosed

BalanceValidated

---

## Budgets

BudgetCreated

BudgetApproved

BudgetRevised

BudgetExceeded

BudgetClosed

---

## Achats

PurchaseRequestCreated

PurchaseRequestApproved

PurchaseOrderCreated

GoodsReceived

PurchaseCancelled

---

## Fournisseurs

SupplierCreated

SupplierApproved

SupplierSuspended

SupplierEvaluated

SupplierArchived

---

## Stocks

StockReceived

StockTransferred

StockAdjusted

InventoryCompleted

StockBelowMinimum

---

## Immobilisations

AssetCreated

AssetActivated

AssetTransferred

AssetDepreciated

AssetDisposed

MaintenanceScheduled

MaintenanceCompleted

---

## Ressources Humaines

EmployeeCreated

LeaveApproved

PayrollGenerated

TrainingCompleted

---

## Gouvernance

DecisionPublished

RegulationUpdated

DocumentSigned

WorkflowCompleted

---

# Integration Events

Exemples

InvoiceIssued

↓

Comptabilité

↓

Notification

↓

Tableaux de bord

↓

IA

---

BudgetApproved

↓

Achats

↓

Comptabilité

↓

Rapports

---

StockBelowMinimum

↓

Achats

↓

Notifications

↓

IA

---

# Notification Events

NotificationRequested

NotificationSent

NotificationRead

NotificationFailed

NotificationArchived

---

# Audit Events

LoginSucceeded

LoginFailed

PermissionChanged

RoleAssigned

SensitiveDataViewed

ExportGenerated

APIKeyCreated

---

# System Events

BackupCompleted

BackupFailed

CacheCleared

QueueOverflow

WorkerRestarted

DatabaseMigrated

HealthCheckFailed

---

# CloudEvents

Les événements suivent le standard CloudEvents.

Attributs :

id

source

specversion

type

subject

time

datacontenttype

data

---

# Bus d'événements

Le moteur supporte :

RabbitMQ

Kafka

Redis Streams

Azure Service Bus

AWS SNS/SQS

Google Pub/Sub

Le choix dépend du déploiement.

---

# Outbox Pattern

Les événements sont publiés uniquement après validation de la transaction métier.

Flux :

Transaction

↓

Outbox

↓

Publication

↓

Confirmation

---

# Retry

En cas d'échec :

Tentative 1

↓

Tentative 2

↓

Tentative 3

↓

Dead Letter Queue

Les paramètres sont configurables.

---

# Dead Letter Queue

Les événements non distribués sont :

journalisés ;

isolés ;

réessayés après correction.

---

# Idempotence

Chaque événement possède :

eventId unique

↓

traitement unique

↓

aucun doublon

---

# Versionnement

Chaque évolution incompatible crée une nouvelle version.

Exemple

InvoiceIssued v2

---

# Sécurité

Les événements respectent :

RBAC

Multi-Tenant

Chiffrement

Signature numérique (optionnelle)

Journalisation

---

# Historique

Le système conserve :

date ;

émetteur ;

consommateurs ;

temps de traitement ;

résultat.

---

# Monitoring

Le système mesure :

nombre d'événements ;

latence ;

temps de traitement ;

échecs ;

DLQ ;

reprises.

---

# API principales

Publier un événement

Consommer un événement

Relancer un traitement

Consulter le catalogue

Rejouer un événement

Archiver

---

# Règles métier

## RM-2100

Tout événement possède un identifiant unique.

---

## RM-2101

Les événements sont immuables.

---

## RM-2102

Les événements sont publiés uniquement après validation de la transaction.

---

## RM-2103

Les consommateurs doivent être idempotents.

---

## RM-2104

Les événements sont historisés.

---

## RM-2105

Les événements sensibles respectent les politiques de confidentialité.

---

# Tests

Le système devra vérifier :

✓ publication ;

✓ consommation ;

✓ retry ;

✓ DLQ ;

✓ idempotence ;

✓ versionnement ;

✓ performances.

---

# KPI

Nombre d'événements

Temps moyen de traitement

Latence

Retry

DLQ

Échecs

Débit

Consommateurs actifs

Disponibilité

---

# Intelligence artificielle

Le moteur IA exploite les événements pour :

- détecter des anomalies en temps réel ;
- anticiper les risques ;
- construire des modèles prédictifs ;
- recommander des actions ;
- enrichir les tableaux de bord ;
- générer automatiquement des synthèses d'activité.

---

# Évolutions prévues

Le module devra intégrer :

- Event Sourcing pour certains domaines métier ;
- Saga Pattern pour les transactions distribuées ;
- CQRS avancé ;
- Event Replay ;
- Streaming Analytics ;
- traitement temps réel des indicateurs.

---

# Conclusion

Le catalogue des événements constitue le système nerveux d'EduWeb Planner. Grâce à une architecture orientée événements, les modules communiquent de manière découplée, fiable et évolutive. Cette approche favorise la résilience, l'automatisation, l'audit et l'intégration native de l'intelligence artificielle dans l'ensemble de la plateforme.
