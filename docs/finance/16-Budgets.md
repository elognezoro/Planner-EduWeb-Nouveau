# Gestion Budgétaire
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Budgets** permet de planifier, suivre, contrôler et analyser l'exécution budgétaire de l'établissement.

Il couvre :

- la préparation budgétaire ;
- les budgets annuels et pluriannuels ;
- les centres de coûts ;
- les centres de profits ;
- les projets ;
- les engagements ;
- les consommations ;
- les révisions ;
- les simulations ;
- les prévisions ;
- les tableaux de bord budgétaires.

---

# Vision

Le budget constitue le référentiel financier de l'établissement.

Toute dépense, tout engagement et tout investissement doivent être contrôlés par rapport au budget disponible.

Le système fournit une vision en temps réel des crédits :

- votés ;
- engagés ;
- consommés ;
- disponibles.

---

# Types de budgets

Le système gère :

## Budget de fonctionnement

- salaires
- fournitures
- entretien
- énergie
- télécommunications

---

## Budget d'investissement

- bâtiments
- laboratoires
- informatique
- mobilier
- véhicules

---

## Budget de projet

- recherche
- coopération
- subventions
- formations
- événements

---

## Budget exceptionnel

- urgence
- crise
- catastrophe
- financement spécifique

---

# Niveaux budgétaires

Le budget peut être défini par :

- institution ;
- établissement ;
- campus ;
- service ;
- département ;
- projet ;
- centre de coût ;
- activité.

---

# Structure budgétaire

Le budget est organisé selon une hiérarchie :

Exercice

↓

Programme

↓

Action

↓

Projet

↓

Centre de coût

↓

Ligne budgétaire

---

# Ligne budgétaire

Chaque ligne comporte :

- UUID
- Code
- Libellé
- Exercice
- Nature
- Compte comptable
- Centre de coût
- Projet
- Devise
- Montant initial
- Montant révisé
- Statut

---

# États d'un budget

- Brouillon
- En préparation
- Soumis
- En validation
- Approuvé
- En exécution
- Révisé
- Clôturé
- Archivé

---

# Préparation budgétaire

Le système permet :

- saisie manuelle ;
- import Excel ;
- reprise du budget N-1 ;
- simulation automatique basée sur l'historique ;
- génération assistée par IA.

---

# Workflow budgétaire

Préparation

↓

Validation

↓

Adoption

↓

Exécution

↓

Révision

↓

Clôture

↓

Archivage

---

# Contrôle budgétaire

Pour chaque engagement, le système calcule :

Budget voté

-

Engagements

-

Consommations

=

Budget disponible

Le calcul est effectué en temps réel.

---

# Engagements

Les engagements peuvent provenir de :

- demandes d'achat ;
- bons de commande ;
- contrats ;
- marchés ;
- conventions.

Chaque engagement réserve automatiquement les crédits concernés.

---

# Consommations

Les consommations sont générées notamment par :

- paiements fournisseurs ;
- dépenses ;
- salaires ;
- immobilisations ;
- régularisations.

---

# Révisions budgétaires

Le système autorise :

- augmentation ;
- diminution ;
- transfert de crédits ;
- ouverture de crédits supplémentaires ;
- annulation de crédits.

Chaque révision est historisée.

---

# Simulations

Le moteur permet de simuler :

- augmentation des effectifs ;
- évolution des frais de scolarité ;
- inflation ;
- variation des dépenses ;
- nouveaux investissements ;
- ouverture de nouveaux établissements.

Les simulations n'affectent jamais le budget réel.

---

# Budgets pluriannuels

Le système peut gérer :

- budget annuel ;
- budget triennal ;
- budget quinquennal.

Les projections sont consolidées par exercice.

---

# Centres de coûts

Exemples :

- Administration
- Direction
- Scolarité
- Cantine
- Internat
- Transport
- Bibliothèque
- Laboratoire
- Informatique
- Formation continue

Chaque dépense est rattachée à un centre de coût.

---

# Centres de profit

Le système peut suivre les recettes générées par :

- formation continue ;
- prestations de services ;
- location d'infrastructures ;
- projets financés ;
- événements.

---

# Règles métier

## RM-1300

Aucun engagement ne peut dépasser le budget disponible, sauf autorisation exceptionnelle.

---

## RM-1301

Toute modification budgétaire est historisée.

---

## RM-1302

Les crédits réservés sont immédiatement déduits du disponible.

---

## RM-1303

Les consommations mettent automatiquement à jour l'exécution budgétaire.

---

## RM-1304

Une ligne budgétaire clôturée ne peut plus être modifiée.

---

## RM-1305

Chaque budget appartient à un exercice comptable unique.

---

# Intégration avec les achats

Demande d'achat

↓

Contrôle budgétaire

↓

Engagement

↓

Commande

↓

Consommation

↓

Comptabilité

---

# Intégration avec les dépenses

Dépense

↓

Vérification du disponible

↓

Validation

↓

Paiement

↓

Mise à jour du budget

---

# Intégration comptable

Le moteur comptable :

- rapproche les consommations des comptes comptables ;
- consolide les dépenses par nature ;
- produit les états budgétaires.

---

# Tableau de bord

Le Directeur visualise :

- budget voté ;
- budget engagé ;
- budget consommé ;
- budget disponible ;
- taux d'exécution ;
- consommation par service ;
- consommation par projet ;
- prévisions de fin d'exercice.

---

# Alertes

Le système notifie :

- dépassement budgétaire ;
- budget proche de l'épuisement ;
- faible taux d'exécution ;
- révision à valider ;
- engagement bloqué ;
- ligne budgétaire inactive.

---

# BPMN simplifié

Préparation

↓

Validation

↓

Adoption

↓

Contrôle budgétaire

↓

Engagement

↓

Consommation

↓

Révision

↓

Clôture

↓

Archivage

---

# API principales

- Créer un budget
- Modifier un budget
- Ajouter une ligne budgétaire
- Valider un budget
- Réviser un budget
- Transférer des crédits
- Consulter l'exécution
- Générer un rapport budgétaire
- Exporter le budget

---

# Cas d'erreur

## Budget inexistant

HTTP 404

---

## Budget clôturé

HTTP 409

---

## Crédit insuffisant

HTTP 422

---

## Ligne budgétaire inexistante

HTTP 404

---

## Révision interdite

HTTP 409

---

# Tests fonctionnels

Le système devra vérifier :

✓ création d'un budget ;

✓ validation du workflow ;

✓ calcul des crédits disponibles ;

✓ réservation des crédits lors d'un engagement ;

✓ mise à jour des consommations ;

✓ révision budgétaire ;

✓ simulation sans impact sur le budget réel.

---

# Indicateurs (KPI)

- Budget total
- Budget engagé
- Budget consommé
- Budget disponible
- Taux d'exécution budgétaire
- Taux d'engagement
- Nombre de révisions
- Délai moyen de validation
- Consommation par centre de coût
- Consommation par projet
- Prévision de fin d'exercice

---

# Intelligence artificielle

Le moteur IA peut :

- prévoir les dépenses de fin d'exercice ;
- recommander une répartition optimale des crédits ;
- détecter les lignes budgétaires sous-utilisées ou surconsommées ;
- simuler différents scénarios budgétaires ;
- anticiper les besoins financiers en fonction des effectifs, des projets et des tendances historiques.

Les recommandations de l'IA sont consultatives et ne remplacent jamais les décisions des responsables financiers.

---

# Évolutions prévues

Le module devra intégrer :

- budget participatif ;
- planification financière à moyen terme ;
- consolidation multi-établissements ;
- consolidation multi-pays ;
- analyse financière prédictive ;
- intégration avec les systèmes publics de suivi budgétaire lorsque requis par les réglementations nationales.

---

# Conclusion

Le sous-module **Budgets** constitue le système de pilotage financier d'EduWeb Planner. Grâce à son contrôle en temps réel des engagements et des consommations, il garantit une gestion rigoureuse des ressources, favorise une prise de décision éclairée et assure une parfaite cohérence entre les objectifs stratégiques, les dépenses opérationnelles et la comptabilité.
