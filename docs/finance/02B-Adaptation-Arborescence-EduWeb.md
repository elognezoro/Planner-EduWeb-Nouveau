# Adaptation de l'arborescence au dépôt EduWeb Planner
## Module Finance — document d'application du 02A

Version : 1.0 — Statut : règle d'implémentation officielle (complète le 02A, ne le remplace pas)

---

# Justification explicite (exigée par le 02A)

Le 02A décrit un monorepo autonome (`finance/` avec `apps/api` NestJS, `apps/web`, Docker,
Redis, CI GitHub dédiée). Or le module Finance est développé À L'INTÉRIEUR du dépôt existant
d'EduWeb Planner, dont la stack est non négociable (CLAUDE.md à la racine) : monolithe
Next.js App Router + Server Actions, Auth.js, PostgreSQL Neon + Prisma (migrations
manuscrites, base de production), Vercel (build + déploiement + Blob). Créer le monorepo du
02A dupliquerait l'authentification, le RBAC, le schéma Prisma et le pipeline de déploiement,
en contradiction avec les principes « une seule source de vérité » et « intégration native »
des documents 00 et 01.

L'arborescence du 02A est donc TRANSPOSÉE comme suit — les PRINCIPES (Feature First, un
sous-module = un dossier, domaine sans framework, aucune règle métier dans la présentation)
restent obligatoires ; seuls les chemins changent.

---

# Table de transposition

| 02A (monorepo `finance/`) | Dépôt EduWeb Planner |
|---|---|
| `apps/api/src/modules/finance/<sous-module>/` | `src/lib/finances/<sous-module>/` — domaine PUR (entités TypeScript, validations, calculs, événements internes) sans dépendance Next.js |
| `controller/` (API REST) | Server Actions `src/app/app/economat/<page>/actions.ts` (mutations) + Route Handlers `route.ts` (documents/exports) — aucune règle métier, appel du domaine uniquement |
| `usecases/` | Une action serveur = un cas d'utilisation (nommage français : `enregistrerPaiement`, `cloturerCaisse`…) |
| `repository/` (aucun SQL dans les services) | Accès Prisma isolé dans le domaine serveur (`src/lib/finances/<sous-module>/serveur.ts`) — jamais de requête Prisma dans un composant de présentation |
| `dto/` + `validators/` | Types + fonctions de validation du module de domaine (bornage serveur systématique, patron existant du projet) |
| `events/` | Propagation transactionnelle (`prisma.$transaction`) : un paiement crée reçu + écritures + soldes + audit dans LA MÊME transaction (garanties du 02 sans bus externe) |
| `shared/` | `src/lib/finances/commun/` (constantes, énumérations, helpers partagés du module) |
| `apps/web/pages/finance/*` | Pages `src/app/app/economat/<sous-module>/page.tsx` (section Économat de la navigation) — les pages historiques `vie-scolaire/finances` migrent progressivement |
| `components/finance/*` | `src/components/finances/` (cartes, tableaux, formulaires, graphiques) |
| `hooks/`, `services/` frontend | Composants clients + Server Actions typées (pas de couche service HTTP côté client) |
| `prisma/` dédié | LE `prisma/schema.prisma` unique du dépôt + migrations manuscrites `prisma/migrations/<horodatage>_<nom>/` (base = production : jamais `migrate dev`) |
| `docker/`, `redis/`, `nginx/` | Sans objet — Vercel (build, déploiement) ; cache = rendu Next.js + `revalidatePath` |
| `.github/workflows` | Pipeline existant : push sur `main` → build Vercel (statut GitHub) — vérifications locales obligatoires avant push : `prisma validate`, `prisma generate`, `tsc --noEmit`, `eslint src --quiet`, `npm run build` |
| `tests/` | `npm run typecheck` + lint + build systématiques ; tests ciblés au fil des specs (28-Tests.md) |
| Git `develop`/`feature/*` | Flux délégué en vigueur : commits atomiques sur `main`, messages descriptifs en français (délégation git/Vercel du client) |

---

# Conventions retenues

- Dossiers en kebab-case français : `frais-scolarite/`, `comptes-eleves/`, `caisses/`,
  `banques/`, `depenses/`, `fournisseurs/`, `achats/`, `stocks/`, `articles/`, `ventes/`,
  `budgets/`, `immobilisations/`, `comptabilite/`, `rapports/`, `tableau-de-bord/`,
  `audit/`, `parametrage/` — correspondance 1-à-1 avec les sous-modules du 02A.
- L'interface étant 100 % en français (règle projet), les identifiants de code suivent le
  français du dépôt (pas de suffixes `Dto`/`UseCase` anglais) ; les suffixes du 02A sont
  réputés satisfaits par les rôles équivalents ci-dessus.
- Interdits inchangés du 02A : règle métier dans la présentation, SQL hors du domaine
  serveur, contournement de couches, imports croisés entre sous-modules (passer par
  `commun/` ou les interfaces du domaine).

---

# Portée

Ce document fait foi pour TOUTE implémentation du module Finance dans ce dépôt. En cas de
divergence entre le 02A et le présent document, le présent document s'applique au dépôt
EduWeb Planner ; le 02A reste la référence si le module est un jour extrait en service
autonome (« Architecture cible » du 02).
