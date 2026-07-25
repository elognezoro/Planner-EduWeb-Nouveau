# Gestion des Stocks et Magasins
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Stocks** permet de gérer l'ensemble des biens consommables et stockables de l'établissement.

Il couvre :

- les magasins ;
- les dépôts ;
- les articles ;
- les mouvements de stock ;
- les inventaires ;
- les valorisations ;
- les réapprovisionnements ;
- les transferts ;
- les réservations ;
- les écritures comptables automatiques.

---

# Vision

Chaque article doit être :

- identifié ;
- localisé ;
- valorisé ;
- traçable ;
- historisé.

Le système garantit la connaissance en temps réel des quantités disponibles.

---

# Domaines couverts

Le module permet de gérer notamment :

- fournitures scolaires ;
- fournitures administratives ;
- livres ;
- équipements informatiques ;
- consommables informatiques ;
- matériels pédagogiques ;
- équipements sportifs ;
- produits d'entretien ;
- produits de laboratoire ;
- denrées alimentaires (cantine) ;
- pièces de maintenance.

---

# Organisation des magasins

Le système autorise plusieurs niveaux :

Établissement

↓

Magasin

↓

Zone

↓

Rayon

↓

Étagère

↓

Emplacement

Chaque emplacement possède un identifiant unique.

---

# Types de magasins

- Magasin central
- Magasin pédagogique
- Magasin informatique
- Magasin laboratoire
- Magasin cantine
- Magasin maintenance
- Pharmacie / Infirmerie
- Dépôt temporaire

---

# Fiche article

Chaque article comprend :

- UUID
- Code article
- Code-barres
- QR Code
- Désignation
- Description
- Catégorie
- Sous-catégorie
- Unité de mesure
- Devise
- Prix moyen
- Prix d'achat
- Prix de référence
- TVA (si applicable)
- Fournisseur principal
- Statut

---

# Types d'articles

## Consommables

Exemple :

- craies
- stylos
- papier
- encre

---

## Articles stockables

Exemple :

- ordinateurs
- imprimantes
- tables
- chaises

---

## Immobilisables

Les articles immobilisables peuvent être automatiquement transférés vers le module **Immobilisations** lors de leur mise en service.

---

# Gestion des lots

Le système permet de gérer :

- numéro de lot ;
- date de fabrication ;
- date de péremption ;
- fournisseur ;
- coût d'acquisition.

---

# Gestion des numéros de série

Pour les équipements :

- ordinateur ;
- imprimante ;
- projecteur ;
- véhicule.

Chaque numéro de série est unique.

---

# États d'un article

- Disponible
- Réservé
- En commande
- En transit
- Endommagé
- Obsolète
- Sorti du stock
- Archivé

---

# Mouvements de stock

Le système prend en charge :

## Entrée

- réception fournisseur ;
- retour interne ;
- inventaire ;
- régularisation.

---

## Sortie

- consommation ;
- distribution ;
- vente ;
- mise au rebut ;
- transfert.

---

## Transfert

Entre :

- magasins ;
- établissements ;
- services.

---

## Ajustement

Pour corriger les écarts après inventaire.

---

# Valorisation

Le moteur supporte :

- CUMP (par défaut recommandé)
- FIFO
- LIFO (optionnel selon le référentiel comptable)
- Coût spécifique

La méthode est définie au niveau de l'établissement.

---

# Réservations

Les articles peuvent être réservés pour :

- laboratoire ;
- examen ;
- événement ;
- maintenance ;
- salle informatique.

Une réservation réduit le stock disponible sans diminuer le stock physique.

---

# Inventaires

Le système gère :

## Inventaire général

Annuel ou périodique.

---

## Inventaire tournant

Par catégorie ou magasin.

---

## Inventaire exceptionnel

Après incident.

---

# Écarts d'inventaire

Le système compare :

Stock théorique

↓

Stock physique

↓

Écart

↓

Validation

↓

Régularisation

Chaque écart est historisé.

---

# Seuils

Chaque article possède :

- stock minimum ;
- stock maximum ;
- stock de sécurité ;
- quantité économique de commande (EOQ).

---

# Réapprovisionnement

Lorsque le stock atteint le seuil minimal :

Le système peut :

- générer une alerte ;
- proposer une demande d'achat ;
- préparer automatiquement un bon de commande (selon les règles de validation).

---

# Dates de péremption

Le système alerte avant :

- 90 jours ;
- 60 jours ;
- 30 jours ;
- 7 jours.

Les délais sont paramétrables.

---

# Règles métier

## RM-1100

Le stock disponible ne peut jamais être négatif, sauf autorisation explicite.

---

## RM-1101

Chaque mouvement de stock est historisé.

---

## RM-1102

Toute entrée issue d'un achat est liée à une réception fournisseur.

---

## RM-1103

Les sorties importantes peuvent nécessiter une validation hiérarchique.

---

## RM-1104

Les articles immobilisables déclenchent la création d'un actif lors de leur mise en service.

---

## RM-1105

Les inventaires validés génèrent automatiquement les écritures de régularisation.

---

# Intégration comptable

Le moteur comptable génère automatiquement :

Entrée en stock

↓

Compte de stock

↓

Compte fournisseur

---

Sortie pour consommation

↓

Compte de charge

↓

Compte de stock

---

Mise au rebut

↓

Compte de perte

↓

Compte de stock

---

# Intégration avec les achats

Commande

↓

Réception

↓

Entrée en stock

↓

Valorisation

↓

Comptabilité

---

# Intégration avec les immobilisations

Réception

↓

Stock

↓

Mise en service

↓

Immobilisation

↓

Amortissement

---

# Tableau de bord

Le Directeur visualise :

- valeur totale des stocks ;
- quantité par magasin ;
- ruptures de stock ;
- articles à faible rotation ;
- articles à forte rotation ;
- produits périmés ou proches de péremption ;
- valorisation par catégorie ;
- mouvements du jour.

---

# Alertes

Le système notifie :

- rupture de stock ;
- stock inférieur au seuil ;
- surstock ;
- péremption proche ;
- inventaire à réaliser ;
- écart important d'inventaire.

---

# BPMN simplifié

Commande

↓

Réception

↓

Entrée en stock

↓

Valorisation

↓

Distribution

↓

Consommation

↓

Inventaire

↓

Régularisation

↓

Comptabilité

---

# API principales

- Créer un article
- Modifier un article
- Enregistrer une entrée
- Enregistrer une sortie
- Effectuer un transfert
- Réserver un article
- Réaliser un inventaire
- Régulariser un écart
- Consulter le stock
- Exporter les mouvements

---

# Cas d'erreur

## Stock insuffisant

HTTP 422

---

## Article inexistant

HTTP 404

---

## Magasin fermé

HTTP 409

---

## Numéro de série déjà utilisé

HTTP 409

---

## Lot expiré

HTTP 422

---

# Tests fonctionnels

Le système devra vérifier :

✓ création d'un article ;

✓ entrée en stock ;

✓ sortie de stock ;

✓ calcul de la valorisation ;

✓ inventaire général ;

✓ inventaire tournant ;

✓ réapprovisionnement automatique ;

✓ intégration comptable ;

✓ transfert entre magasins.

---

# Indicateurs (KPI)

- Valeur totale des stocks
- Rotation des stocks
- Taux de rupture
- Taux de disponibilité
- Nombre de mouvements
- Valeur des pertes
- Valeur des articles périmés
- Délai moyen de réapprovisionnement
- Fiabilité des inventaires
- Couverture de stock (en jours)

---

# Intelligence artificielle

Le moteur IA peut :

- prévoir les consommations futures ;
- recommander les quantités optimales de réapprovisionnement ;
- détecter les anomalies de mouvements ;
- identifier les risques de rupture ;
- suggérer des transferts entre magasins ;
- anticiper les besoins saisonniers (rentrée scolaire, examens, activités pédagogiques).

Les recommandations de l'IA restent consultatives.

---

# Évolutions prévues

Le module devra intégrer :

- lecteurs de codes-barres et QR Codes ;
- terminaux mobiles d'inventaire ;
- RFID ;
- IoT pour le suivi des équipements sensibles ;
- drones d'inventaire (entrepôts de grande capacité) ;
- optimisation des emplacements par IA ;
- interfaces avec des plateformes logistiques externes.

---

# Conclusion

Le sous-module **Stocks** constitue le système de gestion des magasins d'EduWeb Planner. Grâce à une traçabilité complète des articles, des mouvements et des valorisations, il assure une gestion rigoureuse des ressources matérielles des établissements d'enseignement. Son intégration native avec les modules Achats, Comptabilité, Budgets et Immobilisations garantit une maîtrise optimale des approvisionnements et du patrimoine matériel.
