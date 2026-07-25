# Gestion des Encaissements
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Encaissements** permet de gérer tous les paiements reçus par l'établissement.

Il couvre :

- les paiements des élèves ;
- les paiements des parents ;
- les ventes diverses ;
- les paiements en ligne ;
- les paiements Mobile Money ;
- les paiements bancaires ;
- les avances ;
- les remboursements ;
- les annulations ;
- les écritures comptables automatiques.

---

# Principes fondamentaux

Tout encaissement doit :

- être unique ;
- être traçable ;
- être horodaté ;
- être rattaché à une caisse ou un compte bancaire ;
- être relié à un utilisateur identifié.

Un paiement ne peut jamais exister sans origine.

---

# Sources d'encaissement

Le système doit accepter des paiements provenant de :

- Élève
- Parent
- Fournisseur (remboursement)
- Partenaire
- Personnel
- Client externe

---

# Types de paiements

Le moteur doit gérer :

## Paiement de scolarité

- inscription
- réinscription
- mensualité
- trimestre
- semestre

---

## Paiement de services

- cantine
- transport
- internat
- garderie

---

## Vente

- uniforme
- livre
- cahier
- fournitures
- badge
- carte scolaire

---

## Paiement exceptionnel

- pénalité
- régularisation
- contribution exceptionnelle
- activité culturelle

---

# Moyens de paiement

Le système doit accepter :

## Espèces

---

## Chèque

Informations :

- banque
- numéro
- titulaire
- date

---

## Virement bancaire

Informations :

- banque
- référence
- date

---

## Carte bancaire

Visa

Mastercard

GIM-UEMOA

Autres

---

## Mobile Money

Orange Money

MTN Mobile Money

Moov Money

Wave

Autres fournisseurs paramétrables

---

## Paiement en ligne

Passerelles compatibles :

- Stripe
- PayPal
- CinetPay
- PayDunya
- Fedapay
- Flutterwave
- autres via API

---

# Paiement multi-mode

Une même facture peut être réglée par plusieurs moyens.

Exemple :

100 000 FCFA

↓

40 000 FCFA espèces

↓

60 000 FCFA Wave

---

# Paiement multi-factures

Un seul paiement peut solder plusieurs factures.

Exemple :

500 000 FCFA

↓

Facture A

↓

Facture B

↓

Facture C

L'ordre d'imputation est paramétrable.

---

# Paiement partiel

Une facture peut être payée en plusieurs fois.

Le système met automatiquement à jour :

- le montant payé ;
- le solde restant ;
- le statut.

---

# Avances

Le système autorise les avances.

L'avance est enregistrée sur le compte financier.

Elle sera automatiquement imputée selon les règles définies.

---

# Trop-perçu

Si le montant payé dépasse la créance :

Le système peut :

- créer un avoir ;
- créer un crédit ;
- rembourser immédiatement ;
- conserver le solde pour une prochaine facture.

Le comportement est paramétrable.

---

# Réception du paiement

Chaque paiement génère immédiatement :

- un reçu ;
- une écriture comptable ;
- une mise à jour du compte élève ;
- une mise à jour de la caisse ;
- une mise à jour du tableau de bord ;
- une notification.

---

# Reçu

Le reçu comprend :

Numéro

QR Code

Date

Heure

Caissier

Montant

Mode de paiement

Références

Signature

Cachet numérique

---

# QR Code

Le QR Code permet :

- vérifier l'authenticité ;
- retrouver le paiement ;
- télécharger le reçu.

---

# Annulation

L'annulation d'un paiement est exceptionnelle.

Elle nécessite :

- un motif ;
- une autorisation ;
- une validation.

L'annulation génère automatiquement :

- une contre-écriture comptable ;
- un journal d'audit ;
- une notification.

---

# Remboursement

Le remboursement suit un workflow.

Demande

↓

Validation

↓

Paiement

↓

Écriture comptable

↓

Historisation

---

# Contrôles

Le système refuse :

- un paiement négatif ;
- un paiement sans facture (sauf avance autorisée) ;
- un paiement sur un exercice clôturé ;
- un paiement sur une caisse fermée.

---

# Clôture journalière

Chaque caissier clôture sa session.

Le système calcule automatiquement :

- total encaissé ;
- total par moyen de paiement ;
- écarts ;
- solde théorique ;
- solde réel.

---

# Écart de caisse

En cas d'écart :

Le système enregistre :

- montant ;
- motif ;
- responsable ;
- validation.

Les écarts alimentent les rapports d'audit.

---

# Rapprochement bancaire

Les paiements bancaires sont rapprochés automatiquement.

Statuts :

- rapproché ;
- non rapproché ;
- anomalie.

---

# Historique

Chaque paiement conserve :

- création ;
- validation ;
- modification ;
- annulation ;
- remboursement ;
- consultation.

---

# Notifications

Après paiement :

Parent

↓

SMS

↓

Email

↓

Notification mobile

Les modèles sont personnalisables.

---

# Tableaux de bord

Le Directeur visualise :

- recettes du jour ;
- recettes mensuelles ;
- recettes annuelles ;
- paiements par classe ;
- paiements par niveau ;
- paiements par mode ;
- paiements par caissier ;
- paiements en attente de validation.

---

# Indicateurs (KPI)

Le système calcule notamment :

- montant encaissé aujourd'hui ;
- montant encaissé ce mois ;
- taux de recouvrement ;
- délai moyen de paiement ;
- part des paiements Mobile Money ;
- part des paiements bancaires ;
- montant des avances ;
- montant des remboursements ;
- écarts de caisse.

---

# Intégrations

Le moteur communique avec :

- Scolarité ;
- Facturation ;
- Comptabilité ;
- Caisse ;
- Banque ;
- Rapports ;
- Audit ;
- Notifications ;
- IA.

Toutes les interactions reposent sur des événements métier.

---

# Événements métier

PaymentReceived

↓

ReceiptGenerated

↓

StudentAccountUpdated

↓

CashRegisterUpdated

↓

AccountingEntriesCreated

↓

DashboardUpdated

↓

ParentNotified

↓

AuditLogged

---

# API principales

- Enregistrer un paiement
- Ventiler un paiement
- Enregistrer une avance
- Générer un reçu
- Annuler un paiement
- Rembourser un paiement
- Consulter un paiement
- Exporter les encaissements
- Rechercher un paiement
- Clôturer une session de caisse

---

# Sécurité

Le système impose :

- authentification forte pour les profils sensibles ;
- contrôle des droits par rôle ;
- verrouillage des exercices clôturés ;
- journalisation complète des opérations ;
- validation obligatoire des annulations et remboursements.

---

# Critères d'acceptation

Le sous-module est conforme lorsque :

- tout paiement met à jour automatiquement les créances concernées ;
- les reçus sont générés instantanément avec QR Code ;
- les écritures comptables sont créées sans intervention manuelle ;
- les paiements multi-factures et multi-modes sont correctement ventilés ;
- les clôtures de caisse détectent automatiquement les écarts ;
- les rapprochements bancaires sont possibles ;
- les tableaux de bord sont mis à jour en temps réel.

---

# Évolutions prévues

Le moteur devra intégrer à terme :

- les QR Codes de paiement dynamique ;
- les liens de paiement sécurisés ;
- les prélèvements automatiques ;
- les abonnements récurrents ;
- la lecture de terminaux de paiement (TPE) ;
- les API bancaires (Open Banking) ;
- la détection de fraude par intelligence artificielle.

---

# Conclusion

Le sous-module **Encaissements** constitue le point d'entrée de la trésorerie dans EduWeb Planner. Il garantit que chaque paiement, quel que soit son canal, soit immédiatement sécurisé, tracé, ventilé, comptabilisé et intégré aux tableaux de bord. Son architecture doit permettre de traiter des milliers de transactions quotidiennes tout en maintenant un haut niveau de performance, de sécurité et de conformité.
