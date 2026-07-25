# Moteur de Rapports Financiers
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Rapports** permet de produire automatiquement l'ensemble des rapports financiers, comptables, budgétaires et analytiques de l'établissement.

Il couvre :

- les rapports réglementaires ;
- les rapports comptables ;
- les rapports budgétaires ;
- les rapports de trésorerie ;
- les rapports analytiques ;
- les rapports statistiques ;
- les rapports consolidés ;
- les rapports prédictifs alimentés par l'intelligence artificielle.

---

# Vision

Chaque donnée enregistrée dans EduWeb Planner doit pouvoir être exploitée sous forme de rapport fiable, cohérent et exploitable.

Le moteur produit des rapports :

- interactifs ;
- exportables ;
- planifiables ;
- comparatifs ;
- consolidés ;
- personnalisables.

---

# Principes

Le moteur repose sur :

- une source de données unique (Single Source of Truth) ;
- des modèles normalisés ;
- une génération dynamique ;
- des filtres paramétrables ;
- une traçabilité complète.

---

# Catégories de rapports

Le système distingue :

## Rapports financiers

- situation financière
- recettes
- dépenses
- trésorerie
- exécution budgétaire

---

## Rapports comptables

- Grand Livre
- Balance
- Journaux
- Bilan
- Compte de résultat
- Balance âgée
- Balance auxiliaire

---

## Rapports budgétaires

- budget voté
- budget engagé
- budget consommé
- budget disponible
- exécution budgétaire
- écarts budgétaires

---

## Rapports de trésorerie

- caisse
- banque
- flux de trésorerie
- rapprochements bancaires
- soldes

---

## Rapports de facturation

- factures émises
- factures payées
- factures impayées
- créances
- remises
- avoirs

---

## Rapports fournisseurs

- achats par fournisseur
- paiements
- délais moyens
- performance
- litiges

---

## Rapports de stocks

- inventaire
- valorisation
- mouvements
- ruptures
- surstocks
- produits périmés

---

## Rapports patrimoniaux

- immobilisations
- amortissements
- garanties
- maintenance
- inventaires physiques

---

## Rapports pédagogiques liés à la finance

- recettes par filière
- recettes par niveau
- frais de scolarité
- bourses
- exonérations

---

# Rapports analytiques

Le moteur permet des analyses par :

- établissement ;
- campus ;
- service ;
- département ;
- projet ;
- centre de coût ;
- exercice ;
- période ;
- utilisateur ;
- fournisseur.

---

# Consolidation

Le système peut produire :

- rapports par établissement ;
- rapports régionaux ;
- rapports nationaux ;
- rapports multi-campus ;
- rapports multi-pays.

---

# Paramètres des rapports

Chaque rapport peut être filtré selon :

- exercice ;
- période ;
- établissement ;
- devise ;
- projet ;
- compte comptable ;
- catégorie ;
- statut ;
- utilisateur.

---

# Formats d'export

Le moteur génère :

- PDF
- Excel (XLSX)
- CSV
- Word
- JSON
- XML

Les exports respectent les droits de l'utilisateur.

---

# Impression

Le système permet :

- impression A4 ;
- impression A3 ;
- orientation portrait ;
- orientation paysage ;
- pagination automatique ;
- en-tête institutionnel ;
- QR Code d'authenticité ;
- signature électronique.

---

# Rapports programmés

Les utilisateurs autorisés peuvent planifier :

- quotidien ;
- hebdomadaire ;
- mensuel ;
- trimestriel ;
- annuel.

Les rapports peuvent être envoyés automatiquement par courrier électronique ou déposés dans un espace documentaire sécurisé.

---

# Rapports comparatifs

Le moteur peut comparer :

- N vs N-1 ;
- budget vs réalisé ;
- établissement A vs établissement B ;
- projet A vs projet B ;
- période A vs période B.

---

# Visualisations

Les rapports peuvent intégrer :

- tableaux ;
- graphiques en barres ;
- graphiques en courbes ;
- graphiques circulaires ;
- histogrammes ;
- cartes thermiques (Heat Maps) ;
- diagrammes de Pareto ;
- indicateurs de performance (Gauge).

---

# Générateur de rapports

Le système permet aux utilisateurs habilités de créer leurs propres rapports.

Ils peuvent sélectionner :

- les sources de données ;
- les colonnes ;
- les regroupements ;
- les tris ;
- les filtres ;
- les calculs ;
- les graphiques.

Les modèles peuvent être enregistrés et partagés.

---

# Catalogue de rapports

Chaque rapport possède :

- UUID ;
- code ;
- nom ;
- catégorie ;
- auteur ;
- date de création ;
- version ;
- statut ;
- droits d'accès.

---

# Historique

Le système conserve :

- les générations ;
- les téléchargements ;
- les impressions ;
- les modifications des modèles.

---

# Sécurité

Chaque rapport applique automatiquement :

- les rôles ;
- les permissions ;
- les restrictions multi-établissements ;
- les restrictions par service ;
- le masquage des données sensibles.

---

# Règles métier

## RM-1500

Un utilisateur ne peut consulter que les rapports autorisés par son profil.

---

## RM-1501

Chaque rapport généré est historisé.

---

## RM-1502

Les exports respectent les droits d'accès.

---

## RM-1503

Les rapports réglementaires sont figés après clôture comptable.

---

## RM-1504

Les rapports programmés utilisent toujours les données validées.

---

## RM-1505

Les modèles personnalisés sont versionnés.

---

# Intégrations

Le moteur exploite les données de :

- Scolarité
- Facturation
- Encaissements
- Caisse
- Banque
- Comptabilité
- Achats
- Fournisseurs
- Stocks
- Immobilisations
- Budgets
- Dépenses
- Ressources Humaines
- Gouvernance

---

# Tableau de bord d'administration

L'administrateur visualise :

- rapports les plus utilisés ;
- temps moyen de génération ;
- volume des exports ;
- espace disque utilisé ;
- erreurs de génération ;
- planifications actives.

---

# Alertes

Le système notifie :

- échec d'une génération ;
- rapport programmé terminé ;
- données incomplètes ;
- dépassement du temps maximal de génération ;
- anomalie détectée dans un rapport.

---

# BPMN simplifié

Sélection du rapport

↓

Application des filtres

↓

Collecte des données

↓

Calculs

↓

Génération

↓

Visualisation

↓

Export

↓

Archivage

---

# API principales

- Générer un rapport
- Exporter un rapport
- Programmer un rapport
- Annuler une planification
- Consulter le catalogue
- Créer un modèle
- Modifier un modèle
- Partager un rapport
- Télécharger un rapport

---

# Cas d'erreur

## Rapport inexistant

HTTP 404

---

## Accès interdit

HTTP 403

---

## Paramètres invalides

HTTP 422

---

## Temps de génération dépassé

HTTP 504

---

## Données indisponibles

HTTP 409

---

# Tests fonctionnels

Le système devra vérifier :

✓ génération correcte des rapports ;

✓ exactitude des calculs ;

✓ application des filtres ;

✓ export PDF ;

✓ export Excel ;

✓ planification automatique ;

✓ respect des permissions ;

✓ historisation complète.

---

# Indicateurs (KPI)

- Nombre de rapports générés
- Temps moyen de génération
- Nombre d'exports
- Nombre de rapports programmés
- Taux de réussite des générations
- Rapports les plus consultés
- Nombre de modèles personnalisés
- Volume de données exportées
- Satisfaction des utilisateurs
- Taux d'utilisation du moteur

---

# Intelligence artificielle

Le moteur IA peut :

- résumer automatiquement un rapport ;
- détecter les tendances significatives ;
- mettre en évidence les anomalies financières ;
- proposer des commentaires automatiques ;
- répondre en langage naturel aux questions financières ;
- recommander les rapports les plus pertinents selon le contexte de l'utilisateur.

Les analyses produites par l'IA restent des aides à la décision et ne remplacent jamais la validation humaine.

---

# Évolutions prévues

Le module devra intégrer :

- tableaux croisés dynamiques interactifs (OLAP) ;
- exploration multidimensionnelle (Drill Down / Drill Up) ;
- portail décisionnel (BI) ;
- diffusion sécurisée des rapports vers les autorités de tutelle ;
- API de publication ouverte pour les indicateurs non confidentiels ;
- génération automatique de rapports narratifs assistés par IA.

---

# Conclusion

Le sous-module **Rapports** constitue le moteur de restitution financière d'EduWeb Planner. Il transforme les données issues de l'ensemble des modules en informations fiables, exploitables et directement utilisables pour le pilotage stratégique, la conformité réglementaire et l'amélioration continue de la gouvernance financière des établissements d'enseignement.
