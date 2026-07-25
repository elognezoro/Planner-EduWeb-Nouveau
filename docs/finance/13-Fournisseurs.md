# Gestion des Fournisseurs
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Fournisseurs** permet de gérer le référentiel unique des partenaires commerciaux de l'établissement.

Il couvre :

- l'enregistrement des fournisseurs ;
- leur qualification ;
- leur catégorisation ;
- leur évaluation ;
- leurs contrats ;
- leurs comptes financiers ;
- leurs performances ;
- leurs documents administratifs ;
- leurs interactions avec les autres modules.

Le référentiel fournisseurs constitue une source unique de vérité (*Single Source of Truth*).

---

# Vision

Chaque fournisseur possède un dossier numérique unique.

Toutes les opérations (commandes, achats, paiements, contrats, litiges, évaluations) sont rattachées à ce dossier.

Aucun achat ne peut être réalisé auprès d'un fournisseur inexistant ou inactif.

---

# Types de fournisseurs

Le système distingue :

## Fournisseurs de biens

- fournitures scolaires
- mobilier
- informatique
- laboratoire
- bibliothèque
- équipements sportifs

---

## Prestataires de services

- nettoyage
- sécurité
- internet
- maintenance
- formation
- restauration
- transport

---

## Prestataires de travaux

- bâtiment
- plomberie
- électricité
- peinture
- génie civil

---

## Institutions publiques

- ministères
- collectivités
- établissements publics

---

## Partenaires financiers

- banques
- assurances
- établissements de monnaie électronique

---

# Fiche fournisseur

Chaque fournisseur possède :

- UUID
- Code fournisseur
- Raison sociale
- Nom commercial
- Forme juridique
- Numéro RCCM
- Numéro fiscal
- Numéro CNPS (si applicable)
- Numéro de TVA
- Adresse
- Ville
- Région
- Pays
- Téléphone
- Email
- Site web
- Contact principal
- Fonction
- Langue préférée
- Devise principale
- Statut

---

# Coordonnées bancaires

Le fournisseur peut disposer de plusieurs comptes.

Chaque compte contient :

- Banque
- Agence
- Numéro de compte
- IBAN
- SWIFT/BIC
- Mobile Money Business
- Devise

---

# Documents administratifs

Le système peut stocker :

- RCCM
- Attestation fiscale
- Attestation CNPS
- Attestation de régularité
- Agréments
- Assurances
- Pièce d'identité
- Contrats
- Catalogues
- Tarifs

Chaque document possède :

- date d'émission
- date d'expiration
- statut
- version

---

# Catégorisation

Les fournisseurs sont classés selon :

- catégorie
- secteur d'activité
- localisation
- niveau stratégique
- niveau de risque
- taille
- statut

---

# États

Un fournisseur peut être :

- Prospect
- Actif
- Suspendu
- En évaluation
- Sous surveillance
- Archivé

---

# Qualification

Avant activation, le système vérifie :

- complétude des informations ;
- validité des documents ;
- conformité réglementaire ;
- absence de doublons.

---

# Évaluation

Chaque fournisseur est évalué selon plusieurs critères.

## Qualité

- conformité
- taux de défaut

---

## Délais

- ponctualité
- respect des engagements

---

## Prix

- compétitivité
- stabilité

---

## Service

- réactivité
- disponibilité
- qualité du support

---

## Conformité

- documents valides
- conformité réglementaire

Chaque critère est noté sur une échelle paramétrable (par défaut de 1 à 5).

---

# Score global

Le système calcule automatiquement :

Score qualité

+

Score délai

+

Score prix

+

Score service

+

Score conformité

=

Score global

Le score peut être pondéré selon les besoins de l'établissement.

---

# Contrats

Chaque contrat comprend :

- référence
- objet
- date de début
- date de fin
- montant
- conditions de paiement
- pénalités
- renouvellement
- documents associés

---

# Conditions commerciales

Le système gère :

- délais de paiement
- remises
- ristournes
- escomptes
- minimum de commande
- plafonds de crédit

---

# Historique

Le dossier fournisseur conserve :

- commandes
- factures
- paiements
- retours
- contrats
- évaluations
- litiges
- communications

---

# Litiges

Le système permet d'enregistrer :

- retard de livraison
- non-conformité
- erreur de facturation
- rupture de contrat
- qualité insuffisante

Chaque litige comporte :

- description
- gravité
- responsable
- statut
- solution
- date de clôture

---

# Règles métier

## RM-1000

Chaque fournisseur possède un code unique.

---

## RM-1001

Deux fournisseurs ne peuvent partager le même numéro RCCM ou identifiant fiscal (si cette règle est activée).

---

## RM-1002

Un fournisseur suspendu ne peut plus recevoir de nouvelles commandes.

---

## RM-1003

Les documents expirés déclenchent automatiquement une alerte.

---

## RM-1004

Les évaluations alimentent le score global du fournisseur.

---

## RM-1005

Un fournisseur archivé reste consultable mais n'est plus sélectionnable dans les nouveaux processus.

---

# Intégrations

Le module communique avec :

- Achats
- Comptabilité
- Banque
- Stocks
- Immobilisations
- Budgets
- Dépenses
- Notifications
- Audit
- IA

---

# Tableau de bord

Le Directeur visualise :

- nombre de fournisseurs actifs ;
- répartition par catégorie ;
- fournisseurs stratégiques ;
- fournisseurs sous surveillance ;
- contrats arrivant à échéance ;
- documents expirant prochainement ;
- performances moyennes ;
- top 10 des fournisseurs.

---

# Alertes

Le système notifie :

- expiration d'un document ;
- fin prochaine d'un contrat ;
- baisse du score fournisseur ;
- dépassement du plafond de crédit ;
- litige non résolu ;
- inactivité prolongée.

---

# BPMN simplifié

Création du fournisseur

↓

Qualification

↓

Validation

↓

Activation

↓

Utilisation dans les achats

↓

Évaluation continue

↓

Archivage éventuel

---

# API principales

- Créer un fournisseur
- Modifier un fournisseur
- Activer un fournisseur
- Suspendre un fournisseur
- Archiver un fournisseur
- Ajouter un contrat
- Ajouter un document
- Évaluer un fournisseur
- Consulter les performances
- Rechercher un fournisseur

---

# Cas d'erreur

## Fournisseur déjà existant

HTTP 409

---

## Document obligatoire manquant

HTTP 422

---

## Contrat expiré

HTTP 409

---

## Fournisseur suspendu

HTTP 409

---

## Fournisseur archivé

HTTP 409

---

# Tests fonctionnels

Le système devra vérifier :

✓ unicité des fournisseurs ;

✓ validation des documents obligatoires ;

✓ calcul automatique du score ;

✓ blocage des fournisseurs suspendus ;

✓ génération des alertes d'expiration ;

✓ historisation complète des modifications.

---

# Indicateurs (KPI)

- Nombre de fournisseurs actifs
- Nombre de nouveaux fournisseurs
- Score moyen des fournisseurs
- Délai moyen de livraison
- Taux de conformité des livraisons
- Taux de litiges
- Taux de renouvellement des contrats
- Montant des achats par fournisseur
- Concentration des achats par fournisseur
- Délai moyen de paiement

---

# Intelligence artificielle

Le moteur IA peut :

- recommander les meilleurs fournisseurs selon les performances passées ;
- détecter les anomalies de prix ;
- identifier les risques de dépendance à un fournisseur unique ;
- prédire les retards de livraison ;
- suggérer de nouveaux fournisseurs pour diversifier les sources d'approvisionnement.

Les recommandations de l'IA restent consultatives et ne remplacent jamais les validations humaines.

---

# Évolutions prévues

Le module devra intégrer :

- un portail fournisseur sécurisé ;
- le dépôt électronique des factures ;
- la signature électronique des contrats ;
- les catalogues numériques ;
- les appels d'offres électroniques ;
- les évaluations collaboratives ;
- les API d'interconnexion avec les fournisseurs.

---

# Conclusion

Le sous-module **Fournisseurs** constitue le référentiel central des partenaires commerciaux d'EduWeb Planner. En combinant gestion documentaire, qualification, évaluation, suivi contractuel et intégration avec les processus d'achats et de comptabilité, il garantit une relation fournisseur maîtrisée, transparente et conforme aux exigences de gouvernance des établissements d'enseignement.
