# Profils utilisateurs et matrice des permissions
## Module Finance – EduWeb Planner

Version : 1.0

---

# Objectif

Définir les profils utilisateurs du module Finance.

Chaque profil dispose :

- d'un rôle métier ;
- d'un périmètre d'action ;
- de permissions ;
- de restrictions ;
- d'un niveau de validation ;
- d'un niveau d'audit.

Le système applique le principe du **moindre privilège** (*Least Privilege Principle*).

Aucun utilisateur ne possède plus de droits que nécessaire.

---

# Hiérarchie des profils

```
Super Administrateur EduWeb

        │

Administrateur Institution

        │

Chef d'Établissement

        │

Gestionnaire Financier

        │

Comptable

        │

Caissier

        │

Économe

        │

Magasinier

        │

Responsables de service

        │

Personnel habilité

        │

Parents / Élèves
```

---

# P-001 — Super Administrateur EduWeb

## Mission

Administration technique de la plateforme.

## Peut

- créer des établissements ;
- créer des administrateurs ;
- gérer les licences ;
- gérer les sauvegardes ;
- restaurer les données ;
- gérer les paramètres globaux ;
- consulter les journaux techniques.

## Ne peut pas

- modifier les écritures comptables d'un établissement ;
- encaisser un paiement ;
- clôturer une caisse locale.

---

# P-002 — Administrateur Institution

Correspond au responsable informatique ou au responsable fonctionnel de l'établissement.

## Peut

- créer les utilisateurs ;
- affecter les rôles ;
- configurer les paramètres financiers ;
- créer les exercices comptables ;
- configurer les devises ;
- configurer les banques ;
- configurer les caisses.

## Validation

Niveau 1.

---

# P-003 — Chef d'Établissement

Exemples :

- Directeur
- Proviseur
- Principal
- Directeur Général
- Recteur

## Peut

- consulter tous les tableaux de bord ;
- consulter tous les rapports ;
- approuver les budgets ;
- approuver les dépenses ;
- autoriser les remboursements ;
- valider les clôtures ;
- consulter tous les comptes.

## Restrictions

Ne saisit normalement pas les opérations quotidiennes.

---

# P-004 — Gestionnaire Financier

Responsable administratif et financier.

## Peut

- gérer les frais scolaires ;
- créer les budgets ;
- gérer les fournisseurs ;
- suivre la trésorerie ;
- superviser les caisses ;
- approuver certaines dépenses ;
- lancer les clôtures.

---

# P-005 — Comptable

## Peut

- consulter toutes les écritures ;
- générer les journaux ;
- produire la balance ;
- produire le bilan ;
- effectuer les rapprochements bancaires ;
- générer les états financiers ;
- passer les écritures d'ajustement autorisées.

## Restrictions

Ne peut pas supprimer une écriture validée.

---

# P-006 — Caissier

## Peut

- ouvrir une caisse ;
- enregistrer un paiement ;
- éditer un reçu ;
- effectuer un remboursement autorisé ;
- clôturer sa caisse.

## Ne peut pas

- modifier les frais scolaires ;
- modifier le plan comptable ;
- modifier les budgets.

---

# P-007 — Économe

## Peut

- enregistrer les dépenses ;
- gérer les achats ;
- suivre les commandes ;
- gérer les fournisseurs ;
- gérer les immobilisations.

---

# P-008 — Magasinier

## Peut

- enregistrer les entrées ;
- enregistrer les sorties ;
- gérer les inventaires ;
- consulter les stocks.

## Ne peut pas

- modifier les prix ;
- supprimer un mouvement de stock.

---

# P-009 — Responsable de Cantine

## Peut

- gérer les repas ;
- enregistrer les consommations ;
- consulter son stock.

---

# P-010 — Responsable de Transport

## Peut

- gérer les abonnements transport ;
- enregistrer les paiements liés au transport ;
- consulter les listes.

---

# P-011 — Responsable d'Internat

## Peut

- gérer les chambres ;
- gérer les frais d'internat ;
- consulter les paiements associés.

---

# P-012 — Responsable de Bibliothèque

## Peut

- consulter les paiements des cautions ;
- gérer les remboursements autorisés.

---

# P-013 — Enseignant

## Peut

- consulter son historique de remboursements éventuels ;
- consulter certains états statistiques autorisés.

Il n'a aucun accès à la comptabilité générale.

---

# P-014 — Parent d'Élève

Accès via le portail EduWeb.

## Peut

- consulter son compte ;
- consulter les factures ;
- consulter les échéances ;
- payer en ligne ;
- télécharger les reçus ;
- consulter les historiques.

---

# P-015 — Élève / Étudiant

Selon les autorisations de l'établissement.

Peut consulter :

- son compte ;
- ses reçus ;
- ses échéances.

---

# P-016 — Auditeur

## Peut

- consulter toutes les données ;
- exporter les rapports ;
- consulter les journaux ;
- consulter les historiques.

## Ne peut jamais

- modifier une donnée.

---

# P-017 — Commissaire aux Comptes

Dispose des mêmes droits que l'auditeur.

Accès temporaire possible.

Toutes ses consultations sont historisées.

---

# P-018 — Inspecteur

Selon son niveau :

- établissement ;
- DRENA ;
- ministère.

Peut consulter les données consolidées autorisées.

---

# Délégation de pouvoirs

Un utilisateur peut déléguer temporairement ses droits.

Exemple :

Gestionnaire absent

↓

Le Directeur délègue les validations au Comptable

↓

Durée :

du 01/08/2026 au 15/08/2026

La délégation est automatiquement révoquée à son expiration.

---

# Double validation

Certaines opérations nécessitent deux validations.

Exemple :

Création dépense

↓

Validation Gestionnaire

↓

Validation Directeur

↓

Paiement

---

# Séparation des tâches

Le système interdit qu'une même personne :

- crée un fournisseur ;
- approuve ce fournisseur ;
- enregistre la facture ;
- valide le paiement.

Ces étapes doivent être réparties entre plusieurs profils lorsque cette politique est activée.

---

# Permissions

Chaque permission est atomique.

Exemple :

FINANCE_VIEW

FINANCE_CREATE

FINANCE_UPDATE

FINANCE_DELETE

PAYMENT_CREATE

PAYMENT_CANCEL

PAYMENT_VALIDATE

BUDGET_APPROVE

ACCOUNTING_EXPORT

REPORT_VIEW

REPORT_EXPORT

USER_CREATE

USER_UPDATE

USER_DELETE

ROLE_ASSIGN

---

# Matrice simplifiée des permissions

| Fonction | Directeur | Gestionnaire | Comptable | Caissier | Parent |
|----------|:---------:|:------------:|:---------:|:--------:|:------:|
| Consulter tableaux de bord | ✅ | ✅ | ✅ | ❌ | ❌ |
| Encaisser un paiement | ❌ | ✅ | ❌ | ✅ | ❌ |
| Émettre un reçu | ❌ | ✅ | ❌ | ✅ | ❌ |
| Modifier un tarif | ✅ | ✅ | ❌ | ❌ | ❌ |
| Valider un budget | ✅ | ✅* | ❌ | ❌ | ❌ |
| Consulter son compte | ❌ | ❌ | ❌ | ❌ | ✅ |
| Télécharger un reçu | ❌ | ❌ | ❌ | ❌ | ✅ |

\* Selon les délégations accordées.

---

# Authentification renforcée

Pour les profils sensibles :

- Directeur ;
- Gestionnaire ;
- Comptable ;
- Administrateur.

Le système peut imposer :

- mot de passe fort ;
- authentification multifacteur (MFA) ;
- validation OTP ;
- limitation des sessions simultanées.

---

# Journalisation des accès

Chaque connexion enregistre :

- utilisateur ;
- date ;
- heure ;
- adresse IP ;
- navigateur ;
- appareil ;
- localisation approximative (si disponible) ;
- résultat de la connexion (succès ou échec).

---

# Règles d'évolution

Les profils sont entièrement paramétrables.

Un établissement peut :

- créer un nouveau rôle ;
- hériter d'un rôle existant ;
- ajouter ou retirer des permissions ;
- limiter un rôle à certains établissements ou exercices.

Aucune permission ne doit être codée en dur dans l'application.

---

# Conclusion

Le système d'autorisation du module Finance repose sur une gestion fine des rôles et des permissions. Les profils définis dans ce document constituent la base du contrôle d'accès et devront être utilisés par l'ensemble des modules d'EduWeb Planner afin de garantir la sécurité, la traçabilité et la conformité des opérations financières.
