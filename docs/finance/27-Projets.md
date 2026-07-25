# Module Gestion des Projets, Programmes et Plans d'Action
## EduWeb Planner

Version : 1.0

---

# Objectif

Le module **Projets** permet de planifier, organiser, exécuter, suivre et évaluer les projets institutionnels, les programmes, les plans stratégiques et les plans d'action d'un établissement, d'une université, d'une direction régionale ou d'une administration centrale.

Il constitue un véritable **Project Management Office (PMO)** intégré à EduWeb Planner.

Le module couvre :

- les projets ;
- les programmes ;
- les plans d'action ;
- les activités ;
- les tâches ;
- les livrables ;
- les indicateurs ;
- les budgets ;
- les risques ;
- les calendriers ;
- les ressources ;
- les partenaires.

---

# Objectifs métier

Le module permet de :

- planifier les activités institutionnelles ;
- suivre l'avancement des projets ;
- maîtriser les délais ;
- suivre les budgets ;
- gérer les risques ;
- coordonner les équipes ;
- produire les rapports d'exécution ;
- faciliter le pilotage stratégique.

---

# Types de projets

Le système prend en charge notamment :

## Projets institutionnels

- Projet d'établissement ;
- Projet académique ;
- Projet pédagogique ;
- Projet numérique.

---

## Programmes

- Programme ministériel ;
- Programme régional ;
- Programme de coopération ;
- Programme de recherche.

---

## Plans d'action

- annuel ;
- trimestriel ;
- mensuel ;
- opérationnel.

---

## Projets financés

- État ;
- collectivités ;
- partenaires techniques et financiers ;
- ONG ;
- fondations ;
- secteur privé.

---

# Structure

Hiérarchie :

```
Programme

↓

Projet

↓

Composante

↓

Activité

↓

Tâche

↓

Livrable
```

---

# Fiche Projet

Chaque projet comprend :

## Identification

- code ;
- titre ;
- description ;
- type ;
- domaine ;
- priorité.

---

## Pilotage

- responsable ;
- sponsor ;
- comité de pilotage ;
- équipe projet.

---

## Planification

- date de début ;
- date de fin ;
- durée ;
- jalons.

---

## Financement

- budget prévisionnel ;
- budget consommé ;
- source de financement ;
- devise.

---

## État

- préparation ;
- en cours ;
- suspendu ;
- terminé ;
- annulé.

---

# Activités

Chaque activité comprend :

- responsable ;
- échéance ;
- durée ;
- dépendances ;
- coût estimé ;
- coût réel ;
- taux d'avancement.

---

# Tâches

Les tâches peuvent être :

- individuelles ;
- collaboratives ;
- récurrentes ;
- automatiques.

Chaque tâche possède :

- priorité ;
- responsable ;
- date limite ;
- statut ;
- commentaires ;
- pièces jointes.

---

# Jalons

Le système gère les jalons importants.

Exemples :

- lancement ;
- validation ;
- livraison ;
- clôture.

Chaque jalon peut déclencher :

- une notification ;
- une validation ;
- un rapport.

---

# Calendrier

Le module propose :

- vue calendrier ;
- diagramme de Gantt ;
- chronologie ;
- vue Kanban ;
- vue liste.

---

# Gestion des ressources

Le projet peut mobiliser :

- personnel ;
- salles ;
- équipements ;
- véhicules ;
- budget ;
- documentation.

Les disponibilités sont vérifiées automatiquement.

---

# Budget

Le suivi budgétaire comprend :

- prévision ;
- engagements ;
- dépenses ;
- reste à engager ;
- reste disponible.

Connexion directe avec les modules :

- Budgets ;
- Dépenses ;
- Comptabilité.

---

# Gestion des risques

Chaque risque possède :

- description ;
- probabilité ;
- impact ;
- criticité ;
- responsable ;
- plan d'atténuation ;
- statut.

---

# Gestion des incidents

Les incidents sont historisés.

Exemples :

- retard ;
- dépassement budgétaire ;
- indisponibilité d'une ressource ;
- changement réglementaire.

---

# Livrables

Chaque livrable comporte :

- type ;
- version ;
- responsable ;
- échéance ;
- statut ;
- validation ;
- documents associés.

---

# Validation

Workflow :

Production

↓

Contrôle

↓

Validation

↓

Diffusion

↓

Archivage

---

# Indicateurs

Le projet suit notamment :

- avancement physique ;
- avancement financier ;
- consommation budgétaire ;
- délais ;
- qualité ;
- risques ;
- satisfaction.

---

# Réunions

Le module permet de gérer :

- réunions d'équipe ;
- COPIL ;
- COTECH ;
- comptes rendus ;
- décisions.

Intégration avec le module **Réunions**.

---

# Gestion documentaire

Association des documents :

- cahier des charges ;
- contrats ;
- rapports ;
- PV ;
- photos ;
- livrables.

Connexion directe avec le module **Archives**.

---

# Notifications

Notifications automatiques :

- nouvelle tâche ;
- retard ;
- validation attendue ;
- échéance ;
- dépassement budgétaire ;
- risque critique.

---

# Tableau de bord

Le tableau de bord présente :

- nombre de projets ;
- projets en retard ;
- taux d'avancement ;
- budget consommé ;
- livrables produits ;
- risques critiques ;
- échéances à venir.

---

# Intégration avec les autres modules

## Ressources Humaines

Mobilisation des équipes.

---

## Budgets

Suivi financier.

---

## Dépenses

Exécution financière.

---

## Patrimoine

Mobilisation des équipements.

---

## Courrier

Correspondances du projet.

---

## Archives

Archivage des livrables.

---

## Réunions

Suivi des COPIL.

---

## Intelligence Artificielle

Le copilote IA peut :

- proposer un calendrier optimal ;
- estimer les délais ;
- détecter les risques ;
- prédire les dépassements budgétaires ;
- générer les rapports d'avancement ;
- proposer des mesures correctives ;
- produire automatiquement les comptes rendus de réunion.

---

# API

Exemples :

GET /projects

GET /projects/{id}

POST /projects

PUT /projects/{id}

DELETE /projects/{id}

GET /projects/{id}/activities

POST /projects/{id}/tasks

GET /projects/{id}/dashboard

---

# Règles métier

## RM-2700

Chaque projet possède un identifiant unique.

---

## RM-2701

Une activité ne peut appartenir qu'à un seul projet.

---

## RM-2702

Tout changement d'état est historisé.

---

## RM-2703

Un projet clôturé devient accessible uniquement en consultation, sauf réouverture autorisée.

---

## RM-2704

Les dépassements budgétaires déclenchent une alerte selon les seuils configurés.

---

## RM-2705

La clôture d'un projet nécessite la validation de tous les livrables obligatoires.

---

# Tests

Le système devra vérifier :

✓ création d'un projet ;

✓ planification ;

✓ diagramme de Gantt ;

✓ gestion des tâches ;

✓ suivi budgétaire ;

✓ gestion des risques ;

✓ production des livrables ;

✓ clôture du projet.

---

# KPI

- Nombre de projets
- Taux d'avancement moyen
- Taux de réussite
- Taux de projets livrés dans les délais
- Consommation budgétaire
- Nombre de risques critiques
- Nombre de livrables validés
- Délai moyen de réalisation
- Taux de satisfaction des parties prenantes
- Valeur des projets en portefeuille

---

# Évolutions prévues

Le module pourra intégrer :

- gestion de portefeuille de projets (PPM) ;
- analyse de la valeur acquise (Earned Value Management) ;
- simulation de scénarios ;
- optimisation automatique des ressources par IA ;
- synchronisation avec Microsoft Project, Primavera et OpenProject ;
- tableaux de bord décisionnels en temps réel.

---

# Conclusion

Le module **Projets** offre une plateforme complète de pilotage des projets, programmes et plans d'action institutionnels. Il favorise une gouvernance orientée résultats, améliore la coordination des équipes, sécurise l'exécution des budgets et fournit aux décideurs une vision claire de l'avancement des initiatives stratégiques de l'organisation.
