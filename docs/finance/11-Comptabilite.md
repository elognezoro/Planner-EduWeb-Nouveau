# Comptabilité Générale et Analytique
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Le sous-module **Comptabilité** constitue le moteur comptable du système financier.

Il permet :

- l'enregistrement automatique des écritures ;
- la gestion du plan comptable ;
- la production des journaux ;
- la production du grand livre ;
- la balance générale ;
- les états financiers ;
- les clôtures comptables ;
- la comptabilité analytique.

Le principe fondamental est qu'aucune écriture ne soit saisie plusieurs fois.

---

# Vision

Le comptable ne doit plus passer manuellement les écritures provenant :

- des paiements ;
- des factures ;
- des achats ;
- des ventes ;
- des immobilisations ;
- des banques ;
- des caisses.

Toutes ces écritures sont générées automatiquement par le moteur comptable.

---

# Principes comptables

Le système respecte :

- le SYSCOHADA révisé ;
- la comptabilité en partie double ;
- le principe de permanence des méthodes ;
- le principe de prudence ;
- le principe d'indépendance des exercices ;
- le principe de justification des écritures.

---

# Référentiels comptables

Le logiciel doit permettre de sélectionner :

- SYSCOHADA
- IFRS (option)
- Plan comptable national
- Référentiel personnalisé

Le changement de référentiel est réservé à l'administrateur.

---

# Plan comptable

Le plan comptable est entièrement paramétrable.

Chaque compte comprend :

- numéro ;
- intitulé ;
- classe ;
- nature ;
- compte parent ;
- devise ;
- statut ;
- date d'ouverture ;
- date de clôture.

---

# Classes de comptes (OHADA)

Classe 1 : Capitaux

Classe 2 : Immobilisations

Classe 3 : Stocks

Classe 4 : Tiers

Classe 5 : Trésorerie

Classe 6 : Charges

Classe 7 : Produits

Classe 8 : Comptes spéciaux

Classe 9 : Comptabilité analytique (optionnelle)

---

# Journaux comptables

Le système gère plusieurs journaux :

- Journal des ventes
- Journal des achats
- Journal de caisse
- Journal de banque
- Journal des opérations diverses
- Journal des salaires
- Journal des immobilisations

Les journaux sont paramétrables.

---

# Écritures comptables

Chaque écriture comporte :

- numéro ;
- date ;
- journal ;
- libellé ;
- pièce justificative ;
- utilisateur ;
- devise ;
- exercice ;
- établissement.

---

# Lignes d'écriture

Chaque écriture contient au minimum deux lignes :

Débit

↓

Crédit

Le système interdit toute écriture déséquilibrée.

---

# Règles métier

## RM-700

Toute écriture doit être équilibrée.

Débit = Crédit

---

## RM-701

Une écriture validée n'est jamais supprimée.

---

## RM-702

Une correction s'effectue par une contre-écriture.

---

## RM-703

Toute écriture possède une pièce justificative.

---

## RM-704

Une écriture appartient obligatoirement à un exercice.

---

## RM-705

Aucune écriture ne peut être enregistrée sur une période clôturée.

---

# Génération automatique

Le système produit automatiquement les écritures lors des événements suivants :

Paiement

↓

Journal de caisse

↓

Compte client

↓

Compte de produits

---

Achat

↓

Fournisseur

↓

Charges

↓

Banque

---

Vente

↓

Client

↓

Produits

↓

TVA (si applicable)

---

Versement bancaire

↓

Banque

↓

Caisse

---

Amortissement

↓

Dotation

↓

Amortissement cumulé

---

# Comptabilité analytique

Le système permet de ventiler les écritures par :

- établissement ;
- service ;
- projet ;
- activité ;
- centre de coût ;
- centre de profit.

---

# Centres analytiques

Exemples :

Administration

Internat

Cantine

Transport

Bibliothèque

Laboratoire

Informatique

Formation continue

Chaque écriture peut être affectée à un ou plusieurs centres analytiques selon une clé de répartition paramétrable.

---

# Clôture comptable

La clôture comprend :

- contrôle des écritures ;
- vérification des journaux ;
- génération des écritures de clôture ;
- verrouillage de la période ;
- archivage logique.

Une période clôturée devient non modifiable.

---

# Réouverture exceptionnelle

La réouverture d'un exercice ou d'une période nécessite :

- une autorisation spécifique ;
- une justification ;
- une journalisation complète.

---

# États comptables

Le système génère automatiquement :

- Journal général
- Grand livre
- Balance générale
- Balance auxiliaire
- Balance âgée
- Bilan
- Compte de résultat
- Tableau des flux de trésorerie
- Annexes

---

# Balance âgée

Le système classe automatiquement les créances :

- 0 à 30 jours
- 31 à 60 jours
- 61 à 90 jours
- plus de 90 jours

---

# Rapprochements

Le module prend en charge :

- rapprochement bancaire ;
- rapprochement caisse ;
- rapprochement intercomptes.

---

# Contrôles automatiques

Le système détecte :

- comptes sans mouvement ;
- soldes anormaux ;
- écritures déséquilibrées ;
- comptes débiteurs inhabituels ;
- comptes créditeurs inhabituels ;
- doublons d'écriture.

---

# Audit comptable

Toutes les écritures enregistrent :

- auteur ;
- date ;
- heure ;
- référence de la pièce ;
- origine de l'écriture (automatique ou manuelle) ;
- historique des validations.

---

# Tableau de bord

Le Directeur et le Comptable peuvent consulter :

- résultat provisoire ;
- produits ;
- charges ;
- trésorerie ;
- dettes ;
- créances ;
- valeur des immobilisations ;
- valeur des stocks ;
- indicateurs analytiques.

---

# BPMN simplifié

Événement métier

↓

Génération des écritures

↓

Contrôle d'équilibre

↓

Validation

↓

Mise à jour des journaux

↓

Grand livre

↓

Balance

↓

États financiers

---

# API principales

- Créer une écriture manuelle
- Consulter un journal
- Consulter le grand livre
- Générer une balance
- Générer un bilan
- Générer un compte de résultat
- Clôturer une période
- Réouvrir une période
- Exporter les écritures

---

# Cas d'erreur

## Écriture déséquilibrée

HTTP 422

---

## Période clôturée

HTTP 409

---

## Compte comptable inexistant

HTTP 404

---

## Pièce justificative absente

HTTP 422

---

## Exercice inexistant

HTTP 404

---

# Tests fonctionnels

Le système devra vérifier :

✓ équilibre automatique des écritures ;

✓ génération correcte des journaux ;

✓ mise à jour du grand livre ;

✓ production de la balance ;

✓ génération du bilan ;

✓ verrouillage des périodes clôturées ;

✓ traçabilité complète des écritures.

---

# Indicateurs (KPI)

- Nombre d'écritures
- Nombre de journaux
- Écritures automatiques
- Écritures manuelles
- Délais de clôture
- Résultat comptable
- Taux d'écritures rejetées
- Nombre d'anomalies détectées

---

# Intelligence artificielle

Le moteur IA peut :

- détecter des anomalies comptables ;
- proposer des imputations comptables ;
- identifier des risques de fraude ;
- anticiper les besoins de trésorerie ;
- suggérer des écritures de régularisation.

Aucune écriture n'est validée automatiquement par l'IA.

---

# Évolutions prévues

Le module devra intégrer :

- la consolidation multi-établissements ;
- les états financiers consolidés ;
- la comptabilité budgétaire ;
- la comptabilité par projets ;
- l'export vers les logiciels comptables externes ;
- l'intégration avec les plateformes fiscales électroniques lorsque les réglementations nationales l'exigent.

---

# Conclusion

Le sous-module **Comptabilité** constitue le référentiel financier central d'EduWeb Planner. Il transforme automatiquement les événements métier en écritures comptables conformes, produit les états réglementaires et fournit une vision fiable de la situation financière de l'établissement. Son architecture garantit la conformité, l'auditabilité et l'évolutivité nécessaires à un ERP de niveau institutionnel.
