# Gestion Bancaire
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Banque** permet de gérer l'ensemble des comptes bancaires et des opérations financières réalisées par l'établissement auprès des banques et des établissements de monnaie électronique.

Il couvre :

- les comptes bancaires ;
- les comptes Mobile Money institutionnels ;
- les dépôts ;
- les retraits ;
- les virements ;
- les prélèvements ;
- les chèques ;
- les relevés bancaires ;
- les rapprochements bancaires ;
- les frais bancaires ;
- les intérêts ;
- les écritures comptables automatiques.

---

# Principes fondamentaux

Chaque opération bancaire :

- est traçable ;
- est horodatée ;
- est comptabilisée automatiquement ;
- appartient à un exercice comptable ;
- appartient à un établissement.

Aucune opération bancaire ne peut exister sans pièce justificative.

---

# Types de comptes

Le système permet de gérer :

## Comptes courants

Exemple

Banque SGCI

Banque BNI

Banque NSIA

Ecobank

UBA

BOA

---

## Comptes d'épargne

Destinés :

- aux réserves ;
- aux investissements ;
- aux projets.

---

## Comptes Mobile Money

Orange Money Business

MTN Mobile Money Business

Moov Money Business

Wave Business

Autres EME paramétrables.

---

## Comptes virtuels

Pour les passerelles de paiement.

---

# Paramétrage d'un compte

Chaque compte possède :

UUID

Nom

Code interne

Établissement

Banque

Agence

Numéro de compte

IBAN (optionnel)

SWIFT/BIC

Devise

Responsable

Date d'ouverture

Date de clôture

Statut

---

# États d'un compte

- Actif
- Suspendu
- Fermé
- Archivé

---

# Opérations bancaires

Le système prend en charge :

## Dépôt

Espèces

Chèque

Virement entrant

---

## Retrait

Espèces

Chèque

Carte

---

## Virement

Interne

Externe

Permanent

Ponctuel

---

## Prélèvement

Automatique

Manuel

---

## Paiement fournisseur

Par virement

---

## Paiement salarié

Par virement

---

## Remboursement

Vers un parent

Vers un fournisseur

---

## Frais bancaires

Commission

Agios

Frais de tenue de compte

Taxes

---

## Produits financiers

Intérêts créditeurs

Revenus financiers

---

# Dépôts provenant des caisses

Workflow

Clôture caisse

↓

Versement

↓

Compte bancaire

↓

Confirmation

↓

Rapprochement

↓

Comptabilité

---

# Chèques

Le système gère :

Chèques émis

Chèques reçus

Chèques en circulation

Chèques rejetés

Chèques annulés

Chaque chèque possède :

Numéro

Banque

Montant

Date

Émetteur

Bénéficiaire

Statut

---

# Rapprochement bancaire

Le rapprochement compare :

Relevé bancaire

↓

Écritures bancaires

↓

Écritures comptables

↓

Paiements

Le système identifie automatiquement :

- opérations rapprochées ;
- opérations en attente ;
- écarts ;
- doublons.

---

# Règles métier

## RM-600

Tout dépôt bancaire provient obligatoirement d'une caisse ou d'une autre banque.

---

## RM-601

Un compte fermé ne peut plus recevoir d'opérations.

---

## RM-602

Chaque opération bancaire génère une écriture comptable.

---

## RM-603

Les rapprochements sont historisés.

---

## RM-604

Les frais bancaires sont automatiquement imputés aux comptes de charges appropriés.

---

## RM-605

Les intérêts créditeurs sont automatiquement comptabilisés.

---

# Virements internes

Le système autorise :

Banque A

↓

Banque B

Une seule action produit :

- un débit ;
- un crédit ;
- deux écritures comptables liées.

---

# Multi-devises

Chaque compte fonctionne dans une devise.

Le système gère :

- les taux de change ;
- les écarts de conversion ;
- les gains de change ;
- les pertes de change.

---

# Import des relevés

Formats compatibles :

CSV

Excel

OFX

CAMT.053

MT940

Autres formats extensibles.

---

# Export

Le système exporte :

Excel

CSV

PDF

XML

Formats comptables selon les besoins nationaux.

---

# Sécurité

Les opérations sensibles nécessitent :

- authentification forte (MFA) ;
- validation hiérarchique ;
- journalisation complète.

---

# Tableau de bord

Le Directeur visualise :

- solde par banque ;
- solde global ;
- dépôts en attente ;
- virements du jour ;
- frais bancaires ;
- rapprochements réalisés ;
- anomalies détectées.

---

# Alertes

Le système alerte en cas de :

- solde faible ;
- compte inactif ;
- rejet de chèque ;
- rejet de virement ;
- rapprochement non effectué ;
- dépassement de plafond.

---

# Intégrations

Le module Banque communique avec :

- Caisse
- Encaissements
- Comptabilité
- Fournisseurs
- Dépenses
- Budgets
- Rapports
- Audit
- IA

Toutes les communications utilisent des événements métier.

---

# BPMN simplifié

Réception d'un relevé bancaire

↓

Import

↓

Analyse

↓

Rapprochement automatique

↓

Validation

↓

Création des écritures manquantes (si nécessaire)

↓

Archivage

---

# API principales

- Créer un compte bancaire
- Modifier un compte bancaire
- Enregistrer un dépôt
- Enregistrer un retrait
- Effectuer un virement
- Importer un relevé
- Lancer un rapprochement
- Consulter les soldes
- Exporter les opérations
- Générer un rapport bancaire

---

# Cas d'erreur

## Compte inexistant

HTTP 404

---

## Compte fermé

HTTP 409

---

## Solde insuffisant

HTTP 422

---

## Relevé déjà importé

HTTP 409

---

## Devise incompatible

HTTP 422

---

# Tests fonctionnels

Le système devra vérifier :

✓ création d'un compte bancaire ;

✓ dépôt provenant d'une caisse ;

✓ virement entre deux comptes ;

✓ calcul exact des soldes ;

✓ rapprochement automatique ;

✓ comptabilisation automatique des frais bancaires ;

✓ gestion correcte des comptes multidevises.

---

# Indicateurs (KPI)

- Solde par banque
- Solde consolidé
- Montant des dépôts
- Montant des retraits
- Montant des virements
- Taux de rapprochement
- Frais bancaires cumulés
- Délais moyens de rapprochement
- Nombre d'anomalies détectées

---

# Évolutions futures

Le module devra intégrer :

- Open Banking (API bancaires) ;
- consultation des soldes en temps réel ;
- import automatique des relevés ;
- paiements instantanés ;
- validation biométrique des virements sensibles ;
- rapprochement assisté par intelligence artificielle ;
- intégration avec les plateformes Mobile Money Business.

---

# Conclusion

Le sous-module **Banque** assure une gestion centralisée, sécurisée et conforme des opérations bancaires de l'établissement. Il garantit la cohérence entre les mouvements bancaires, les opérations de caisse et la comptabilité générale, tout en offrant des outils avancés de rapprochement, de contrôle et d'aide à la décision.
