# Module Archives et Gestion Électronique des Documents (GED)
## EduWeb Planner

Version : 1.0

---

# Objectif

Le module **Archives** constitue le système de **Gestion Électronique des Documents (GED)** d'EduWeb Planner.

Il assure la gestion complète du cycle de vie des documents administratifs, pédagogiques, financiers et techniques, depuis leur création jusqu'à leur élimination ou leur versement aux archives historiques.

Le module garantit :

- la conservation des documents ;
- leur authenticité ;
- leur intégrité ;
- leur traçabilité ;
- leur disponibilité ;
- leur valeur juridique.

---

# Objectifs métier

Le module permet de :

- centraliser tous les documents institutionnels ;
- organiser le classement documentaire ;
- automatiser l'archivage ;
- gérer les durées de conservation ;
- faciliter la recherche documentaire ;
- préserver le patrimoine documentaire ;
- garantir la conformité réglementaire.

---

# Types de documents

Le système gère notamment :

## Documents administratifs

- décisions ;
- arrêtés ;
- circulaires ;
- notes de service ;
- procès-verbaux ;
- courriers.

---

## Documents pédagogiques

- emplois du temps ;
- progressions ;
- évaluations ;
- relevés de notes ;
- bulletins ;
- plans de cours.

---

## Documents financiers

- budgets ;
- factures ;
- pièces comptables ;
- bons de commande ;
- états financiers.

---

## Documents RH

- dossiers du personnel ;
- contrats ;
- décisions de nomination ;
- évaluations ;
- formations.

---

## Documents patrimoniaux

- inventaires ;
- garanties ;
- rapports de maintenance ;
- plans des bâtiments.

---

## Documents scientifiques

- mémoires ;
- thèses ;
- publications ;
- rapports de recherche.

---

# Plan de classement

Les archives sont organisées selon un plan de classement configurable.

Exemple :

```
Administration

├── Gouvernance

├── Ressources Humaines

├── Scolarité

├── Comptabilité

├── Finance

├── Patrimoine

├── Pédagogie

├── Bibliothèque

└── Archives historiques
```

---

# Cycle de vie documentaire

Chaque document suit un cycle de vie.

Création

↓

Validation

↓

Diffusion

↓

Archivage intermédiaire

↓

Archivage définitif

↓

Élimination ou conservation permanente

---

# Métadonnées

Chaque document possède :

- identifiant unique ;
- titre ;
- auteur ;
- service propriétaire ;
- catégorie ;
- sous-catégorie ;
- date de création ;
- date de modification ;
- version ;
- statut ;
- niveau de confidentialité ;
- mots-clés.

---

# Versionning

Le système conserve toutes les versions.

Pour chaque version :

- auteur ;
- date ;
- commentaire ;
- différences ;
- signature éventuelle.

Aucune version n'est supprimée.

---

# Durées de conservation

Chaque catégorie documentaire possède :

- durée d'archivage courant ;
- durée d'archivage intermédiaire ;
- durée d'archivage définitif.

Exemples :

| Type | Conservation |
|-------|--------------|
| Courrier | Paramétrable |
| Facture | Paramétrable selon la réglementation applicable |
| Bulletin scolaire | Selon la politique documentaire de l'établissement |
| Décision administrative | Conservation permanente ou selon les règles définies |
| Contrat | Selon la réglementation applicable |

Les durées sont entièrement configurables afin de respecter les exigences réglementaires de chaque pays.

---

# Versement

Les documents peuvent être versés :

- aux archives intermédiaires ;
- aux archives historiques ;
- à un service national d'archives (si applicable).

Chaque versement produit :

- un bordereau ;
- un accusé ;
- une signature numérique.

---

# Élimination

L'élimination suit le processus :

Proposition

↓

Contrôle

↓

Validation

↓

Destruction

↓

Procès-verbal

L'opération est irréversible.

---

# Confidentialité

Niveaux :

- public ;
- interne ;
- confidentiel ;
- secret.

Les accès sont pilotés par le module RBAC.

---

# Recherche documentaire

Recherche :

- plein texte ;
- métadonnées ;
- OCR ;
- mots-clés ;
- auteur ;
- service ;
- date ;
- type documentaire ;
- numéro.

---

# OCR

Le système peut indexer automatiquement :

- PDF numérisés ;
- images ;
- documents scannés.

Les textes deviennent recherchables.

---

# Signature électronique

Les documents archivés peuvent conserver :

- signature électronique ;
- certificat ;
- horodatage ;
- empreinte numérique (hash).

---

# Intégrité

Chaque document possède :

- empreinte SHA-256 (ou algorithme configurable) ;
- historique des accès ;
- historique des modifications ;
- historique des téléchargements.

---

# Coffre-fort numérique

Le système peut gérer un espace sécurisé destiné :

- aux décisions sensibles ;
- aux contrats ;
- aux diplômes ;
- aux pièces officielles.

---

# Archivage légal

Le module est conçu pour faciliter la conformité avec les réglementations nationales applicables en matière d'archivage et de conservation des documents.

---

# Intégration avec les autres modules

## Courrier

Archivage automatique des courriers clôturés.

---

## Gouvernance

Archivage des décisions.

---

## Ressources Humaines

Archivage des dossiers du personnel.

---

## Comptabilité

Archivage des pièces comptables.

---

## Bibliothèque

Versement des documents historiques.

---

## Intelligence Artificielle

Le moteur IA peut :

- retrouver rapidement un document ;
- résumer un dossier ;
- proposer un classement ;
- détecter les doublons ;
- identifier les documents liés ;
- répondre à partir des archives autorisées (RAG).

---

# API

Exemples :

GET /archives

GET /archives/{id}

POST /archives

PUT /archives/{id}

DELETE /archives/{id}

GET /archives/search

POST /archives/archive

POST /archives/restore

POST /archives/export

---

# Règles métier

## RM-2600

Chaque document archivé possède un identifiant unique.

---

## RM-2601

Les documents archivés conservent toutes leurs métadonnées.

---

## RM-2602

Toute consultation est journalisée.

---

## RM-2603

Toute modification crée une nouvelle version.

---

## RM-2604

Un document éliminé ne peut être restauré.

---

## RM-2605

Les durées de conservation sont appliquées automatiquement selon la catégorie documentaire et la politique de conservation configurée.

---

# Tests

Le système devra vérifier :

✓ archivage ;

✓ recherche documentaire ;

✓ OCR ;

✓ versionning ;

✓ contrôle d'accès ;

✓ versement ;

✓ élimination ;

✓ restauration des documents autorisés.

---

# KPI

- Nombre de documents archivés
- Nombre de consultations
- Temps moyen de recherche
- Volume documentaire
- Nombre de documents numérisés
- Nombre de versions
- Nombre de versements
- Nombre d'éliminations
- Taux de conformité documentaire
- Taux d'indexation OCR

---

# Évolutions prévues

Le module pourra intégrer :

- archivage sur support WORM ;
- blockchain pour la preuve d'intégrité ;
- IA de classification automatique ;
- reconnaissance automatique des types documentaires ;
- archivage hybride (cloud + local) ;
- interconnexion avec les services nationaux d'archives.

---

# Conclusion

Le module **Archives** constitue le référentiel documentaire d'EduWeb Planner. Il garantit la conservation, l'intégrité, la traçabilité et la disponibilité des documents tout au long de leur cycle de vie. Associé aux modules Courrier, Gouvernance, Bibliothèque et Intelligence Artificielle, il offre une gestion électronique des documents moderne, sécurisée, évolutive et conforme aux exigences institutionnelles.
