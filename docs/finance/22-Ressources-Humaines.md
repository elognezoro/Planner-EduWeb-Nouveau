# Module Ressources Humaines
## EduWeb Planner

Version : 1.0

---

# Objectif

Le module **Ressources Humaines (RH)** permet d'assurer la gestion complète du personnel d'un établissement scolaire, d'une université, d'une direction régionale ou d'une administration centrale.

Il couvre l'ensemble du cycle de vie d'un agent :

- recrutement ;
- prise de fonction ;
- affectation ;
- évolution de carrière ;
- formation ;
- évaluation ;
- mobilité ;
- absences ;
- départ.

Le module est conçu pour fonctionner aussi bien dans un établissement unique que dans un déploiement multi-établissements et multi-pays.

---

# Objectifs métier

Le module doit permettre de :

- centraliser les informations du personnel ;
- gérer les postes et fonctions ;
- suivre les carrières ;
- gérer les affectations ;
- suivre les absences ;
- planifier les formations ;
- gérer les évaluations ;
- produire les statistiques RH ;
- faciliter les décisions administratives.

---

# Personnels concernés

Le système doit gérer notamment :

- enseignants ;
- directeurs ;
- proviseurs ;
- censeurs ;
- économes ;
- gestionnaires ;
- comptables ;
- secrétaires ;
- inspecteurs ;
- conseillers pédagogiques ;
- surveillants ;
- documentalistes ;
- informaticiens ;
- techniciens ;
- agents administratifs ;
- agents contractuels ;
- vacataires ;
- consultants.

---

# Dossier du personnel

Chaque agent possède un dossier numérique unique.

## Informations générales

- matricule ;
- nom ;
- prénoms ;
- sexe ;
- date de naissance ;
- lieu de naissance ;
- nationalité ;
- photo ;
- état civil ;
- numéro d'identification nationale ;
- contacts ;
- adresse.

---

## Informations administratives

- statut ;
- catégorie ;
- grade ;
- corps ;
- emploi ;
- fonction ;
- ministère de rattachement ;
- établissement ;
- service ;
- date de prise de service ;
- ancienneté.

---

## Informations professionnelles

- diplômes ;
- spécialités ;
- certifications ;
- compétences ;
- langues ;
- expériences ;
- publications ;
- distinctions.

---

## Documents

Le dossier peut contenir :

- acte de naissance ;
- diplôme ;
- décision de nomination ;
- arrêté ;
- contrat ;
- lettre de mission ;
- CV ;
- pièce d'identité ;
- certificat médical ;
- autres pièces.

---

# Organigramme

Le système doit gérer :

- directions ;
- sous-directions ;
- services ;
- divisions ;
- cellules ;
- unités.

Chaque agent est rattaché à une unité.

---

# Fonctions

Exemples :

- Directeur Général
- Directeur
- Sous-directeur
- Chef de service
- Coordonnateur
- Proviseur
- Principal
- Censeur
- Économe
- Gestionnaire
- Enseignant
- Agent administratif

---

# Affectations

Le système gère :

- affectation initiale ;
- mutation ;
- permutation ;
- intérim ;
- remplacement ;
- détachement ;
- disponibilité.

Chaque affectation possède :

- date début ;
- date fin ;
- motif ;
- décision.

---

# Contrats

Types :

- titulaire ;
- contractuel ;
- vacataire ;
- consultant ;
- temporaire.

Chaque contrat contient :

- durée ;
- quotité ;
- conditions ;
- renouvellement.

---

# Carrière

Historisation complète :

- nominations ;
- promotions ;
- avancements ;
- changements de grade ;
- distinctions ;
- sanctions.

---

# Congés

Types :

- congé annuel ;
- congé maladie ;
- congé maternité ;
- congé paternité ;
- congé exceptionnel ;
- autorisation d'absence ;
- permission.

Workflow :

Demande

↓

Validation

↓

Notification

↓

Historisation

---

# Présence

Le module peut enregistrer :

- présence ;
- retard ;
- absence ;
- justification ;
- mission.

Les données peuvent provenir :

- saisie manuelle ;
- badgeuse ;
- biométrie ;
- application mobile.

---

# Évaluations

Le système gère :

- évaluation annuelle ;
- évaluation pédagogique ;
- entretien professionnel ;
- auto-évaluation.

Critères :

- ponctualité ;
- rendement ;
- compétences ;
- leadership ;
- innovation ;
- travail d'équipe.

---

# Formation

Le module suit :

- besoins ;
- inscriptions ;
- sessions ;
- certificats ;
- évaluations ;
- compétences acquises.

Une formation peut être :

- présentielle ;
- distancielle ;
- hybride.

---

# Compétences

Le système maintient un référentiel :

- pédagogiques ;
- administratives ;
- numériques ;
- linguistiques ;
- techniques.

Chaque compétence possède :

- niveau ;
- date d'acquisition ;
- justificatif.

---

# Santé et sécurité

Le dossier peut enregistrer :

- aptitude médicale ;
- visites médicales ;
- accidents de travail ;
- équipements de protection.

---

# Discipline

Le système historise :

- avertissements ;
- blâmes ;
- sanctions ;
- recours ;
- décisions.

---

# Mobilité

Le système suit :

- mutations ;
- promotions ;
- changements d'établissement ;
- changements de fonction.

---

# Fin de carrière

Le système gère :

- retraite ;
- démission ;
- décès ;
- licenciement ;
- fin de contrat.

---

# Tableaux de bord

Le module produit notamment :

- effectif total ;
- répartition par sexe ;
- pyramide des âges ;
- ancienneté ;
- catégories ;
- grades ;
- répartition géographique ;
- taux d'absentéisme ;
- taux de formation ;
- taux de mobilité.

---

# Intégration avec les autres modules

Le module RH échange avec :

## Gouvernance

Décisions de nomination.

---

## Comptabilité

Charges salariales (si activées).

---

## Budgets

Prévision des effectifs.

---

## Emplois du temps

Affectation des enseignants.

---

## Patrimoine

Matériel attribué aux agents.

---

## Notifications

Information des personnels.

---

## IA

Le copilote RH peut :

- détecter les risques de départ ;
- proposer des plans de formation ;
- identifier les besoins en recrutement ;
- analyser les compétences disponibles ;
- suggérer des mobilités internes.

---

# Recherche

Recherche multicritère :

- nom ;
- matricule ;
- établissement ;
- fonction ;
- diplôme ;
- compétence ;
- ancienneté ;
- statut ;
- service.

---

# Sécurité

Accès limités selon les rôles.

Les informations médicales et disciplinaires bénéficient d'une protection renforcée.

---

# API

Exemples :

GET /employees

GET /employees/{id}

POST /employees

PUT /employees/{id}

DELETE /employees/{id}

GET /employees/{id}/career

GET /employees/{id}/training

GET /employees/{id}/leave

---

# Règles métier

## RM-2200

Chaque agent possède un matricule unique.

---

## RM-2201

Une affectation ne peut appartenir qu'à un seul établissement actif à une date donnée, sauf cas explicitement prévus (mission, détachement, multi-affectation autorisée).

---

## RM-2202

Toute nomination est historisée.

---

## RM-2203

Toute modification du dossier est auditée.

---

## RM-2204

Les congés ne peuvent être validés que par une autorité habilitée.

---

## RM-2205

Le départ d'un agent déclenche automatiquement les procédures de restitution des biens, de clôture des accès et d'archivage du dossier.

---

# Tests

Le système devra vérifier :

✓ création d'un agent ;

✓ changement d'affectation ;

✓ gestion des congés ;

✓ historique de carrière ;

✓ formations ;

✓ évaluations ;

✓ sécurité des accès ;

✓ génération des statistiques.

---

# KPI

- Nombre d'agents
- Taux d'encadrement
- Taux d'absentéisme
- Ancienneté moyenne
- Nombre de formations
- Taux de mobilité
- Nombre d'évaluations réalisées
- Répartition par catégorie
- Répartition par grade

---

# Évolutions prévues

Le module pourra intégrer :

- gestion complète de la paie ;
- signature électronique des contrats ;
- portail self-service du personnel ;
- gestion prévisionnelle des emplois et compétences (GPEC) ;
- planification intelligente des formations par IA ;
- synchronisation avec les systèmes nationaux de gestion des ressources humaines.

---

# Conclusion

Le module Ressources Humaines constitue le référentiel central de gestion des personnels d'EduWeb Planner. Il assure une vision complète, historisée et sécurisée des ressources humaines, facilite les décisions administratives et favorise une gestion moderne des carrières, des compétences et des organisations.
