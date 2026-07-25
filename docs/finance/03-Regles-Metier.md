# Règles Métier
## Module Finance – EduWeb Planner

Version : 1.0

---

# Préambule

Les règles métier définissent les comportements obligatoires du système.

Une règle métier est une contrainte fonctionnelle indépendante de la technologie.

Elle s'impose :

- aux utilisateurs ;
- aux développeurs ;
- aux administrateurs ;
- aux agents IA ;
- aux API.

En cas de conflit entre le code et les présentes règles, ces dernières prévalent.

---

# Classification des règles

Les règles sont regroupées en catégories :

RM-001 : Organisation générale

RM-100 : Paramétrage financier

RM-200 : Frais de scolarité

RM-300 : Facturation

RM-400 : Encaissements

RM-500 : Caisses

RM-600 : Banques

RM-700 : Comptabilité

RM-800 : Dépenses

RM-900 : Achats

RM-1000 : Stocks

RM-1100 : Articles

RM-1200 : Immobilisations

RM-1300 : Budgets

RM-1400 : Rapports

RM-1500 : IA

RM-1600 : Audit

---

# RM-001 — Unicité des données

Toute information métier ne doit exister qu'une seule fois dans la base de données.

Aucune duplication ne doit être créée.

Les vues, rapports et tableaux de bord sont calculés à partir de cette donnée unique.

---

# RM-002 — Identifiant universel

Chaque entité possède un identifiant unique (UUID).

Cet identifiant est immuable.

Il ne peut jamais être modifié.

---

# RM-003 — Historisation

Toute modification est historisée.

Les informations suivantes sont enregistrées :

- ancienne valeur ;
- nouvelle valeur ;
- auteur ;
- date ;
- heure ;
- justification (facultative selon le contexte).

---

# RM-004 — Suppression logique

Les suppressions physiques sont interdites.

Toute suppression devient une désactivation logique.

Les données restent disponibles pour les audits.

---

# RM-005 — Exercice comptable

Chaque opération financière appartient obligatoirement à un exercice comptable.

Une opération ne peut jamais exister hors exercice.

---

# RM-006 — Établissement

Chaque donnée financière appartient à un établissement.

Aucune donnée ne peut être orpheline.

---

# RM-007 — Devise

Toutes les opérations utilisent une devise.

La devise est enregistrée avec chaque transaction.

Les taux de change sont historisés.

---

# RM-008 — Date comptable

Une opération possède :

- une date de création ;
- une date comptable ;
- éventuellement une date de validation.

Ces trois dates peuvent être différentes.

---

# RM-009 — Utilisateur responsable

Toute opération possède un utilisateur responsable.

Même lorsqu'une opération est automatisée.

---

# RM-010 — Validation

Certaines opérations nécessitent une validation.

Exemples :

- clôture de caisse ;
- annulation d'une facture ;
- suppression logique ;
- remboursement.

---

# RM-011 — Journalisation

Toutes les opérations sont journalisées.

Le journal ne peut jamais être modifié.

---

# RM-012 — Sécurité

Toute opération vérifie :

- authentification ;
- autorisation ;
- établissement ;
- exercice ;
- permissions.

---

# RM-013 — Horodatage

Toutes les dates sont enregistrées en UTC.

L'affichage est converti dans le fuseau horaire de l'utilisateur.

---

# RM-014 — Numérotation

Les documents possèdent une numérotation configurable.

Exemple :

REC-2026-000154

FAC-2026-000218

BC-2026-000041

Les numéros sont uniques par établissement et par exercice.

---

# RM-015 — Transactions atomiques

Toute opération critique est atomique.

Si une étape échoue :

l'ensemble est annulé.

---

# RM-016 — Cohérence

Le système ne doit jamais produire :

- un solde négatif non autorisé ;
- une facture sans client ;
- un paiement sans facture (sauf avance autorisée) ;
- une écriture déséquilibrée.

---

# RM-017 — Auditabilité

Toute décision financière doit être reconstituable plusieurs années après.

L'historique complet est conservé.

---

# RM-018 — Notifications

Les notifications sont déclenchées automatiquement selon des événements métier.

Exemple :

Paiement reçu

↓

Reçu généré

↓

SMS envoyé

↓

Email envoyé

↓

Tableau de bord mis à jour

---

# RM-019 — Multi-utilisateurs

Deux utilisateurs ne doivent jamais modifier simultanément la même opération sans contrôle de concurrence.

Le système utilise un verrouillage optimiste (Optimistic Locking).

---

# RM-020 — Performance

Les tableaux de bord doivent être calculés en moins de deux secondes.

Les recherches doivent répondre en moins d'une seconde pour les opérations courantes.

---

# RM-021 — Conformité OHADA

Le plan comptable est compatible avec les normes OHADA.

Toute adaptation nationale doit rester paramétrable.

---

# RM-022 — Intégrité référentielle

Aucune suppression logique ne peut rompre les relations entre les données.

Le système refuse toute opération créant une incohérence.

---

# RM-023 — Pièces justificatives

Toute opération financière peut comporter une ou plusieurs pièces jointes :

- facture fournisseur ;
- reçu ;
- devis ;
- bon de commande ;
- contrat ;
- photo ;
- PDF.

Les pièces sont archivées de manière sécurisée.

---

# RM-024 — Rapprochement automatique

Lorsque cela est possible, les opérations bancaires sont rapprochées automatiquement avec les écritures comptables et les paiements.

Les anomalies sont signalées à l'utilisateur.

---

# RM-025 — IA décisionnelle

L'intelligence artificielle ne crée jamais d'écriture comptable.

Elle produit uniquement :

- des recommandations ;
- des alertes ;
- des simulations ;
- des prévisions.

La validation finale appartient toujours à un utilisateur habilité.

---

# Conclusion

Les règles générales présentées dans cette première partie constituent le socle de l'ensemble du module Finance.

Les chapitres suivants détailleront les règles spécifiques applicables à chaque sous-module :

- Frais de scolarité ;
- Facturation ;
- Encaissements ;
- Caisses ;
- Banques ;
- Comptabilité ;
- Dépenses ;
- Achats ;
- Stocks ;
- Articles ;
- Immobilisations ;
- Budgets ;
- Rapports ;
- Audit ;
- Intelligence artificielle.

Chaque nouvelle règle métier devra être identifiée, numérotée et documentée selon cette même structure afin de garantir la cohérence et la traçabilité du système.
