# Gestion des Rôles et Permissions (RBAC)
## EduWeb Planner

Version : 1.0

---

# Objectif

Le présent document définit le modèle officiel de contrôle d'accès d'EduWeb Planner.

Il permet de :

- sécuriser les données ;
- appliquer le principe du moindre privilège ;
- garantir la séparation des responsabilités ;
- assurer la traçabilité des actions ;
- simplifier l'administration des droits.

Le modèle combine :

- RBAC (Role-Based Access Control)
- ABAC (Attribute-Based Access Control)
- Multi-Tenant

---

# Principes

Chaque utilisateur possède :

- un compte ;
- un ou plusieurs rôles ;
- des permissions ;
- un tenant ;
- des attributs.

Les permissions sont toujours vérifiées avant toute opération.

---

# Hiérarchie des rôles

Plateforme

↓

Super Administrateur

↓

Administrateur National

↓

Administrateur Régional (DRENA)

↓

Chef d'Établissement

↓

Gestionnaire

↓

Comptable

↓

Économe

↓

Responsable RH

↓

Responsable Pédagogique

↓

Enseignant

↓

Personnel administratif

↓

Élève

↓

Parent

↓

Invité

---

# Types de permissions

Les permissions suivent la convention :

module.ressource.action

Exemples :

finance.invoice.read

finance.invoice.create

finance.invoice.update

finance.invoice.delete

finance.invoice.validate

finance.invoice.export

---

# Actions standards

- create
- read
- update
- delete
- validate
- approve
- reject
- archive
- restore
- export
- import
- print
- sign
- assign
- execute
- manage

---

# Modules

Les permissions sont organisées par module.

## Gouvernance

governance.*

---

## Utilisateurs

users.*

---

## Établissements

schools.*

---

## Scolarité

students.*

classes.*

enrollments.*

attendance.*

grades.*

---

## Pédagogie

courses.*

curriculum.*

evaluations.*

planner.*

---

## Finance

budgets.*

payments.*

cash.*

banks.*

invoices.*

expenses.*

---

## Comptabilité

accounts.*

journals.*

ledger.*

closing.*

---

## Ressources humaines

employees.*

contracts.*

leave.*

payroll.*

training.*

---

## Patrimoine

assets.*

maintenance.*

inventory.*

---

## Achats

purchase.*

suppliers.*

orders.*

contracts.*

---

## Bibliothèque documentaire

documents.*

archives.*

knowledge.*

---

## Notifications

notifications.*

---

## Intelligence artificielle

ai.chat

ai.predict

ai.generate

ai.explain

ai.admin

---

## Paramètres

settings.*

---

# Description des rôles

## Super Administrateur

Accès complet à tous les tenants.

Peut :

- créer des organisations ;
- gérer les licences ;
- administrer les rôles ;
- superviser les journaux ;
- configurer la plateforme.

---

## Administrateur National

Administration de l'ensemble des établissements relevant de son autorité.

Peut :

- consulter les indicateurs nationaux ;
- créer des DRENA ;
- superviser les établissements ;
- produire les rapports nationaux.

---

## Administrateur Régional

Accès limité à sa région.

Peut :

- suivre les établissements ;
- consulter les statistiques régionales ;
- gérer les inspections.

---

## Chef d'Établissement

Accès complet aux données de son établissement.

Peut :

- gérer les utilisateurs locaux ;
- valider les budgets ;
- signer certains documents ;
- consulter les tableaux de bord.

---

## Gestionnaire

Peut :

- préparer les budgets ;
- suivre les dépenses ;
- gérer les achats.

---

## Comptable

Peut :

- enregistrer les écritures ;
- effectuer les rapprochements ;
- produire les états financiers.

---

## Économe

Peut :

- gérer les stocks ;
- suivre les immobilisations ;
- réceptionner les commandes.

---

## Responsable RH

Peut :

- gérer le personnel ;
- suivre les congés ;
- organiser les formations.

---

## Responsable pédagogique

Peut :

- organiser les emplois du temps ;
- suivre les évaluations ;
- consulter les statistiques pédagogiques.

---

## Enseignant

Peut :

- gérer ses classes ;
- saisir les notes ;
- enregistrer les présences ;
- consulter ses emplois du temps.

---

## Personnel administratif

Accès limité aux missions administratives qui lui sont confiées.

---

## Élève

Accès uniquement :

- à son dossier ;
- à ses notes ;
- à son emploi du temps ;
- à ses factures ;
- à ses documents autorisés.

---

## Parent

Accès uniquement aux informations des enfants qui lui sont rattachés.

---

## Invité

Accès très limité.

Lecture uniquement.

---

# Permissions contextuelles (ABAC)

Les permissions peuvent dépendre de :

- établissement ;
- région ;
- année scolaire ;
- fonction ;
- service ;
- statut ;
- propriété de la ressource.

Exemple :

Un enseignant peut modifier uniquement les notes des classes qui lui sont affectées.

---

# Héritage

Les rôles héritent des permissions des niveaux inférieurs uniquement lorsque cela est explicitement défini par la politique d'administration.

Les exceptions sont documentées.

---

# Séparation des responsabilités

Certaines opérations exigent deux acteurs distincts.

Exemples :

Préparer un budget

↓

Valider un budget

---

Créer un paiement

↓

Valider le paiement

---

Créer un fournisseur

↓

Approuver le fournisseur

---

# Permissions temporaires

Le système peut accorder des droits :

- pour une durée limitée ;
- pour une mission ;
- pour un remplacement ;
- pour un audit.

À expiration, les droits sont automatiquement retirés.

---

# Délégation

Un utilisateur peut déléguer certaines permissions selon les règles définies par l'organisation.

Toute délégation est :

- limitée ;
- tracée ;
- révocable.

---

# Audit

Chaque décision d'autorisation conserve :

- utilisateur ;
- rôle ;
- permission ;
- ressource ;
- résultat ;
- date ;
- contexte.

---

# API

Les API vérifient les permissions avant toute opération.

Les refus retournent :

HTTP 403

---

# Matrice des permissions (extrait)

| Module | Lecture | Création | Modification | Validation | Export |
|---------|----------|-----------|---------------|------------|--------|
| Élèves | ✔ | ✔ | ✔ | ✔ | ✔ |
| Facturation | ✔ | ✔ | ✔ | ✔ | ✔ |
| Comptabilité | ✔ | ✔ | ✔ | ✔ | ✔ |
| RH | ✔ | ✔ | ✔ | ✔ | ✔ |
| IA | ✔ | ✔ | — | — | ✔ |

Cette matrice est détaillée dans un référentiel de permissions maintenu avec le code source.

---

# Règles métier

## RM-2600

Toute action nécessite une permission explicite.

---

## RM-2601

Les permissions sont évaluées avant toute opération.

---

## RM-2602

Les rôles sont historisés.

---

## RM-2603

Toute modification des droits est journalisée.

---

## RM-2604

Les permissions temporaires expirent automatiquement.

---

## RM-2605

Les accès inter-tenants sont interdits sauf autorisation explicite.

---

# Tests

Le système devra vérifier :

✓ héritage des rôles ;

✓ permissions ;

✓ séparation des responsabilités ;

✓ délégations ;

✓ restrictions contextuelles ;

✓ audit ;

✓ sécurité Multi-Tenant.

---

# KPI

- Nombre de rôles
- Nombre de permissions
- Taux d'utilisation des rôles
- Nombre de refus d'accès
- Modifications de permissions
- Délégations actives
- Comptes inactifs
- Couverture MFA des rôles sensibles

---

# Évolutions prévues

Le système devra intégrer :

- création de rôles personnalisés par organisation ;
- moteur graphique de gestion des permissions ;
- simulation d'autorisations (« Why/Why Not ») ;
- recommandations IA pour l'attribution des droits ;
- certification périodique des accès.

---

# Conclusion

Le modèle RBAC d'EduWeb Planner fournit un cadre robuste, évolutif et sécurisé pour la gestion des accès. Associé aux attributs contextuels (ABAC) et à l'architecture multi-tenant, il garantit que chaque utilisateur accède uniquement aux ressources nécessaires à l'exercice de ses fonctions, tout en assurant une traçabilité complète des autorisations.
