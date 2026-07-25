# Module Patrimoine
## EduWeb Planner

Version : 1.0

---

# Objectif

Le module **Patrimoine** permet d'assurer la gestion complète des biens mobiliers et immobiliers d'un établissement, d'une université, d'une direction régionale ou d'une administration centrale.

Il garantit une connaissance permanente de l'état du patrimoine, de son affectation, de son utilisation, de son entretien et de son renouvellement.

Le module couvre l'ensemble du cycle de vie des actifs :

- acquisition ;
- réception ;
- affectation ;
- exploitation ;
- maintenance ;
- inventaire ;
- réforme ;
- cession.

---

# Objectifs métier

Le module doit permettre de :

- centraliser le patrimoine ;
- identifier chaque bien ;
- suivre son état ;
- gérer les affectations ;
- organiser les inventaires ;
- planifier les maintenances ;
- calculer les coûts d'exploitation ;
- suivre les garanties ;
- produire les états patrimoniaux.

---

# Catégories de patrimoine

Le système distingue notamment :

## Patrimoine immobilier

- terrains ;
- bâtiments ;
- blocs pédagogiques ;
- laboratoires ;
- ateliers ;
- bibliothèques ;
- salles multimédias ;
- amphithéâtres ;
- internats ;
- cantines ;
- bureaux ;
- magasins ;
- parkings.

---

## Patrimoine mobilier

- bureaux ;
- chaises ;
- armoires ;
- tables ;
- rayonnages ;
- tableaux ;
- climatiseurs ;
- ventilateurs.

---

## Matériel informatique

- ordinateurs ;
- serveurs ;
- imprimantes ;
- vidéoprojecteurs ;
- tablettes ;
- écrans interactifs ;
- équipements réseau.

---

## Matériel pédagogique

- microscopes ;
- balances ;
- oscilloscopes ;
- kits pédagogiques ;
- maquettes ;
- matériels scientifiques.

---

## Véhicules

- voitures ;
- motos ;
- minibus ;
- camions.

---

## Équipements techniques

- groupes électrogènes ;
- panneaux solaires ;
- onduleurs ;
- transformateurs ;
- pompes ;
- systèmes de vidéosurveillance.

---

# Fiche patrimoine

Chaque bien possède une fiche unique.

## Identification

- numéro d'inventaire ;
- code-barres ;
- QR Code ;
- RFID (optionnel) ;
- désignation ;
- catégorie ;
- sous-catégorie ;
- marque ;
- modèle ;
- numéro de série.

---

## Informations financières

- fournisseur ;
- date d'acquisition ;
- coût d'acquisition ;
- devise ;
- mode d'acquisition ;
- durée d'amortissement ;
- valeur comptable ;
- valeur résiduelle.

---

## Localisation

Chaque bien est localisé précisément :

- établissement ;
- bâtiment ;
- étage ;
- salle ;
- bureau ;
- magasin.

Historique conservé.

---

# Affectation

Un bien peut être affecté :

- à un agent ;
- à un service ;
- à une salle ;
- à un laboratoire ;
- à une classe ;
- à un véhicule.

Chaque affectation comporte :

- date début ;
- date fin ;
- responsable ;
- décision.

---

# États du patrimoine

Le système gère les états :

- neuf ;
- en service ;
- en maintenance ;
- en réparation ;
- hors service ;
- réformé ;
- cédé ;
- détruit ;
- perdu.

---

# Maintenance

Deux types de maintenance :

## Préventive

Planifiée automatiquement.

Exemples :

- entretien climatiseur ;
- vidange véhicule ;
- calibration laboratoire ;
- nettoyage serveur.

---

## Corrective

Suite à une panne.

Workflow :

Signalement

↓

Diagnostic

↓

Intervention

↓

Validation

↓

Clôture

---

# Incidents

Chaque incident comporte :

- date ;
- déclarant ;
- bien concerné ;
- description ;
- urgence ;
- photos ;
- coût estimé ;
- décision.

---

# Garanties

Le système suit :

- fournisseur ;
- garantie ;
- durée ;
- date d'expiration ;
- contrat SAV.

Alertes automatiques avant expiration.

---

# Inventaires

Inventaires possibles :

- annuel ;
- semestriel ;
- ponctuel ;
- tournant.

Méthodes :

- QR Code ;
- RFID ;
- Code-barres ;
- saisie manuelle.

Résultats :

- conforme ;
- manquant ;
- déplacé ;
- détérioré.

---

# Réforme

La réforme suit le processus :

Proposition

↓

Commission

↓

Décision

↓

Sortie d'inventaire

↓

Archivage

---

# Cession

Le système gère :

- vente ;
- don ;
- transfert ;
- destruction.

Historique obligatoire.

---

# Réservations

Les équipements peuvent être réservés :

- salle multimédia ;
- laboratoire ;
- véhicule ;
- vidéoprojecteur ;
- salle de conférence.

Intégration avec **EduWeb Booking**.

---

# Consommation énergétique

Pour certains équipements :

- électricité ;
- carburant ;
- eau.

Production de statistiques.

---

# Assurance

Le système suit :

- compagnie ;
- police ;
- échéance ;
- sinistres.

---

# Documents

Chaque bien peut comporter :

- facture ;
- bon de livraison ;
- garantie ;
- manuel utilisateur ;
- certificat ;
- photos ;
- rapports d'intervention.

---

# Intégration avec les autres modules

## Achats

Création automatique des biens après réception.

---

## Immobilisations

Calcul des amortissements.

---

## Comptabilité

Valeurs patrimoniales.

---

## Budgets

Prévision des renouvellements.

---

## Stocks

Gestion des pièces détachées.

---

## Ressources Humaines

Historique des affectations aux agents.

---

## Notifications

Maintenance programmée.

Garantie arrivant à expiration.

Inventaire à réaliser.

---

## Intelligence Artificielle

Le copilote IA peut :

- prévoir les pannes ;
- estimer la durée de vie restante ;
- proposer le remplacement optimal ;
- détecter les anomalies d'utilisation ;
- calculer le coût total de possession (TCO).

---

# Recherche

Recherche multicritère :

- numéro d'inventaire ;
- QR Code ;
- salle ;
- bâtiment ;
- responsable ;
- fournisseur ;
- catégorie ;
- état ;
- année.

---

# API

Exemples :

GET /assets

GET /assets/{id}

POST /assets

PUT /assets/{id}

DELETE /assets/{id}

GET /assets/{id}/maintenance

GET /assets/{id}/history

GET /assets/{id}/documents

---

# Règles métier

## RM-2300

Chaque bien possède un identifiant patrimonial unique.

---

## RM-2301

Toute affectation est historisée.

---

## RM-2302

Une maintenance clôturée met automatiquement à jour l'état du bien.

---

## RM-2303

Un bien réformé ou cédé ne peut plus être affecté.

---

## RM-2304

Chaque inventaire produit un procès-verbal numérique.

---

## RM-2305

Toute sortie définitive du patrimoine doit être autorisée par une décision administrative.

---

# Tests

Le système devra vérifier :

✓ création d'un bien ;

✓ affectation ;

✓ changement d'état ;

✓ maintenance ;

✓ inventaire ;

✓ réforme ;

✓ cession ;

✓ génération des rapports patrimoniaux.

---

# KPI

- Valeur totale du patrimoine
- Nombre de biens
- Taux de disponibilité
- Taux de panne
- Coût annuel de maintenance
- Nombre d'interventions
- Taux de conformité des inventaires
- Valeur des biens réformés
- Durée moyenne d'immobilisation
- Coût total de possession (TCO)

---

# Évolutions prévues

Le module pourra intégrer :

- cartographie SIG des bâtiments ;
- jumeau numérique (Digital Twin) des infrastructures ;
- capteurs IoT pour le suivi en temps réel ;
- maintenance prédictive avancée par IA ;
- drones pour les inspections de grands sites ;
- suivi énergétique intelligent.

---

# Conclusion

Le module **Patrimoine** constitue le référentiel central des biens matériels et immobiliers d'EduWeb Planner. Il garantit une gestion rigoureuse, traçable et optimisée des actifs tout au long de leur cycle de vie, tout en facilitant la maintenance, les inventaires, les décisions d'investissement et la valorisation du patrimoine.
