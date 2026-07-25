# Gestion des Dépenses
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Dépenses** permet de gérer l'ensemble des sorties financières de l'établissement.

Il couvre :

- les demandes de dépenses ;
- les dépenses de fonctionnement ;
- les dépenses d'investissement ;
- les notes de frais ;
- les missions ;
- les avances ;
- les remboursements ;
- les paiements ;
- les validations ;
- les pièces justificatives ;
- les écritures comptables automatiques.

---

# Vision

Toute dépense doit être :

- autorisée ;
- budgétairement couverte ;
- justifiée ;
- validée ;
- payée ;
- comptabilisée ;
- archivée.

Aucune dépense ne doit pouvoir être exécutée sans contrôle préalable.

---

# Types de dépenses

Le système distingue :

## Dépenses de fonctionnement

- fournitures
- eau
- électricité
- internet
- entretien
- carburant
- sécurité
- nettoyage
- restauration

---

## Dépenses d'investissement

- bâtiments
- équipements
- mobilier
- informatique
- véhicules

---

## Dépenses pédagogiques

- laboratoires
- bibliothèques
- activités scolaires
- examens
- sorties éducatives

---

## Dépenses administratives

- communication
- impression
- consommables
- affranchissement
- réception

---

## Dépenses de mission

- transport
- hébergement
- restauration
- indemnités
- péages

---

## Dépenses exceptionnelles

- urgence
- catastrophe
- contentieux
- sinistre
- réparations majeures

---

# Sources d'une dépense

Une dépense peut provenir :

- d'une demande interne ;
- d'un bon de commande ;
- d'une facture fournisseur ;
- d'une mission ;
- d'un contrat ;
- d'une décision de direction.

---

# Demande de dépense

Chaque demande comporte :

- UUID
- Numéro
- Objet
- Description
- Demandeur
- Service
- Centre de coût
- Projet
- Budget concerné
- Montant estimé
- Devise
- Niveau d'urgence
- Pièces justificatives

---

# États

Une dépense peut être :

- Brouillon
- Soumise
- En validation
- Approuvée
- Refusée
- Engagée
- Payée
- Régularisée
- Clôturée
- Archivée

---

# Workflow

Demande

↓

Contrôle budgétaire

↓

Validation

↓

Engagement

↓

Paiement

↓

Comptabilité

↓

Archivage

---

# Validation

Le circuit est paramétrable.

Exemple :

≤ 100 000 FCFA

↓

Chef de service

---

100 001 à 1 000 000 FCFA

↓

Gestionnaire financier

---

> 1 000 000 FCFA

↓

Directeur Général

Les seuils sont entièrement configurables.

---

# Contrôle budgétaire

Avant validation :

Budget disponible

↓

Montant demandé

↓

Autorisation

↓

Réservation des crédits

---

# Modes de paiement

Le système gère :

- espèces ;
- virement bancaire ;
- chèque ;
- Mobile Money Business ;
- carte bancaire.

Le mode est historisé.

---

# Notes de frais

Le système permet de gérer :

- missions ;
- formations ;
- déplacements ;
- représentations.

Chaque note comprend :

- période ;
- bénéficiaire ;
- justificatifs ;
- montant demandé ;
- montant validé.

---

# Avances

Les avances peuvent être accordées :

- pour mission ;
- pour achat urgent ;
- pour activité exceptionnelle.

Chaque avance doit être régularisée.

---

# Régularisation

Le bénéficiaire fournit :

- les justificatifs ;
- le détail des dépenses.

Le système calcule automatiquement :

Avance

-

Dépenses justifiées

=

Solde

Le solde peut être :

- remboursé ;
- complété.

---

# Pièces justificatives

Le système accepte :

- factures ;
- reçus ;
- contrats ;
- bons de commande ;
- ordres de mission ;
- photos ;
- documents PDF.

Toutes les pièces sont versionnées et archivées.

---

# Dépenses récurrentes

Le système gère les dépenses périodiques :

- loyers ;
- abonnements ;
- maintenance ;
- assurances ;
- internet.

Les échéances sont automatiquement planifiées.

---

# Règles métier

## RM-1400

Aucune dépense ne peut être engagée sans budget disponible, sauf autorisation exceptionnelle.

---

## RM-1401

Toute dépense doit être rattachée à une ligne budgétaire.

---

## RM-1402

Chaque paiement génère automatiquement une écriture comptable.

---

## RM-1403

Les avances doivent être régularisées dans les délais définis.

---

## RM-1404

Toute dépense possède au moins une pièce justificative, sauf dérogation autorisée.

---

## RM-1405

Une dépense clôturée ne peut être modifiée.

---

# Comptabilisation automatique

Lors de la validation :

Débit

↓

Compte de charge ou d'immobilisation

Crédit

↓

Compte fournisseur ou compte d'attente

---

Lors du paiement :

Débit

↓

Compte fournisseur ou compte d'attente

Crédit

↓

Banque ou caisse

---

# Intégration avec les budgets

Chaque dépense :

↓

consomme les crédits réservés

↓

met à jour le disponible

↓

alimente les tableaux de bord budgétaires

---

# Intégration avec les achats

Bon de commande

↓

Réception

↓

Facture

↓

Dépense

↓

Paiement

↓

Comptabilité

---

# Tableau de bord

Le Directeur visualise :

- dépenses du jour ;
- dépenses du mois ;
- dépenses par service ;
- dépenses par projet ;
- dépenses par nature ;
- dépenses par mode de paiement ;
- dépenses en attente de validation ;
- dépenses récurrentes.

---

# Alertes

Le système notifie :

- dépassement budgétaire ;
- avance non régularisée ;
- dépense sans justificatif ;
- paiement en retard ;
- dépense exceptionnelle ;
- échéance de dépense récurrente.

---

# BPMN simplifié

Demande

↓

Contrôle budgétaire

↓

Validation

↓

Engagement

↓

Paiement

↓

Comptabilité

↓

Archivage

---

# API principales

- Créer une demande de dépense
- Modifier une demande
- Valider une dépense
- Enregistrer une avance
- Régulariser une avance
- Enregistrer un paiement
- Ajouter une pièce justificative
- Consulter les dépenses
- Exporter les dépenses

---

# Cas d'erreur

## Budget insuffisant

HTTP 422

---

## Dépense déjà payée

HTTP 409

---

## Pièce justificative absente

HTTP 422

---

## Avance non régularisable

HTTP 409

---

## Ligne budgétaire inexistante

HTTP 404

---

# Tests fonctionnels

Le système devra vérifier :

✓ création d'une demande ;

✓ contrôle budgétaire ;

✓ validation selon les seuils ;

✓ paiement ;

✓ régularisation d'avance ;

✓ génération des écritures comptables ;

✓ archivage des justificatifs.

---

# Indicateurs (KPI)

- Nombre de dépenses
- Montant total des dépenses
- Dépenses par nature
- Dépenses par service
- Dépenses par projet
- Taux d'exécution budgétaire
- Nombre d'avances en cours
- Taux de régularisation des avances
- Délai moyen de validation
- Délai moyen de paiement

---

# Intelligence artificielle

Le moteur IA peut :

- détecter les dépenses inhabituelles ;
- identifier les risques de dépassement budgétaire ;
- recommander des économies ;
- prévoir les dépenses futures ;
- analyser les habitudes de consommation par service ;
- détecter d'éventuelles anomalies ou fraudes.

Les analyses de l'IA restent consultatives et ne remplacent jamais les décisions des responsables financiers.

---

# Évolutions prévues

Le module devra intégrer :

- application mobile pour les notes de frais ;
- numérisation OCR des justificatifs ;
- extraction automatique des données des factures ;
- signature électronique des validations ;
- cartes de paiement professionnelles ;
- intégration avec les plateformes de réservation de voyages et d'hébergement ;
- détection avancée des fraudes par intelligence artificielle.

---

# Conclusion

Le sous-module **Dépenses** constitue le système central de gestion des sorties financières d'EduWeb Planner. En assurant un contrôle budgétaire permanent, une traçabilité complète des validations, une gestion rigoureuse des justificatifs et une intégration native avec les modules Achats, Budgets, Banque, Caisse et Comptabilité, il garantit une exécution sécurisée, transparente et conforme des dépenses des établissements d'enseignement.
