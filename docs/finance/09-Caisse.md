# Gestion des Caisses
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Caisse** permet de gérer l'ensemble des mouvements de trésorerie en espèces et autres moyens de paiement conservés temporairement par l'établissement.

Il garantit :

- la sécurité des fonds ;
- la traçabilité des opérations ;
- la séparation des responsabilités ;
- le contrôle quotidien des caissiers ;
- la préparation des versements bancaires.

---

# Définition

Une caisse représente un point physique ou virtuel où sont enregistrées les opérations financières.

Exemples :

- Caisse principale
- Caisse secondaire
- Caisse Internat
- Caisse Cantine
- Caisse Transport
- Caisse Bibliothèque
- Caisse Boutique scolaire
- Caisse Évènementielle

---

# Types de caisses

Le système gère plusieurs types.

## Caisse physique

Utilisée par un caissier.

---

## Caisse virtuelle

Paiements en ligne.

---

## Caisse Mobile Money

Orange Money

MTN Money

Wave

Moov Money

---

## Caisse bancaire

Compte bancaire utilisé comme caisse.

---

# Paramétrage

Chaque caisse possède :

UUID

Nom

Code

Établissement

Devise

Responsable

Type

Statut

Date d'ouverture

Date de fermeture

Montant maximal autorisé

Autorisation de découvert

---

# États

Une caisse peut être :

- Fermée
- Ouverte
- Suspendue
- Clôturée
- Archivée

---

# Sessions de caisse

Une caisse fonctionne par sessions.

Exemple

08h00

↓

Ouverture

↓

Encaissements

↓

Décaissements

↓

Versement

↓

Clôture

Chaque session est indépendante.

---

# Ouverture de caisse

Une ouverture nécessite :

- un utilisateur habilité ;
- un fonds initial ;
- une validation (optionnelle selon les règles).

Le système enregistre :

- date ;
- heure ;
- montant d'ouverture ;
- responsable ;
- observations.

---

# Fonds de caisse

Le fonds initial est paramétrable.

Exemple

100 000 FCFA

Il peut être :

- fixe ;
- calculé ;
- reporté automatiquement depuis la veille.

---

# Mouvements de caisse

Chaque mouvement est classé.

## Encaissement

Paiement reçu.

---

## Décaissement

Paiement effectué.

---

## Transfert

Vers une autre caisse.

---

## Versement bancaire

Dépôt vers un compte bancaire.

---

## Approvisionnement

Ajout de liquidités.

---

## Retrait bancaire

Approvisionnement depuis une banque.

---

## Régularisation

Correction exceptionnelle.

---

# Règles métier

## RM-500

Une caisse ne peut recevoir des opérations que lorsqu'elle est ouverte.

---

## RM-501

Une session ne peut être ouverte qu'une seule fois.

---

## RM-502

Une caisse ne peut avoir qu'une seule session active.

---

## RM-503

Tout mouvement modifie immédiatement le solde théorique.

---

## RM-504

Toute opération doit être rattachée à une session.

---

## RM-505

Les opérations d'une session clôturée deviennent non modifiables.

---

# Solde

Le système calcule :

Solde initial

+

Encaissements

-

Décaissements

+

Approvisionnements

-

Versements

± Régularisations

=

Solde théorique

---

# Comptage physique

En fin de journée :

Le caissier effectue un comptage réel.

Le système compare :

Solde théorique

↓

Solde réel

↓

Écart

---

# Écarts

Types :

Excédent

Déficit

Erreur de saisie

Perte

Vol

Chaque écart nécessite :

- justification ;
- validation ;
- historisation.

---

# Clôture

La clôture calcule automatiquement :

- nombre d'opérations ;
- recettes ;
- dépenses ;
- solde final ;
- écarts ;
- montant à verser.

---

# Versements bancaires

Une caisse peut effectuer un dépôt bancaire.

Workflow

Clôture

↓

Versement

↓

Réception Banque

↓

Rapprochement

↓

Comptabilité

---

# Transfert entre caisses

Exemple

Caisse principale

↓

Caisse Cantine

Le système crée automatiquement :

- un décaissement ;
- un encaissement correspondant ;
- les écritures comptables.

---

# Décaissements

Décaissements possibles :

- remboursement
- achat
- avance
- petite caisse
- mission
- carburant
- entretien

Chaque décaissement nécessite :

- bénéficiaire ;
- motif ;
- pièce justificative ;
- validation selon le montant.

---

# Seuils d'autorisation

Exemple

< 50 000 FCFA

Validation automatique

---

50 000 à 500 000 FCFA

Validation Gestionnaire

---

> 500 000 FCFA

Validation Directeur

Les seuils sont entièrement paramétrables.

---

# Multi-devises

Une caisse peut être :

- mono-devise ;
- multi-devises.

Chaque devise possède son propre solde.

---

# Journal de caisse

Chaque session produit automatiquement un journal.

Il contient :

- ouverture ;
- mouvements ;
- versements ;
- transferts ;
- clôture ;
- écarts.

Le journal est inaltérable.

---

# Audit

Toutes les opérations enregistrent :

- utilisateur ;
- date ;
- heure ;
- IP ;
- appareil ;
- ancienne valeur ;
- nouvelle valeur.

---

# Tableau de bord

Le Directeur visualise :

- caisses ouvertes ;
- montant en caisse ;
- versements du jour ;
- écarts ;
- recettes par caisse ;
- dépenses par caisse ;
- solde global.

---

# Alertes

Le système alerte en cas de :

- caisse non clôturée ;
- solde négatif ;
- écart important ;
- dépassement du plafond ;
- caisse inactive ;
- ouverture tardive.

---

# Intégrations

Le module communique avec :

- Encaissements
- Banque
- Comptabilité
- Budgets
- Audit
- Notifications
- Rapports
- IA

---

# BPMN simplifié

Ouverture de caisse

↓

Contrôle du fonds

↓

Session active

↓

Encaissements / Décaissements

↓

Comptage physique

↓

Calcul des écarts

↓

Validation

↓

Clôture

↓

Versement bancaire (optionnel)

↓

Archivage

---

# API principales

- Ouvrir une caisse
- Fermer une caisse
- Ouvrir une session
- Clôturer une session
- Enregistrer un mouvement
- Effectuer un transfert
- Effectuer un versement bancaire
- Consulter le journal
- Consulter le solde
- Exporter les mouvements

---

# Cas d'erreur

## Session inexistante

Retour :

HTTP 404

---

## Caisse fermée

Retour :

HTTP 409

---

## Solde insuffisant

Retour :

HTTP 422

---

## Double clôture

Retour :

HTTP 409

---

## Versement supérieur au solde

Retour :

HTTP 422

---

# Tests fonctionnels

Le système devra vérifier :

✓ ouverture correcte

✓ fermeture correcte

✓ calcul exact des soldes

✓ calcul exact des écarts

✓ impossibilité d'encaisser sur une caisse fermée

✓ impossibilité d'ouvrir deux sessions simultanément

✓ génération automatique des écritures comptables

✓ génération automatique du journal de caisse

---

# Indicateurs (KPI)

- Solde par caisse
- Recettes journalières
- Dépenses journalières
- Taux d'écarts
- Nombre de clôtures
- Délai moyen de clôture
- Montant des versements bancaires
- Rotation de la trésorerie

---

# Évolutions futures

Le module devra intégrer :

- compatibilité avec les tiroirs-caisses connectés ;
- imprimantes thermiques ;
- lecteurs de codes-barres et QR Codes ;
- terminaux de paiement électroniques (TPE) ;
- comptage assisté des billets et pièces ;
- signature biométrique lors des décaissements importants ;
- détection d'anomalies de caisse par intelligence artificielle.

---

# Conclusion

Le sous-module **Caisse** garantit la gestion opérationnelle de la trésorerie de l'établissement. Il assure un contrôle permanent des fonds, une traçabilité complète des mouvements et une intégration automatique avec les modules Encaissements, Banque et Comptabilité. Son architecture doit permettre un fonctionnement sécurisé, même dans des établissements à fort volume de transactions ou disposant de plusieurs points d'encaissement.
