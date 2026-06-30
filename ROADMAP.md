# EduWeb Planner — Feuille de route & suivi d'avancement

Document de pilotage du développement. Il reprend les **8 phases** du cahier des charges (§8)
et sert de tableau de bord unique pour mesurer la progression. Mettre à jour les cases à chaque
livraison. Légende : `[x]` fait · `[~]` en cours / partiel · `[ ]` à venir.

> Règle de passage de phase : chaque phase doit produire un livrable **fonctionnel et testable**
> avant de démarrer la suivante.

---

## Phase 0 — Fondations techniques ✅ (livrée)

- [x] Initialisation Next.js 16 (App Router) + TypeScript strict + Tailwind v4
- [x] Connexion Prisma 7 ↔ PostgreSQL via driver adapter `@prisma/adapter-pg` (compatible Neon)
- [x] Schéma initial : `Utilisateur`, `Role`, `DemandeRole`, `LienParentEleve`, `Jeton`,
      entités de périmètre (`Region`, `Etablissement`, `Cafop`, `Apfc`), `JournalActivite`
- [x] Auth.js v5 (NextAuth) — provider Credentials, découpage edge-safe (`proxy.ts`) / Node
- [x] Couche **RBAC centralisée** : 13 rôles, périmètres, navigation pilotée par rôle,
      matrice d'accès, mode Aperçu (filtrage par périmètre)
- [x] Design system institutionnel (vert forêt + or) + page d'accueil animée (Motion)
- [x] `.env.example` documenté · script de seed (rôles + admin)
- [ ] Déploiement initial sur Vercel _(à faire par le porteur de projet : push GitHub + import Vercel)_
- [ ] Brancher une vraie `DATABASE_URL` Neon puis `npm run db:migrate` + `npm run db:seed`

## Phase 1 — RBAC & authentification complets ✅ (livrée)

- [x] Inscription (e-mail + mot de passe + rôle souhaité + structure déclarée)
- [x] Rôle technique `eleve` par défaut + `DemandeRole` en_attente créée automatiquement
- [x] Confirmation d'e-mail via jeton (Resend, avec repli console en dev)
- [x] Connexion / déconnexion · réinitialisation de mot de passe
- [x] **Accès restreint** (Mon Identification + Mon Profil) tant que la demande est en attente,
      avec bandeau de statut permanent
- [x] Tableau de bord adaptatif au rôle · barre latérale filtrée par rôle
- [x] Pages : Mon Identification, Mon Profil, Niveaux d'accès, Comptes utilisateurs, **Approbations**
- [x] Workflow d'approbation/refus (admin) → bascule du rôle actif + notification + journal
- [x] **Gestion des habilitations** (changement de rôle par l'admin, filtré par périmètre)
- [x] **Mode Aperçu de rôle** (filtré par périmètre, lecture seule, bandeau permanent)
- [x] Rôle relu en base à chaque requête → changement de rôle effectif sans reconnexion
- [ ] _(report Phase 2)_ rattachement au périmètre réel à l'approbation (dépend des entités)

## Phase 2 — Établissements & structure ✅ (livrée)

- [x] Modèles : Région, Établissement, Classe, Niveau, Salle, Discipline (+ AnneeScolaire,
      GrilleHoraire, Configuration) — schéma validé, **migré sur Neon**
- [x] Page Établissements (liste filtrée par périmètre + création) et **détail** (salles & classes)
- [x] Configuration générale (année scolaire, régime de notation, régions, **grille horaire nationale**)
- [x] Seed enrichi : régions ivoiriennes, niveaux, disciplines, grille nationale, année + config
- [x] **Résolution du périmètre réel à l'approbation** (choix de l'établissement/région/CAFOP/APFC)
- [x] **Édition de la grille horaire par établissement** (surcharge du modèle national)
- [x] Design & thème (charte basique : palette, typographie, logo, composants)

## Console de configuration d'établissement (intrant du solveur) 🟡

Refonte de la fiche établissement en console de configuration (Étapes 1→5 demandées).

- [x] **Étape 1** : paramétrage institutionnel (pays, slogan, ministère, direction régionale),
      infos générales, chef d'établissement, **documents officiels** (upload Vercel Blob :
      emblème, logo, cachet, signature), rapport, **champs enseignants personnalisés**
- [x] **Étape 2** : dimensionnement (effectif/classe, salles, créneaux/jour), horaires
      journaliers, effectifs+vacation par niveau, **bouton « Calculer les classes pédagogiques »**
      (génération automatique des divisions)
- [x] Aperçu en-tête du bulletin · sous-pages Structure (salles & classes) et Grille horaire
- [x] Bouton **« Générer l'emploi du temps »** → écran de prérequis (point d'entrée Phase 4)
- [x] **Étape 3** : éditeur de séances par discipline (durée × nb/semaine → volume hebdo, statut OK/À définir, total niveau ; onglets par niveau)
- [x] **Étape 4** : RH — ajout d'enseignants, **import CSV** (+ modèle téléchargeable), **compétences** (matières habilitées)
- [x] **Étape 5** : branchement du moteur de génération (bouton « Générer l'emploi du temps » →
      solveur fonctionnel + grille)

## Phase 3 — Vie scolaire : noyau ✅ (livrée)

- [x] **Affectations enseignants** (enseignant ↔ classe ↔ discipline), filtré par établissement
- [x] **Inscriptions élèves** (par e-mail, une classe par année), filtré par établissement
- [x] **Liens parent-élève** (par e-mail), filtré par établissement
- [x] Modèles `AffectationEnseignant` + `Inscription` — migrés sur Neon
- [x] **Registre d'appel** (présences/absences/retards par classe et date ; modèles `Appel`+`Presence`)
- [x] **Notes & bulletins** (saisie par classe/discipline/période ; bulletin avec moyennes pondérées par coefficient)
- [x] **Cahier de texte** (contenu des séances + travail à faire par classe/discipline/date ;
      saisie admin/chef/enseignant, **consultation lecture seule** élève/parent ; modèle `CahierTexte`)
- [x] **Notifications système (in-app) — socle commun** (modèle `Notification` + helper centralisé
      `creerNotification`, cloche dans le header avec compteur non-lues, page liste, marquage lu /
      tout lu ; premier producteur branché : décisions de rôle à l'approbation/refus)
- [x] **Vues dédiées par rôle** : « Mes classes » (enseignant — classes affectées + accès direct
      appel/cahier/notes), « Ma classe » (élève — cahier de texte, notes, assiduité), « Mes enfants »
      (parent — suivi par enfant)
- [x] **Consultation des absences par parent / élève** (intégrée à « Ma classe » et « Mes enfants »
      via `src/lib/vie-scolaire/eleve.ts`)

## Phase 4 — Emplois du temps (solveur) 🟡 — module phare

- [x] Modélisation des contraintes dures (unicité enseignant/classe/salle, capacité,
      compatibilité type de salle, double vacation) — `src/lib/solveur`
- [x] **Moteur de backtracking + heuristiques** (TS natif, pas de glouton) — testé
      (scénario solvable + sur-contraintes signalées)
- [x] Modèle `Creneau` + **action de génération** (assemble le problème depuis la config,
      résout, persiste) + **affichage explicite des points de blocage**
- [x] **Affichage en grille** : vues par classe / enseignant / salle
- [x] **Ajustement par glisser-déposer** avec re-vérification des contraintes dures en temps réel
      (pré-check client instantané + revalidation serveur autoritaire ; conflits jamais validés)
- [ ] Contraintes souples avancées (score V2), indisponibilités enseignants
- [ ] Consultation par enseignant / élève / parent (vie scolaire)

## Phase 5 — CAFOP & APFC 🟡 (en cours) _(parallélisable avec 3–4, ne dépend que du RBAC)_

- [x] **Modules CAFOP (promotions) & APFC (sessions)** — modèle unifié `Cohorte` + `Apprenant`,
      centres créés par l'admin, détail par centre avec gestion des cohortes et du roster.
- [x] **Import CSV compatible Moodle** (mapping lastname/firstname/email/idnumber/institution ↔
      nom/prénoms/email/matricule/établissement ; fichier ou collage ; ajout manuel + vider).
- [x] **Rôles cafop_admin / apfc_admin opérationnels** (redirigés vers leur centre, périmètre filtré).
- [ ] Rôles chef_antenne / conseiller_pedagogique · convertisseur CSV autonome · affinage du mode Aperçu

## Phase 6 — Inspection, Rapports, Statistiques 🟡 (en cours)

- [x] **Inspection** — visites (planification, types, statuts), **comptes-rendus** (observations +
      appréciation /20), **recommandations** avec priorité et suivi de traitement ; RBAC
      inspecteur (périmètre régional) / DRENA (lecture) / admin ; notifie les chefs d'établissement.
      Modèles `Visite` + `Recommandation`.
- [ ] Rapports & Activités
- [~] Statistiques + tableaux de bord **Recharts** — livrées : **établissement** (KPI + effectifs
      par niveau, cycles, assiduité, moyennes par discipline), **par classe** (moyennes, assiduité,
      répartition des moyennes générales), **régionales** (effectifs par région / par établissement).
      Reste : analytics avancées, performance enseignants, efficacité, suivi des recommandations.

## Phase 7 — Facturation, communication & finitions ⬜

- [ ] Stripe (abonnements, webhooks, échecs de paiement, reçus)
- [x] **Communication interne** (messagerie in-app : conversations, fil, non-lus, notifie le
      destinataire via le socle) · [ ] Alertes SMS · [ ] Académie Premium
- [x] **Journal d'activité** (audit des actions sensibles, filtrable, admin) · [ ] Assistant d'installation

---

## État technique actuel

| Élément | Statut |
|---|---|
| `npm run build` | ✅ 20 routes, build vert |
| `npm run typecheck` | ✅ aucune erreur |
| Base de données **Neon** | ✅ branchée, migrée (`init`) et seedée |
| Auth de bout en bout (connexion admin) | ✅ testée contre Neon |
| Dépôt GitHub | ✅ poussé (`desirejuniorkouadio4-lab/EduWeb_Planner`) |
| Déploiement **Vercel** | ⏳ import du dépôt à faire (voir `DEPLOYMENT.md`) |

## Prochaines étapes immédiates

1. Importer le dépôt sur **Vercel** + variables d'environnement (voir `DEPLOYMENT.md`).
2. Après déploiement : changer le mot de passe admin, renseigner `AUTH_URL`/`NEXT_PUBLIC_APP_URL`.
3. (Optionnel) Clé **Resend** pour les e-mails réels.
4. Démarrer la **Phase 3 — Vie scolaire** (affectations, inscriptions, registre d'appel,
   cahier de texte, notes & bulletins, notifications).
