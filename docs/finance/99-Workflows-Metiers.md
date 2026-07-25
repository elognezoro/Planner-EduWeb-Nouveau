# Référentiel des Workflows Métier
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Ce document décrit l'ensemble des processus métier du module Finance d'EduWeb Planner.

Il constitue la référence unique pour :

- les développeurs ;
- les analystes métier ;
- les testeurs ;
- les administrateurs fonctionnels ;
- les intégrateurs ;
- les auditeurs.

Chaque workflow décrit :

- les acteurs ;
- les déclencheurs ;
- les validations ;
- les événements métier ;
- les intégrations ;
- les règles métier ;
- les exceptions ;
- les indicateurs de performance.

---

# Cartographie globale

                    Finance
                        │
 ┌──────────────────────┼────────────────────────┐
 │                      │                        │
Scolarité          Facturation             Achats
 │                      │                        │
 │                      │                        │
Encaissements      Comptabilité         Fournisseurs
 │                      │                        │
 │                      │                        │
Caisse             Banque              Immobilisations
 │                      │                        │
 └─────────────── Budgets ───────────────┘
                        │
                   Reporting & IA

---

# Liste des workflows

WF-001
Inscription → Génération des frais → Facturation → Paiement

---

WF-002
Paiement → Reçu → Comptabilité → Tableau de bord

---

WF-003
Ouverture de caisse → Encaissements → Clôture → Versement bancaire

---

WF-004
Demande d'achat → Validation → Bon de commande → Réception → Facture → Paiement

---

WF-005
Entrée en stock → Valorisation → Comptabilité

---

WF-006
Acquisition d'immobilisation → Amortissement

---

WF-007
Import relevé bancaire → Rapprochement → Comptabilité

---

WF-008
Préparation budgétaire → Validation → Exécution → Contrôle

---

WF-009
Clôture mensuelle → Clôture annuelle → États financiers

---

WF-010
Audit → Détection IA → Rapport

---

# Modèle standard d'un workflow

Chaque workflow suit le modèle ci-dessous.

## Identification

Code

Nom

Version

Objectif

Description

---

## Acteurs

Exemple

Parent

↓

Caissier

↓

Gestionnaire

↓

Comptable

↓

Directeur

---

## Déclencheur

Exemple

Paiement reçu

---

## Préconditions

Facture validée

Utilisateur autorisé

Exercice ouvert

---

## Processus BPMN

Déclencheur

↓

Étape 1

↓

Validation

↓

Étape 2

↓

Événement métier

↓

Comptabilité

↓

Notification

↓

Archivage

---

## Événements métier

PaymentReceived

ReceiptGenerated

AccountingEntriesCreated

DashboardUpdated

AuditLogged

---

## Modules impliqués

Facturation

Encaissements

Caisse

Banque

Comptabilité

Audit

Notifications

---

## Règles métier

Liste des règles RM concernées.

---

## Cas d'erreur

Préconditions non satisfaites

Validation refusée

Doublon

Annulation

---

## KPI

Temps moyen

Montant

Nombre

Taux d'échec

---

## API utilisées

Liste des endpoints.

---

## Tests

Scénarios nominaux

Scénarios limites

Scénarios d'erreur

---

# WF-001

Inscription d'un élève

Objectif

Transformer une inscription en créance.

Processus

Élève

↓

Inscription

↓

Validation

↓

Génération automatique des frais

↓

Facturation

↓

Créance

↓

Notification parent

↓

Tableau de bord

---

# WF-002

Paiement

Parent

↓

Paiement

↓

Validation

↓

Reçu

↓

Mise à jour créance

↓

Écriture comptable

↓

Journal de caisse

↓

Notification

↓

Audit

---

# WF-003

Clôture de caisse

Ouverture

↓

Encaissements

↓

Décaissements

↓

Comptage

↓

Calcul écarts

↓

Validation

↓

Versement Banque

↓

Journal

↓

Archivage

---

# WF-004

Cycle Procure-to-Pay

Besoin

↓

Demande

↓

Validation

↓

Commande

↓

Réception

↓

Facture

↓

Paiement

↓

Comptabilité

↓

Stock

---

# WF-005

Cycle Stock

Commande

↓

Réception

↓

Entrée

↓

Valorisation

↓

Inventaire

↓

Sortie

↓

Comptabilité

---

# WF-006

Immobilisation

Réception

↓

Création actif

↓

Amortissement

↓

Réévaluation

↓

Sortie

---

# WF-007

Banque

Import relevé

↓

Analyse

↓

Matching

↓

Validation

↓

Comptabilité

↓

Archivage

---

# WF-008

Budget

Prévision

↓

Validation

↓

Exécution

↓

Contrôle

↓

Révision

↓

Clôture

---

# WF-009

Clôture comptable

Contrôle

↓

Balance

↓

Grand Livre

↓

Bilan

↓

Compte résultat

↓

Clôture

---

# WF-010

Audit

Détection IA

↓

Anomalies

↓

Analyse

↓

Validation

↓

Rapport

↓

Archivage

---

# Matrice des interactions

| Workflow | Modules |
|----------|----------|
| WF-001 | Scolarité, Facturation |
| WF-002 | Encaissements, Caisse, Comptabilité |
| WF-003 | Caisse, Banque |
| WF-004 | Achats, Fournisseurs, Comptabilité |
| WF-005 | Stocks, Comptabilité |
| WF-006 | Immobilisations, Comptabilité |
| WF-007 | Banque, Comptabilité |
| WF-008 | Budgets |
| WF-009 | Comptabilité |
| WF-010 | Audit, IA |

---

# Catalogue des événements métier

StudentRegistered

FeesGenerated

InvoiceIssued

PaymentReceived

ReceiptGenerated

CashSessionOpened

CashSessionClosed

BankDepositCompleted

PurchaseRequested

PurchaseApproved

PurchaseOrdered

GoodsReceived

SupplierInvoiceValidated

SupplierPaid

AssetCreated

DepreciationCalculated

BudgetApproved

BudgetExceeded

AccountingEntryCreated

AccountingPeriodClosed

AuditEventLogged

NotificationSent

---

# Gouvernance

Chaque workflow est :

- versionné ;
- documenté ;
- testé ;
- audité ;
- historisé.

Toute modification d'un workflow doit faire l'objet d'une validation fonctionnelle avant sa mise en production.

---

# Conclusion

Le présent référentiel constitue la vue d'ensemble des processus financiers d'EduWeb Planner. Il garantit une compréhension commune des enchaînements métier, facilite le développement, la maintenance, les tests et les audits, tout en assurant une parfaite cohérence entre les différents sous-modules du système.
