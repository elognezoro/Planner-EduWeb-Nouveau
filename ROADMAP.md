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
- [x] **Consultation par enseignant / élève / parent** (`/app/vie-scolaire/emplois-du-temps` :
      grille hebdomadaire adaptée au rôle, sélection établissement/classe)
- [x] **Contraintes souples avancées (V2)** — **score de qualité global /100** (trous, répartition,
      heures consécutives, fin de journée, pause méridienne) + **passes d'optimisation** (déplacements
      intra-journée + échanges inter-classes, tous monotones) ; score affiché après génération.
- [x] **Créneaux horaires réels** affichés dans la grille (« 07h30 → 08h15 » au lieu de « P1 »),
      calculés depuis les horaires configurés en tenant compte des pauses.
- [x] **Placement conscient des pauses** : un cours de plusieurs périodes (2h, 1h30) ne peut plus
      chevaucher la pause mi-matinée ou méridienne (contrainte de bloc dans le solveur).
- [x] **Salles spécialisées respectées** : l'EPS se déroule sur un **plateau sportif** et
      l'informatique en salle info — jamais en salle de classe ; plateaux/labos synthétisés au besoin.
- [x] **Comptes enseignants nominatifs** générés depuis les effectifs déclarés (bouton dédié) →
      les vrais noms d'enseignants apparaissent sur l'emploi du temps ; ils pourront éditer leurs
      coordonnées. Le solveur privilégie les vrais comptes, sinon retombe sur les compteurs anonymes.
- [x] **Rendu grille** : les cours de 2h / 1h30 remplissent tout le bloc fusionné (plus de zone
      blanche trompeuse) ; **recalcul autoritaire des classes** (l'EDT reflète toujours la config).
- [ ] Indisponibilités enseignants individuelles _(désormais faisable : les comptes nominatifs
      existent ; reste à ajouter la saisie des créneaux d'indisponibilité par enseignant)_

## Phase 5 — CAFOP & APFC ✅ (livrée) _(parallélisable avec 3–4, ne dépend que du RBAC)_

- [x] **Modules CAFOP (promotions) & APFC (sessions)** — modèle unifié `Cohorte` + `Apprenant`,
      centres créés par l'admin, détail par centre avec gestion des cohortes et du roster.
- [x] **Import CSV compatible Moodle** (mapping lastname/firstname/email/idnumber/institution ↔
      nom/prénoms/email/matricule/établissement ; fichier ou collage ; ajout manuel + vider).
- [x] **Rôles cafop_admin / apfc_admin opérationnels** (redirigés vers leur centre, périmètre filtré).
- [x] **Convertisseur CSV autonome** (`/app/systeme/convertisseur-csv` : Moodle → format d'import).
- [x] **Statistiques & rapports CAFOP** + rôles **chef_antenne / conseiller_pedagogique** opérationnels
      via les pages d'inspection/rapports d'antennes (suivi par périmètre).

## Phase 6 — Inspection, Rapports, Statistiques ✅ (livrée)

- [x] **Inspection** — visites (planification, types, statuts), **comptes-rendus** (observations +
      appréciation /20), **recommandations** avec priorité et suivi de traitement ; RBAC
      inspecteur (périmètre régional) / DRENA (lecture) / admin ; notifie les chefs d'établissement.
      Modèles `Visite` + `Recommandation`. + **grille d'évaluation** (référentiel de critères).
- [x] **Rapports & Activités** — rapport d'établissement (synthèse chiffrée), rapports d'activité
      (volumétrie 30 j + journal), rapports d'inspection, rapports d'antennes (suivi par établissement),
      rapports d'antennes pédagogiques (APFC).
- [x] Statistiques + tableaux de bord **Recharts** — **établissement**, **par classe**, **régionales**,
      **analytics** (vue d'ensemble), **performance des enseignants** (moyenne encadrée), **efficacité
      pédagogique** (taux de réussite par niveau), **suivi des recommandations** (statuts d'inspection).

## Phase 7 — Facturation, communication & finitions ✅ (livrée)

- [~] **Facturation** — page admin des abonnements (`/app/systeme/facturation`) + paiement Académie
      Premium en **mode démo**. Stripe + Mobile Money (webhooks, reçus) à brancher avec les clés.
- [x] **Communication interne** (messagerie in-app : conversations, fil, non-lus, notifie le
      destinataire via le socle)
- [x] **Académie Premium** (page d'abonnement : formules FCFA par effectif, « inclus », offre
      Alertes SMS, codes promo seedés + application/demande/génération/approbation, moyens de
      paiement carte + Mobile Money, récapitulatif, **paiement en mode démo** → abonnement actif ;
      partenaires IZEN / E-School). Modèles `CodePromo`, `DemandeCodePromo`, `AbonnementPremium`.
      Passerelles de paiement réelles (Stripe + Mobile Money) à brancher avec les clés.
- [x] **Assistant d'installation** (checklist de mise en route calculée depuis l'état réel :
      année, régions, référentiels, grille nationale, établissement/classes/salles, 1er emploi du
      temps + état des intégrations Resend/Stripe/URL)
- [x] **Alertes SMS** (envoi aux parents par classe ou numéro direct : absences/notes/convocations ;
      socle d'envoi gated par `SMS_API_KEY`, repli simulé + journalisé ; historique + statuts).
      Modèle `AlerteSMS`. Fournisseur réel à brancher avec la clé.
- [x] **Journal d'activité** (audit des actions sensibles, filtrable, admin)
- [x] **Rendez-vous** (modèle `RendezVous` : demande / confirmation / refus / annulation + notifications)
- [x] **Livret scolaire** (moyennes par période et discipline ; élève et parent)

> **Statut global** : Phases 0 → 7 livrées. Toute la navigation est active (plus aucun module « à venir »).
> Restent seulement, gated par identifiants externes : passerelles de paiement réelles (Stripe + Mobile
> Money), fournisseur SMS réel, et la clé Resend pour les e-mails. Les socles sont prêts et marqués.

---

## État technique actuel (2026-07-02)

| Élément | Statut |
|---|---|
| `npm run build` | ✅ 58 routes, build vert |
| `npm run typecheck` + `eslint` | ✅ aucune erreur |
| Base de données **Neon** | ✅ branchée, migrée et seedée |
| Auth de bout en bout (connexion admin) | ✅ testée contre Neon |
| Dépôt GitHub | ✅ poussé (`desirejuniorkouadio4-lab/EduWeb_Planner`) |
| Déploiement **Vercel** | ✅ en ligne (`edu-web-planner.vercel.app`), redéploiement auto à chaque push |

## Reste à faire (tout le reste des phases 0→7 est livré)

**Bloqué par un identifiant/clé externe** (les socles sont prêts et marqués dans le code) :
1. **Resend** — clé pour l'envoi réel des e-mails (confirmation, réinitialisation). Repli console en dev.
2. **Stripe + Mobile Money** — passerelles de paiement réelles pour l'Académie Premium (aujourd'hui en mode démo « marquer payé »).
3. **Fournisseur SMS** (`SMS_API_KEY`) — envoi réel des alertes SMS (aujourd'hui simulé + journalisé).

**Évolutions produit possibles** (non bloquées, priorité au choix du porteur) :
4. **Indisponibilités individuelles des enseignants** dans le solveur (les comptes nominatifs existent désormais).
5. Écran **in-app de changement de mot de passe** (aujourd'hui via « mot de passe oublié »).
6. Poursuite de la **refonte design** page par page (dashboard admin + Comptes déjà refaits).
7. **Consultation** (vie scolaire) : fusionner l'affichage des cours multi-périodes comme dans la console de config.

## Livré le 2026-07-02 (lot administration & répertoire)

- **Répertoire national CI importé** : 2 921 établissements secondaires officiels par DRENA
  (41 régions), page Établissements avec recherche/filtres/pagination.
- **Import multi-pays** : Mali, Cameroun, Bénin, Sénégal, Niger, Burkina Faso (41 299
  établissements, régions par pays) ; sélecteurs limités aux établissements opérationnels +
  recherche à la volée pour l'affectation. Togo/Mauritanie : pas de données nominatives.
- **193 pays ONU** avec drapeaux dans la config : slogan national + ministère auto-remplis,
  intitulé officiel de l'État sur le bulletin.
- **Matrice des droits éditable** (Niveaux d'accès) : 13 rôles × 49 modules, appliquée en
  temps réel (menu + garde serveur centrale + requireRole), journalisée, réinitialisable.
- **Comptes** : fiche de gestion complète (rôle & affectation par recherche, coordonnées,
  statut, mot de passe, suppression) + actions rapides par ligne + **« Voir comme »**
  (l'admin navigue avec les données d'un utilisateur, lecture seule).
- **Config établissement** : documents officiels avec aperçu intégré ; disciplines par
  niveau ajoutables/supprimables prises en compte jusqu'à l'EDT ; liste des enseignants
  paginée (5/page).
- **Solveur** : limite de temps (25 s) avec blocage explicite, redémarrages randomisés,
  heuristique « durée d'abord » (les cours de 2h/1h30 se placent en premier) — la config
  complète de Cocody se résout en quelques secondes (712 créneaux, qualité 96/100).
