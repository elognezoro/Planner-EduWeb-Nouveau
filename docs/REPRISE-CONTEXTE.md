# Contexte de reprise — pour Claude Code (nouvel ordinateur)

Ce document transmet le **contexte accumulé** au fil du développement (au-delà du cahier des
charges). Il remplace la « mémoire » locale et l'historique de conversation qui ne suivent pas le
dépôt. À lire en début de session sur une nouvelle machine, avec `CLAUDE.md` et `ROADMAP.md`.

> Aucun secret ici (mots de passe, clés, URLs de base restent dans `.env`, hors dépôt).

## État du projet (au 2026-07-02)

Les **8 phases** du cahier des charges sont livrées et déployées (voir `ROADMAP.md`). Le produit
est fonctionnellement complet de bout en bout. Ce qui reste = brancher 3 intégrations externes
(Resend, Stripe/Mobile Money, fournisseur SMS) — les socles sont prêts et marqués dans le code.

Réalisations notables au-delà du cahier initial : import national multi-pays (~44 000
établissements, régions par pays), sélecteur des 193 pays ONU (drapeaux + slogan/ministère
auto), matrice des droits éditable, fiche de gestion des comptes + « Voir comme » (impersonation),
solveur d'emplois du temps robuste (limite de temps, redémarrages, heuristique durée-d'abord).

## Pièges techniques Prisma 7 (importants)

1. **Pas d'`url` dans `datasource`** du schéma : la connexion runtime passe par un **driver
   adapter** `@prisma/adapter-pg` (`new PrismaPg({ connectionString })`) dans `src/lib/prisma.ts`.
2. L'URL des **migrations** est dans `prisma.config.ts` (`datasource.url`). Prisma 7 **ne charge
   plus `.env` automatiquement** → `process.loadEnvFile()` en tête de `prisma.config.ts` et de
   tout script Node (`prisma/seed.ts`, `scripts/*.mjs`). L'helper `env()` **lève** si la variable
   manque → préférer `process.env.X ?? ""`.
3. Migrations appliquées avec **`npx prisma migrate deploy`** (SQL écrit à la main sous
   `prisma/migrations/`), **pas** `migrate dev`.
4. **Next 16** : la convention `middleware` est renommée **`proxy`** (`src/proxy.ts`).

## Règle de sécurité NON négociable — cloisonnement par périmètre

Filtrage des données par périmètre = **REFUSÉ PAR DÉFAUT**. Jamais `where = {}` (= tout voir)
pour un rôle non prévu → sentinelle « aucun résultat ». Seul l'`admin` système voit tout.
Helpers centralisés dans `src/lib/rbac/scope.ts` : `filtreEtablissements`, `filtreUtilisateurs`,
`utilisateurDansPortee` — les réutiliser, **ne jamais** réécrire un if/else de périmètre par page.
Gardes des pages `[id]` : `if (u.roleReel !== "admin" && u.portee.etablissementId !== id) redirect`.
La **matrice des droits** (page Niveaux d'accès) contrôle l'ACCÈS aux pages ; le périmètre
contrôle les DONNÉES — les deux sont **indépendants**. Anti-escalade dans la gestion des comptes :
un gestionnaire d'établissement ne peut attribuer que des rôles d'établissement, jamais admin.

## Conventions de design (charte « institutionnel premium »)

Vert forêt + or ; Playfair Display (titres) + Inter ; animations **Motion** (`motion/react`).
Arrondis : cartes `rounded-3xl`, champs/boutons-icônes `rounded-2xl`, boutons d'action
`rounded-full`. Composants réutilisables : `KpiCard`, `Reveal`, `FilAriane` (fil d'Ariane),
`SelecteurPays`, `RechercheEtablissement`, graphiques **Recharts**. Libellés d'interface **en
français**. Composants serveur par défaut ; `"use client"` seulement si nécessaire.

## Pièges de vérification en local (aperçu navigateur)

- Le **screenshot d'aperçu peut timeouter en mode dev** (websocket HMR occupe le réseau) et sur
  les pages marketing (animations continues). La lecture DOM reste fiable.
- Les **inputs React contrôlés** ne captent pas une simple écriture de `.value` : pour se
  connecter en script, poser la valeur via le setter natif + `dispatchEvent(new Event('input'))`.
- **Ne jamais lancer `npm run build` pendant que le serveur dev tourne.**

## Clarifications métier à ne pas oublier

- **Académie Premium** = page d'**abonnement/facturation** (formules FCFA, codes promo, Mobile
  Money), **pas** une bibliothèque de ressources.
- **Solveur d'emplois du temps** : backtracking + heuristiques (pas de glouton). En sur-contrainte,
  afficher les points de blocage, ne jamais produire un planning incomplet en silence.
- Compte admin de test : `admin@eduweb.ci` (mot de passe communiqué hors dépôt).
- Jeu de test « parcours des rôles » sur le Lycée moderne de Cocody : voir
  `scripts/seed-test-cocody.mjs` (mot de passe commun de test défini dans le script).

## Migration / reprise

Procédure complète de changement d'ordinateur (GitHub + Neon, sans perte de données) :
`MIGRATION.md`. Scripts : `scripts/exporter-donnees.mjs` (sauvegarde),
`scripts/restaurer-donnees.mjs` (restauration ordonnée), `scripts/installer-nouveau-pc.mjs`
(installation tout-en-un).
