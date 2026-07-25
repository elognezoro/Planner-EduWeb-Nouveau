# Gestion des Frais de Scolarité
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Scolarité** permet de gérer l'ensemble des créances d'un établissement scolaire envers ses apprenants.

Il couvre :

- la définition des frais ;
- la génération automatique des créances ;
- les remises ;
- les exonérations ;
- les bourses ;
- les échéanciers ;
- les pénalités ;
- les paiements ;
- les remboursements ;
- le suivi des soldes.

---

# Principes généraux

La gestion de la scolarité repose sur quatre principes :

- une créance est créée une seule fois ;
- tous les paiements sont rattachés à une créance ;
- aucun paiement ne peut dépasser le montant dû (sauf avance autorisée) ;
- toute opération est historisée.

---

# Types de frais

Le système doit permettre de créer un nombre illimité de catégories de frais.

Exemples :

## Frais administratifs

- inscription
- réinscription
- dossier
- certificat

---

## Frais pédagogiques

- scolarité annuelle
- laboratoire
- informatique
- bibliothèque
- examens
- évaluations

---

## Frais de services

- transport
- internat
- cantine
- garderie
- activités sportives
- activités culturelles

---

## Frais exceptionnels

- uniforme
- badge
- carte scolaire
- assurance
- visite médicale
- voyage pédagogique

---

# Paramétrage d'un frais

Chaque frais possède :

Identifiant

Nom

Code

Description

Catégorie

Niveau concerné

Classe concernée (optionnel)

Série

Cycle

Montant

Devise

Date de début

Date de fin

Obligatoire

Facultatif

Mode de calcul

Statut

---

# Modes de calcul

Le logiciel doit permettre plusieurs méthodes.

## Montant fixe

Exemple

Inscription

100 000 FCFA

---

## Par mensualité

Exemple

9 mensualités

35 000 FCFA

---

## Par trimestre

Exemple

3 échéances

120 000 FCFA

---

## Selon le niveau

Exemple

6e

300 000 FCFA

Terminale

450 000 FCFA

---

## Selon la série

Exemple

2nde C

500 000 FCFA

2nde A

350 000 FCFA

---

## Selon le statut

Interne

Externe

Demi-pensionnaire

---

# Échéanciers

Chaque frais peut être payé :

- en une fois ;
- mensuellement ;
- trimestriellement ;
- semestriellement ;
- selon un calendrier personnalisé.

---

# Génération automatique

Lorsqu'un élève est inscrit :

↓

Le système génère automatiquement :

- son compte financier ;
- ses créances ;
- son échéancier ;
- ses factures.

Aucune intervention manuelle n'est nécessaire.

---

# Remises

Les remises peuvent être :

- fixes ;
- en pourcentage.

Origines possibles :

- remise commerciale ;
- remise sociale ;
- remise exceptionnelle ;
- fidélité ;
- partenariat.

Toutes les remises doivent être justifiées.

---

# Exonérations

Types :

- totale ;
- partielle.

Une exonération nécessite :

- une décision ;
- un responsable ;
- une période de validité.

Elle reste historisée.

---

# Bourses

Le système gère :

- bourses nationales ;
- bourses privées ;
- bourses internes ;
- prises en charge.

Chaque bourse peut couvrir :

- un pourcentage ;
- un montant fixe ;
- certains frais uniquement.

---

# Plan de paiement

Le gestionnaire peut créer un échéancier personnalisé.

Exemple :

Inscription :

100 000 FCFA

↓

10 000 FCFA/mois

Pendant 10 mois.

Le système contrôle automatiquement les retards.

---

# Pénalités

Les pénalités sont paramétrables.

Déclencheurs possibles :

- retard de paiement ;
- échéance dépassée ;
- rejet bancaire.

Types :

- montant fixe ;
- pourcentage ;
- intérêt journalier.

---

# Avances

Le système peut accepter :

- des avances ;
- des acomptes.

Ces montants sont automatiquement imputés aux prochaines créances selon les règles définies par l'établissement.

---

# Priorité d'imputation

Lorsqu'un paiement couvre plusieurs créances, l'ordre d'imputation est configurable.

Exemple :

1. Inscription
2. Réinscription
3. Mensualités échues
4. Cantine
5. Transport
6. Internat
7. Activités

---

# Compte financier de l'élève

Chaque élève possède un compte unique.

Le compte affiche :

- créances ;
- paiements ;
- remises ;
- pénalités ;
- bourses ;
- avances ;
- remboursements ;
- solde.

---

# États possibles d'une créance

- Brouillon
- Générée
- Partiellement payée
- Soldée
- En retard
- Suspendue
- Annulée

---

# Solde

Le système calcule automatiquement :

Montant facturé

− Paiements

− Remises

− Exonérations

− Bourses

+ Pénalités

= Solde restant

Le calcul est effectué en temps réel.

---

# Blocage pédagogique

L'établissement peut configurer des restrictions automatiques.

Exemples :

- impossibilité d'imprimer un bulletin ;
- impossibilité de composer ;
- impossibilité de se réinscrire ;
- suspension du transport ;
- suspension de la cantine.

Chaque règle est paramétrable.

---

# Notifications

Le système envoie automatiquement :

Avant échéance :

- SMS ;
- Email ;
- Notification mobile.

Après échéance :

- relance 1 ;
- relance 2 ;
- relance finale.

Les modèles sont personnalisables.

---

# Remboursements

Un remboursement nécessite :

- une demande ;
- une validation ;
- une justification.

Le remboursement génère automatiquement :

- une pièce justificative ;
- une écriture comptable ;
- une mise à jour du compte élève.

---

# Cas particuliers

## Élève transféré

Le système :

- clôture le compte ;
- calcule le solde ;
- génère le relevé.

---

## Élève démissionnaire

Calcul automatique :

- frais acquis ;
- frais remboursables ;
- pénalités éventuelles.

---

## Changement de classe

Les créances futures sont recalculées automatiquement si les frais diffèrent.

---

## Redoublement

L'établissement choisit :

- conserver les anciens avantages ;
- ou appliquer une nouvelle tarification.

---

# Tableaux de bord

Le Directeur visualise notamment :

- montant attendu ;
- montant encaissé ;
- reste à encaisser ;
- taux de recouvrement ;
- créances en retard ;
- montants exonérés ;
- montants remis ;
- montant des bourses ;
- prévisions de trésorerie.

---

# Intégrations

Le sous-module Scolarité communique avec :

- Admissions ;
- Inscriptions ;
- Encaissements ;
- Comptabilité ;
- Caisse ;
- Banque ;
- Notifications ;
- Tableau de bord ;
- Rapports ;
- IA.

Toutes les communications se font via des événements métier.

---

# Événements métier

Exemples :

StudentRegistered

↓

FeesGenerated

↓

InvoiceCreated

↓

PaymentReceived

↓

ReceiptIssued

↓

AccountingEntriesCreated

↓

DashboardUpdated

↓

ParentNotified

---

# API principales

Le module expose notamment :

- Créer un frais
- Modifier un frais
- Désactiver un frais
- Générer les créances
- Consulter le compte d'un élève
- Appliquer une remise
- Appliquer une exonération
- Accorder une bourse
- Générer un échéancier
- Simuler un plan de paiement
- Calculer le solde
- Exporter les états de scolarité

---

# Critères d'acceptation

Le module sera considéré conforme lorsque :

- toute inscription génère automatiquement les créances ;
- les calculs de soldes sont exacts ;
- les paiements mettent à jour le compte instantanément ;
- les remises et exonérations sont traçables ;
- les pénalités sont calculées automatiquement ;
- les notifications sont envoyées selon les règles définies ;
- les tableaux de bord reflètent les données en temps réel.

---

# Conclusion

Le sous-module **Gestion des Frais de Scolarité** constitue la pierre angulaire du module Finance d'EduWeb Planner.

Toutes les opérations financières liées aux apprenants doivent prendre naissance dans ce sous-module avant d'alimenter la facturation, les encaissements, la comptabilité, les rapports et les outils décisionnels. Son fonctionnement doit être entièrement paramétrable afin de s'adapter aux réalités des établissements préscolaires, primaires, secondaires, techniques, professionnels et universitaires.
