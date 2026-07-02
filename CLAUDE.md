# CLAUDE.md — EduWeb Planner

Ce fichier fournit le contexte du projet à Claude Code. Le document de référence complet est le cahier des charges (`EduWeb_Planner_Cahier_des_charges.docx`) ; ce fichier en résume les décisions structurantes et les règles à ne jamais enfreindre.

---

## 1. Le projet en une phrase

EduWeb Planner est une plateforme web de gestion et de planification scolaire pour le système éducatif ivoirien, avec une **interface unique adaptée dynamiquement au rôle** de chaque utilisateur connecté (13 rôles), et un module phare de **génération automatique d'emplois du temps** par solveur de contraintes.

---

## 2. Stack technique (NON négociable)

| Couche | Technologie |
|---|---|
| Framework full-stack | **Next.js (App Router)** |
| Langage | **TypeScript** (strict) |
| Base de données | **PostgreSQL** hébergé sur **Neon** |
| ORM | **Prisma** |
| Authentification | **Auth.js (NextAuth v5)**, provider Credentials personnalisé |
| E-mails transactionnels | **Resend** |
| Paiement / abonnements | **Stripe** |
| Visualisation de données | **Recharts** |
| Génération de documents | bibliothèques Node (docx, pdf-lib / Puppeteer) |
| Déploiement | **Vercel** |

**Ne pas introduire Supabase** (choix explicite : infrastructure entièrement maîtrisée).

---

## 3. Règles d'architecture à toujours respecter

- **Vérification des permissions côté serveur**, jamais uniquement masquée côté UI. Toute donnée sensible est filtrée par rôle ET par périmètre avant d'être renvoyée au client.
- **Couche RBAC centralisée et unique**, invoquée par tous les modules — jamais dupliquée page par page.
- **Toute évolution du schéma passe par une migration Prisma** versionnée.
- **Secrets côté serveur uniquement** : Resend, Stripe, etc. appelés depuis les Route Handlers, jamais depuis le client. Aucune clé secrète exposée au navigateur.
- **Développement par phases** : respecter l'ordre des dépendances (voir §7). Ne pas démarrer un module dont les fondations ne sont pas posées.

---

## 4. Le RBAC est le cœur du système

Un utilisateur n'a **pas seulement un rôle** : il a un rôle **et un périmètre (scope)**. Deux utilisateurs de même rôle mais de périmètres différents ne voient jamais les mêmes données.

### Les 13 rôles et leur périmètre

| Rôle (identifiant) | Périmètre |
|---|---|
| `admin` | Aucun (global) |
| `etablissements_admin` | Un ou plusieurs établissements |
| `cafop_admin` | Un CAFOP |
| `apfc_admin` | Une APFC |
| `drena` | Une région |
| `inspecteur` | Une région / zone d'inspection |
| `conseiller_pedagogique` | Une antenne / zone |
| `chef_antenne` | Une antenne pédagogique |
| `chef_etablissement` | Un établissement |
| `enseignant` | Un établissement (+ classes affectées) |
| `educateur` | Un établissement |
| `parent` | Ses enfants (liens parent-élève) |
| `eleve` | Lui-même |

Le champ de périmètre sur `Utilisateur` est nullable selon le rôle (`etablissementId?`, `cafopId?`, `apfcId?`, `regionId?`). Les rôles personnels (parent, élève) utilisent des relations dédiées, pas une colonne générique.

### Mode Aperçu de rôle
- Permet à un admin de visualiser l'interface d'un autre rôle sans changer de compte.
- **Filtré par périmètre** : un admin spécialisé ne voit en aperçu que les rôles pertinents pour son périmètre (pas les 13 rôles).
- **Lecture seule par défaut**, avec bandeau permanent indiquant l'état d'aperçu.

---

## 5. Workflow d'authentification (logique précise à respecter)

**Compte et rôle sont découplés** — deux statuts indépendants.

1. Inscription : e-mail + mot de passe + **rôle souhaité** (avec établissement/structure déclaré).
2. E-mail de confirmation envoyé via Resend.
3. Au clic sur le lien : le **compte** devient **actif** immédiatement (aucune validation humaine).
4. L'utilisateur reçoit le rôle technique **`eleve`** par défaut, quel que soit le rôle demandé.
5. Une **`DemandeRole`** est créée en parallèle avec le statut **`en_attente`**, portant le rôle réellement souhaité.
6. L'utilisateur peut se connecter, mais son **accès est restreint à `Mon Identification` et `Mon Profil`** tant que la demande est en attente, avec un **bandeau de statut** visible.
7. **En V1, seul l'`admin` système approuve les demandes** (toute la délégation par périmètre est une évolution future — déjà anticipée par le champ `traiteParId` du modèle, donc pas de migration nécessaire pour l'activer plus tard).
8. À l'approbation : le rôle actif passe de `eleve` au rôle approuvé, avec son périmètre ; accès débloqué ; notification envoyée.

> Règle : cette logique d'accès restreint s'applique **uniformément à tous les rôles**, sans traitement différencié (décision explicite, pour rester simple à maintenir).

---

## 6. Module Emplois du temps — le point d'innovation

**Ne PAS implémenter un algorithme glouton.** Le moteur cible est un **solveur de contraintes par backtracking avec heuristiques**, en TypeScript natif (pas de dépendance externe lourde de type solveur Python).

### Contraintes DURES (jamais violées)
- Unicité enseignant / classe / salle sur un même créneau
- Volume horaire hebdomadaire par matière et niveau respecté
- Disponibilités déclarées des enseignants
- Capacité de salle ≥ effectif de la classe
- Compatibilité salle/matière (labo pour SVT en TP, salle info, etc.)
- **Double vacation** : chaque vacation = sous-ensemble de créneaux disjoint, multipliant la pression sur les salles partagées

### Contraintes SOUPLES (best-effort en V1, pas de score formalisé)
Heures consécutives limitées · matières denses pas en fin de journée · répartition sur la semaine · pause méridienne · préférences enseignants.

### Comportement attendu
- Heuristique de priorisation : placer d'abord les créneaux les plus contraints (salles spécialisées rares, enseignants à faible dispo, double vacation).
- **En cas de sur-contrainte (aucune solution) : NE PAS produire un planning incomplet silencieusement.** Identifier et afficher explicitement le(s) point(s) de blocage pour que l'utilisateur sache quoi ajuster.
- Après génération : **ajustement manuel par glisser-déposer**, avec **re-vérification des contraintes dures en temps réel** à chaque déplacement (ne jamais valider un conflit).

### Données d'entrée (configurables par établissement)
Grille horaire par niveau/discipline (**modèle national ivoirien par défaut, modifiable**) · effectifs · régime de vacation par niveau · salles (capacité + type) · structure de la semaine · enseignants + compétences + indisponibilités.

> Évolution V2 (plus tard) : optimisation fine des contraintes souples avec score de qualité global.

---

## 7. Ordre de développement par phases (respecter les dépendances)

| Phase | Contenu | Dépend de |
|---|---|---|
| **0** | Fondations : init Next.js, Prisma + Neon, Auth.js, schéma initial (Utilisateur/Role/DemandeRole), déploiement Vercel | — |
| **1** | RBAC + authentification complets (inscription/Resend/demande de rôle, logique de périmètre, pages Système de base) | Phase 0 |
| **2** | Établissements & structure (Région, Établissement, Classe, Niveau, Salle, Discipline), configuration générale | Phase 1 |
| **3** | Vie scolaire noyau : affectations, inscriptions, liens parent-élève, registre d'appel, cahier de texte, notes & bulletins, notifications de base | Phase 2 |
| **4** | **Module Emplois du temps (solveur)** | Phase 3 |
| **5** | CAFOP & APFC (+ import CSV Moodle) | Phase 1 (parallélisable avec 3-4) |
| **6** | Inspection, Rapports, Statistiques (Recharts) | Phases 3 et 4 |
| **7** | Facturation Stripe, communication avancée, alertes SMS, Académie Premium, journal d'activité, finitions | Toutes |

**Critère de passage de phase** : chaque phase doit produire un livrable fonctionnel et testable avant de passer à la suivante.

---

## 8. Conventions de code

- TypeScript strict, pas de `any` implicite.
- Composants serveur par défaut (App Router) ; `"use client"` seulement quand nécessaire (interactivité, hooks).
- Nommage des identifiants de rôle : exactement ceux du tableau §4 (snake_case), à utiliser tels quels en base et dans le code.
- Validations d'entrée systématiques côté serveur (ne jamais faire confiance au client).
- Messages utilisateur et libellés d'interface **en français**.

---

## 9. Pièges à éviter (rappels)

- ❌ Ne pas masquer des données uniquement côté UI sans filtrage serveur.
- ❌ Ne pas dupliquer la logique de permissions module par module.
- ❌ Ne pas implémenter un glouton pour les emplois du temps.
- ❌ Ne pas produire un emploi du temps incomplet sans signaler le blocage.
- ❌ Ne pas bloquer la connexion en attendant la validation d'un rôle (le compte est actif ; c'est l'accès qui est restreint).
- ❌ Ne pas introduire Supabase ni d'autre BaaS.
- ❌ Ne pas exposer de clé secrète (Stripe/Resend) côté client.

---

## 10. Référence

Document complet : `docs/EduWeb_Planner_Cahier_des_charges.docx`
Les numéros de section y sont stables (ex : 4.2 schéma RBAC, 5.3.0 solveur, partie 6 auth, partie 8 phases). S'y référer en cas de doute plutôt que de réinventer une décision.

---

## 11. Contexte de reprise (À LIRE en début de session)

`docs/REPRISE-CONTEXTE.md` — état d'avancement réel, pièges techniques (Prisma 7, Next 16),
**règle de sécurité du cloisonnement par périmètre**, conventions de design, pièges de
vérification en local, et clarifications métier accumulés au fil du développement.
`ROADMAP.md` — suivi détaillé des phases. `MIGRATION.md` — changement d'ordinateur.
