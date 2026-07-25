# Gestion des Achats
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Achats** permet de gérer l'ensemble du processus d'acquisition des biens et services de l'établissement.

Il couvre :

- les demandes d'achat ;
- les validations hiérarchiques ;
- les consultations de fournisseurs ;
- les bons de commande ;
- les réceptions ;
- les factures fournisseurs ;
- les paiements ;
- les retours ;
- les écritures comptables automatiques.

---

# Vision

Toute dépense doit être :

- justifiée ;
- budgétisée ;
- approuvée ;
- tracée ;
- comptabilisée ;
- archivée.

Le système doit empêcher tout achat hors procédure.

---

# Cycle Procure-to-Pay (P2P)

Le cycle standard est le suivant :

Expression du besoin

↓

Demande d'achat

↓

Validation

↓

Consultation fournisseurs (optionnelle)

↓

Bon de commande

↓

Réception

↓

Facture fournisseur

↓

Validation

↓

Paiement

↓

Écriture comptable

↓

Archivage

---

# Types d'achats

Le système distingue :

## Biens

- fournitures scolaires
- mobilier
- matériel informatique
- véhicules
- livres
- équipements de laboratoire

---

## Services

- maintenance
- nettoyage
- sécurité
- internet
- formation
- assurance

---

## Travaux

- construction
- rénovation
- peinture
- plomberie
- électricité

---

# Demande d'achat

Chaque demande comprend :

- numéro
- demandeur
- service
- centre de coût
- date
- urgence
- justification
- budget concerné
- pièces jointes

---

# États d'une demande

- Brouillon
- Soumise
- En validation
- Approuvée
- Refusée
- Commandée
- Clôturée
- Archivée

---

# Validation

Le workflow est paramétrable.

Exemple :

Montant < 100 000 FCFA

↓

Chef de service

---

100 000 à 1 000 000 FCFA

↓

Gestionnaire financier

---

> 1 000 000 FCFA

↓

Directeur Général

Les seuils sont configurables.

---

# Consultation des fournisseurs

Le système peut gérer :

- consultation simple ;
- appel à cotation ;
- appel d'offres restreint ;
- appel d'offres ouvert.

Les réponses sont archivées.

---

# Bon de commande

Le bon de commande comprend :

- fournisseur ;
- articles ;
- quantités ;
- prix ;
- délais ;
- conditions de paiement ;
- lieu de livraison ;
- signature électronique.

---

# Réception

Une commande peut être :

- totalement reçue ;
- partiellement reçue ;
- refusée.

Chaque réception enregistre :

- date ;
- réceptionnaire ;
- quantités reçues ;
- observations.

---

# Contrôle de conformité

À la réception, le système vérifie :

- quantité commandée ;
- quantité livrée ;
- état des articles ;
- conformité des références.

Les écarts sont signalés.

---

# Facture fournisseur

Chaque facture comprend :

- numéro fournisseur ;
- date ;
- montant ;
- devise ;
- taxes ;
- échéance ;
- pièces justificatives.

Le système contrôle la cohérence avec :

- la commande ;
- la réception.

---

# Paiement fournisseur

Modes de paiement :

- espèces ;
- virement ;
- chèque ;
- Mobile Money Business ;
- carte bancaire.

Le paiement peut être :

- total ;
- partiel ;
- échelonné.

---

# Retours fournisseur

Le système permet :

- retour total ;
- retour partiel.

Chaque retour génère :

- un bon de retour ;
- une régularisation de stock ;
- une écriture comptable.

---

# Règles métier

## RM-900

Aucun achat ne peut être effectué sans demande approuvée (si cette règle est activée).

---

## RM-901

Une commande ne peut être créée que pour un fournisseur actif.

---

## RM-902

Une réception ne peut excéder les quantités commandées, sauf autorisation spécifique.

---

## RM-903

Une facture fournisseur ne peut être payée deux fois.

---

## RM-904

Toute facture validée génère automatiquement les écritures comptables.

---

## RM-905

Les engagements budgétaires sont mis à jour dès la validation du bon de commande.

---

# Comptabilisation automatique

Le moteur comptable génère automatiquement :

Débit

↓

Compte de charge ou d'immobilisation

Crédit

↓

Compte fournisseur

Puis, lors du paiement :

Débit

↓

Compte fournisseur

Crédit

↓

Banque ou caisse

---

# Budgets

Chaque achat est rattaché à :

- un budget ;
- un centre de coût ;
- un projet (optionnel).

Le système vérifie :

Budget disponible

↓

Montant engagé

↓

Montant consommé

---

# Intégration avec les stocks

Pour les articles stockables :

Réception

↓

Entrée en stock

↓

Valorisation

↓

Disponibilité

Les mouvements sont automatiques.

---

# Intégration avec les immobilisations

Si l'article est immobilisable :

Réception

↓

Création de l'immobilisation

↓

Plan d'amortissement

---

# Tableau de bord

Le Directeur visualise :

- montant des achats ;
- achats par fournisseur ;
- achats par service ;
- commandes en attente ;
- commandes en retard ;
- engagements budgétaires ;
- dépenses par catégorie.

---

# Alertes

Le système alerte en cas de :

- dépassement budgétaire ;
- commande non réceptionnée ;
- facture en retard ;
- fournisseur inactif ;
- réception incomplète ;
- paiement proche de l'échéance.

---

# BPMN simplifié

Besoin

↓

Demande d'achat

↓

Validation

↓

Bon de commande

↓

Réception

↓

Facture

↓

Paiement

↓

Comptabilité

↓

Archivage

---

# API principales

- Créer une demande d'achat
- Valider une demande
- Générer un bon de commande
- Enregistrer une réception
- Enregistrer une facture fournisseur
- Régler une facture
- Effectuer un retour
- Rechercher une commande
- Exporter les achats

---

# Cas d'erreur

## Budget insuffisant

HTTP 422

---

## Fournisseur inactif

HTTP 409

---

## Quantité reçue supérieure à la commande

HTTP 422

---

## Facture déjà réglée

HTTP 409

---

## Commande annulée

HTTP 409

---

# Tests fonctionnels

Le système devra vérifier :

✓ création d'une demande ;

✓ validation selon les seuils ;

✓ génération du bon de commande ;

✓ réception partielle et totale ;

✓ création automatique des écritures comptables ;

✓ mise à jour des stocks ;

✓ contrôle budgétaire.

---

# Indicateurs (KPI)

- Nombre de demandes d'achat
- Nombre de commandes
- Taux de validation
- Délai moyen d'approbation
- Délai moyen de livraison
- Taux de conformité des livraisons
- Montant des achats
- Achats par fournisseur
- Consommation budgétaire
- Économies réalisées après consultation

---

# Intelligence artificielle

Le moteur IA peut :

- recommander le fournisseur le plus performant ;
- prévoir les besoins d'approvisionnement ;
- détecter des anomalies de prix ;
- identifier les achats inhabituels ;
- proposer des regroupements de commandes pour réduire les coûts.

Aucune commande n'est validée automatiquement par l'IA.

---

# Évolutions prévues

Le module devra intégrer :

- les catalogues fournisseurs ;
- les contrats-cadres ;
- les marchés publics ;
- les signatures électroniques qualifiées ;
- les appels d'offres électroniques ;
- les API fournisseurs ;
- le suivi logistique (tracking des livraisons).

---

# Conclusion

Le sous-module **Achats** garantit une gestion rigoureuse des acquisitions de l'établissement, depuis l'expression du besoin jusqu'au règlement du fournisseur. Grâce à son intégration avec les budgets, les stocks, les immobilisations et la comptabilité, il assure une maîtrise complète des dépenses et une parfaite traçabilité des engagements financiers.
