# Gestion de la Facturation
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module Facturation est responsable de la création, de la gestion, du suivi et de l'annulation des documents financiers émis par l'établissement.

Il permet :

- la génération automatique des factures ;
- la création de factures manuelles ;
- la gestion des avoirs ;
- la gestion des notes de débit ;
- la gestion des remboursements ;
- la génération des reçus associés ;
- la production des écritures comptables.

---

# Principes fondamentaux

Toute facture représente une créance.

Une facture :

- possède un identifiant unique ;
- appartient à un établissement ;
- appartient à un exercice comptable ;
- appartient à un client (élève, parent ou tiers) ;
- ne peut jamais être supprimée physiquement.

---

# Documents gérés

Le moteur gère plusieurs types de documents.

## Facture

Document principal.

---

## Facture proforma

Document informatif.

Aucune écriture comptable.

---

## Avoir

Réduction ou annulation d'une facture.

---

## Note de débit

Augmentation d'une facture.

---

## Reçu

Produit lors d'un paiement.

---

## Relevé de compte

Synthèse des opérations d'un élève.

---

## Attestation de paiement

Document certifiant le règlement d'une créance.

---

# États d'une facture

Une facture peut être :

- Brouillon
- En attente de validation
- Validée
- Émise
- Partiellement payée
- Soldée
- En retard
- Suspendue
- Annulée
- Archivée

Chaque changement d'état est historisé.

---

# Numérotation

Chaque facture reçoit automatiquement un numéro.

Exemple :

FAC-2026-000001

Le format est configurable.

Variables disponibles :

AAAA

MM

JJ

Établissement

Préfixe

Compteur

Exemple :

ABJ-FAC-2026-000452

---

# Génération automatique

Le système génère automatiquement une facture lorsqu'un événement survient.

Exemples :

Nouvelle inscription

↓

Facture d'inscription

---

Réinscription

↓

Facture de réinscription

---

Création d'un échéancier

↓

Factures mensuelles

---

Vente d'un uniforme

↓

Facture de vente

---

Commande interne

↓

Facture interne

---

# Génération manuelle

Le gestionnaire peut créer une facture.

Informations :

Client

Objet

Articles

Montants

Taxes

Remises

Date

Échéance

Observations

---

# Contenu d'une facture

Une facture comprend :

Informations établissement

Logo

Coordonnées

NIF (si applicable)

Contacts

QR Code de vérification

---

Informations client

Nom

Prénom

Matricule

Classe

Cycle

Responsable financier

Adresse

Téléphone

---

Informations financières

Montant HT

Taxes

Remises

Montant TTC

Montant payé

Reste à payer

Date d'échéance

---

# Articles de facture

Chaque facture contient plusieurs lignes.

Chaque ligne comprend :

Article

Description

Quantité

Prix unitaire

Remise

Taxe

Montant

---

# Taxes

Le système est compatible avec plusieurs régimes.

Aucune taxe

TVA

Taxes locales

Taxe parafiscale

Chaque établissement configure son régime fiscal.

---

# Remises

Les remises peuvent être :

par ligne

ou

globales.

Origines :

commerciale

sociale

fidélité

exceptionnelle

bourse

---

# Échéance

Chaque facture possède :

Date d'émission

Date limite

Nombre de jours de retard

Statut

Le retard est calculé automatiquement.

---

# Pénalités

Après échéance :

Le système peut générer :

montant fixe

ou

pourcentage

ou

intérêt journalier.

Les règles sont paramétrables.

---

# Paiement

Une facture peut être :

non payée

partiellement payée

entièrement payée

surpayée (si autorisé)

Le solde est recalculé automatiquement.

---

# Avoirs

Un avoir peut être :

partiel

ou

total.

Il nécessite :

motif

validation

historisation

L'avoir génère automatiquement les écritures comptables correspondantes.

---

# Notes de débit

Une note de débit permet d'ajouter une créance supplémentaire.

Exemples :

pénalité

transport

cantine

activité exceptionnelle

---

# Annulation

Une facture ne peut jamais être supprimée.

Elle est annulée.

L'annulation :

conserve l'historique ;

crée les contre-écritures nécessaires ;

journalise l'opération.

---

# Pièces jointes

Une facture peut comporter :

contrat

bon de commande

devis

photo

PDF

courrier

---

# Signature électronique

Les factures peuvent être signées électroniquement.

La signature est :

horodatée ;

vérifiable ;

archivée.

---

# QR Code

Chaque facture possède un QR Code.

Le QR Code permet :

la vérification d'authenticité ;

l'ouverture de la facture en ligne ;

le téléchargement du PDF.

---

# Génération PDF

Chaque facture est disponible en PDF.

Le modèle est personnalisable.

Le PDF comprend :

logo

filigrane

QR Code

signature

mentions légales

---

# Envoi automatique

Après émission :

le système peut envoyer :

Email

SMS

WhatsApp (option)

Notification mobile

Les modèles sont configurables.

---

# Historique

Chaque facture conserve :

création

validation

émission

modification

paiements

avoirs

annulation

consultations importantes

---

# Recherche

Recherche par :

Nom

Matricule

Numéro facture

Classe

Cycle

Montant

Statut

Date

Exercice

Établissement

---

# Tableaux de bord

Indicateurs :

Nombre de factures

Montant facturé

Montant encaissé

Reste à encaisser

Taux de paiement

Factures en retard

Montants annulés

Montants exonérés

Montants remisés

---

# Intégration

Le moteur de facturation communique avec :

Admissions

Scolarité

Encaissements

Comptabilité

Caisse

Banques

Stocks

Ventes

Notifications

Rapports

IA

---

# Événements métier

StudentRegistered

↓

FeesCalculated

↓

InvoiceGenerated

↓

InvoiceValidated

↓

InvoiceSent

↓

PaymentReceived

↓

ReceiptGenerated

↓

AccountingEntriesCreated

↓

DashboardUpdated

↓

ParentNotified

---

# API principales

Créer une facture

Modifier une facture

Valider une facture

Annuler une facture

Créer un avoir

Créer une note de débit

Télécharger le PDF

Envoyer la facture

Rechercher une facture

Exporter les factures

---

# Sécurité

Seuls les profils autorisés peuvent :

créer

modifier

annuler

valider

exporter

Les opérations sensibles nécessitent :

journalisation ;

historisation ;

validation selon le workflow défini.

---

# Critères d'acceptation

Le sous-module sera conforme lorsque :

- toute créance génère une facture selon les règles définies ;
- la numérotation est unique et séquentielle ;
- les PDF sont conformes au modèle choisi ;
- les avoirs et notes de débit produisent les contre-écritures attendues ;
- les paiements mettent à jour automatiquement le statut des factures ;
- les tableaux de bord sont actualisés en temps réel ;
- les documents sont vérifiables grâce au QR Code et, si activée, à la signature électronique.

---

# Évolutions prévues

Le moteur devra pouvoir intégrer ultérieurement :

- la facturation électronique conforme aux réglementations nationales ;
- les échanges via API avec les administrations fiscales ;
- les paiements fractionnés intelligents pilotés par l'IA ;
- les abonnements récurrents ;
- les campagnes de relance automatisées multicanales ;
- des modèles de factures spécifiques par établissement ou réseau d'établissements.

---

# Conclusion

Le moteur de facturation constitue le pivot documentaire du module Finance. Il transforme les créances issues de la scolarité, des ventes et des services en documents financiers opposables, alimente les encaissements, la comptabilité et les outils décisionnels, tout en garantissant la traçabilité, la conformité et l'automatisation des processus financiers d'EduWeb Planner.
