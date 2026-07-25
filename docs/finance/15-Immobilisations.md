# Gestion des Immobilisations et du Patrimoine
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Immobilisations** permet de gérer l'ensemble des actifs durables de l'établissement, depuis leur acquisition jusqu'à leur sortie du patrimoine.

Il couvre :

- l'acquisition des actifs ;
- la mise en service ;
- les affectations ;
- les localisations ;
- les amortissements ;
- les réévaluations ;
- les transferts ;
- la maintenance ;
- les inventaires physiques ;
- les sorties d'actifs ;
- les écritures comptables automatiques.

---

# Vision

Chaque immobilisation possède un **passeport numérique** retraçant toute son histoire :

- origine ;
- financement ;
- localisation ;
- utilisateur ;
- maintenance ;
- amortissements ;
- incidents ;
- valeur comptable ;
- sortie.

Le patrimoine de l'établissement est connu en temps réel.

---

# Catégories d'immobilisations

Le système gère notamment :

## Immobilisations incorporelles

- licences logicielles
- brevets
- marques
- abonnements pluriannuels
- droits d'utilisation

---

## Immobilisations corporelles

- terrains
- bâtiments
- salles spécialisées
- mobilier
- véhicules
- équipements informatiques
- matériels pédagogiques
- équipements sportifs
- laboratoires
- groupes électrogènes
- panneaux solaires

---

## Immobilisations en cours

- bâtiments en construction
- équipements en installation
- projets d'investissement

---

# Fiche immobilisation

Chaque actif possède :

- UUID
- Code patrimoine
- Code-barres
- QR Code
- Désignation
- Description
- Catégorie
- Sous-catégorie
- Numéro de série
- Date d'acquisition
- Date de mise en service
- Fournisseur
- Facture d'origine
- Coût d'acquisition
- Devise
- Mode de financement
- Garantie
- Durée d'utilisation prévue
- Valeur résiduelle
- Statut

---

# États d'une immobilisation

- En acquisition
- En installation
- En service
- En maintenance
- Hors service
- En cession
- Réformée
- Détruite
- Archivée

---

# Localisation

Chaque immobilisation est localisée selon une hiérarchie :

Établissement

↓

Site

↓

Bâtiment

↓

Niveau

↓

Salle

↓

Zone

↓

Emplacement

Tout changement de localisation est historisé.

---

# Affectation

Une immobilisation peut être affectée à :

- un service ;
- un enseignant ;
- un agent ;
- un laboratoire ;
- une salle ;
- un projet.

Les affectations sont historisées.

---

# Modes d'acquisition

Le système gère :

- achat ;
- don ;
- subvention ;
- transfert ;
- production interne ;
- crédit-bail (leasing).

---

# Amortissements

Méthodes supportées :

- linéaire (par défaut)
- dégressif
- unités d'œuvre
- personnalisé

Les paramètres sont définis selon le référentiel comptable applicable.

---

# Plan d'amortissement

Pour chaque actif :

- valeur brute ;
- valeur résiduelle ;
- base amortissable ;
- durée ;
- taux ;
- amortissement annuel ;
- amortissement cumulé ;
- valeur nette comptable (VNC).

Le plan est généré automatiquement.

---

# Réévaluation

Le système permet :

- augmentation de valeur ;
- diminution de valeur ;
- justification ;
- historique des opérations.

Les écritures comptables correspondantes sont générées automatiquement.

---

# Maintenance

Le module enregistre :

## Maintenance préventive

- calendrier
- fréquence
- prestataire
- coût prévu

---

## Maintenance corrective

- incident
- intervention
- coût réel
- durée d'immobilisation

Chaque intervention est historisée.

---

# Garanties

Pour chaque actif :

- durée
- fournisseur
- échéance
- conditions

Le système alerte avant expiration.

---

# Inventaire physique

Le système permet :

- inventaire annuel ;
- inventaire tournant ;
- inventaire par localisation ;
- inventaire par responsable.

Les QR Codes ou codes-barres peuvent être utilisés pour accélérer les opérations.

---

# Transfert

Une immobilisation peut être transférée :

- entre services ;
- entre bâtiments ;
- entre établissements.

Le transfert conserve tout l'historique de l'actif.

---

# Sorties d'actifs

Le système gère :

- vente ;
- réforme ;
- destruction ;
- perte ;
- vol ;
- don.

Chaque sortie nécessite :

- un motif ;
- une validation ;
- une pièce justificative.

---

# Règles métier

## RM-1200

Chaque immobilisation possède un identifiant patrimonial unique.

---

## RM-1201

Une immobilisation ne peut être amortie avant sa mise en service.

---

## RM-1202

Les amortissements sont calculés automatiquement selon le calendrier défini.

---

## RM-1203

Toute sortie d'actif génère une écriture comptable.

---

## RM-1204

Les transferts conservent l'historique complet de l'immobilisation.

---

## RM-1205

Les immobilisations issues des stocks conservent la référence du mouvement d'origine.

---

# Intégration comptable

Le moteur génère automatiquement :

## Acquisition

Débit

↓

Compte d'immobilisation

Crédit

↓

Compte fournisseur

---

## Amortissement

Débit

↓

Dotation aux amortissements

Crédit

↓

Amortissements cumulés

---

## Sortie

Débit

↓

Amortissements cumulés

↓

Valeur comptable des actifs cédés (ou compte de perte)

Crédit

↓

Compte d'immobilisation

Le traitement des plus-values ou moins-values est réalisé selon les règles comptables paramétrées.

---

# Intégration avec les stocks

Article immobilisable

↓

Entrée en stock

↓

Mise en service

↓

Création automatique de l'immobilisation

↓

Début des amortissements

---

# Intégration avec les achats

Commande

↓

Réception

↓

Facture

↓

Création de l'immobilisation

↓

Comptabilité

---

# Tableau de bord

Le Directeur visualise :

- valeur brute du patrimoine ;
- valeur nette comptable ;
- amortissements cumulés ;
- actifs par catégorie ;
- actifs par établissement ;
- garanties arrivant à échéance ;
- actifs en maintenance ;
- actifs hors service.

---

# Alertes

Le système notifie :

- garantie proche de l'expiration ;
- maintenance préventive à réaliser ;
- amortissement terminé ;
- actif non localisé ;
- inventaire à effectuer ;
- anomalie détectée lors d'un inventaire.

---

# BPMN simplifié

Acquisition

↓

Réception

↓

Mise en service

↓

Affectation

↓

Utilisation

↓

Maintenance

↓

Amortissement

↓

Inventaire

↓

Transfert (si nécessaire)

↓

Sortie

↓

Archivage

---

# API principales

- Créer une immobilisation
- Mettre en service un actif
- Affecter une immobilisation
- Modifier une localisation
- Planifier une maintenance
- Enregistrer une intervention
- Calculer les amortissements
- Réévaluer un actif
- Sortir une immobilisation
- Réaliser un inventaire patrimonial

---

# Cas d'erreur

## Immobilisation inexistante

HTTP 404

---

## Actif déjà sorti

HTTP 409

---

## Mise en service impossible

HTTP 422

---

## Localisation invalide

HTTP 422

---

## Amortissement sur actif non mis en service

HTTP 409

---

# Tests fonctionnels

Le système devra vérifier :

✓ création d'une immobilisation ;

✓ génération automatique du plan d'amortissement ;

✓ calcul correct des amortissements ;

✓ affectation et transfert ;

✓ maintenance préventive et corrective ;

✓ sortie d'actif ;

✓ inventaire patrimonial ;

✓ intégration comptable.

---

# Indicateurs (KPI)

- Valeur brute du patrimoine
- Valeur nette comptable
- Amortissements cumulés
- Nombre d'actifs
- Taux d'utilisation des équipements
- Taux de disponibilité
- Coût annuel de maintenance
- Valeur des actifs réformés
- Durée moyenne de vie des équipements
- Taux de couverture des inventaires

---

# Intelligence artificielle

Le moteur IA peut :

- prédire les pannes à partir de l'historique des interventions ;
- recommander les périodes optimales de maintenance ;
- estimer la durée de vie résiduelle d'un actif ;
- détecter des actifs sous-utilisés ou sursollicités ;
- proposer le remplacement d'équipements devenus coûteux à maintenir.

Les recommandations de l'IA ne remplacent jamais les validations humaines.

---

# Évolutions prévues

Le module devra intégrer :

- RFID pour le suivi des actifs ;
- capteurs IoT pour les équipements critiques ;
- géolocalisation des véhicules ;
- carnet numérique de maintenance ;
- jumeau numérique (Digital Twin) des bâtiments et équipements stratégiques ;
- interconnexion avec les systèmes de GMAO (Gestion de Maintenance Assistée par Ordinateur).

---

# Conclusion

Le sous-module **Immobilisations** constitue le système de gestion patrimoniale d'EduWeb Planner. Il assure le suivi complet des actifs, depuis leur acquisition jusqu'à leur sortie, tout en garantissant la conformité comptable, la traçabilité des mouvements et l'optimisation de la gestion des équipements au service des établissements d'enseignement.
