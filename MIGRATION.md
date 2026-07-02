# Migrer EduWeb Planner vers un nouvel ordinateur

Guide pas à pas pour **continuer le développement sur un autre ordinateur**, avec un
**nouveau compte GitHub** et une **nouvelle base Neon PostgreSQL**, en **conservant toutes les
données** (établissements importés, comptes, emplois du temps générés, etc.).

> 🟢 Facile : suis les phases dans l'ordre. Les commandes se collent telles quelles dans le
> terminal. Quand une étape se fait « sur l'ancien PC », c'est indiqué ; tout le reste se fait
> sur le **nouveau** PC. Claude Code peut exécuter pour toi toutes les commandes de ce guide —
> il te suffit de lui donner les identifiants demandés.

---

## Ce qu'il faut récupérer sur l'ANCIEN ordinateur (à faire en premier)

Sur l'ancien PC, ouvre le fichier `.env` (à la racine du projet). Il n'est **pas** dans GitHub
(volontairement, il contient des secrets). Copie ces valeurs quelque part de sûr (gestionnaire
de mots de passe, clé USB chiffrée) — tu en auras besoin :

- `DATABASE_URL` — **connexion à l'ANCIENNE base Neon** (indispensable pour copier les données).
- `DIRECT_URL` — l'autre URL Neon (sans « pooler »), utile pour la copie.
- `AUTH_SECRET` — (facultatif de le réutiliser ; sinon on en génère un nouveau).
- `RESEND_API_KEY`, `STRIPE_*`, `BLOB_READ_WRITE_TOKEN`, `SMS_API_KEY` — si tu les avais
  renseignés et veux garder les mêmes intégrations. Sinon, laisse vides pour l'instant.

> ⚠️ Ne mets JAMAIS ces valeurs dans GitHub ni dans un message public.

---

## Phase 0 — Installer les outils sur le NOUVEAU PC

1. **Node.js 20 ou plus récent** — https://nodejs.org (choisir « LTS »). Vérifier : `node --version`.
2. **Git** — https://git-scm.com. Vérifier : `git --version`.
3. **Claude Code** — comme sur l'ancien PC.
4. **Client PostgreSQL** (fournit `pg_dump` et `psql`, pour copier la base) :
   - Windows : `winget install PostgreSQL.PostgreSQL.17`
   - macOS : `brew install libpq` puis suivre l'indication d'ajout au PATH (ou `brew install postgresql@17`)
   - Vérifier : `pg_dump --version` (doit afficher 16 ou 17).

---

## Phase A — Récupérer le code sur le nouveau compte GitHub

Objectif : cloner le projet existant (avec tout son historique), puis le pousser vers un
**nouveau dépôt** sur le **nouveau compte GitHub**.

1. **Créer un dépôt vide** sur le nouveau compte GitHub : bouton « New », nomme-le
   (ex. `eduweb-planner`), **ne coche NI README NI .gitignore NI licence** (dépôt strictement vide),
   puis « Create repository ». Note l'URL affichée, du type
   `https://github.com/NOUVEAU-COMPTE/eduweb-planner.git`.

2. **Cloner l'ancien dépôt** sur le nouveau PC (dossier de travail au choix) :
   ```bash
   git clone https://github.com/desirejuniorkouadio4-lab/EduWeb_Planner.git eduweb-planner
   cd eduweb-planner
   ```
   > Si l'ancien dépôt est privé, GitHub demandera une connexion : utilise **une seule fois**
   > les identifiants de l'ancien compte (ou son « token »). Le code arrive avec tout l'historique.

3. **Faire pointer le projet vers ton NOUVEAU dépôt** :
   ```bash
   git remote set-url origin https://github.com/NOUVEAU-COMPTE/eduweb-planner.git
   git push -u origin main
   ```
   > Ici, connecte-toi avec le **nouveau** compte GitHub (une fenêtre s'ouvre, ou colle un
   > « Personal Access Token » créé dans GitHub → Settings → Developer settings → Tokens).
   > Après ça, `git push` enverra toujours vers le nouveau dépôt.

✅ À ce stade, tout le code + l'historique sont sur ton nouveau compte GitHub.

---

## Phase B — Copier la base de données vers un nouveau Neon (garde toutes les données)

**Créer la nouvelle base Neon** : sur https://neon.tech, « New Project ». Ouvre
**Connection Details** et récupère **deux** chaînes :
- la connexion **pooled** (par défaut) → deviendra `DATABASE_URL`
- la connexion **direct / unpooled** (bouton « Direct connection ») → deviendra `DIRECT_URL`

Ensuite, deux méthodes au choix. **La méthode 1 est recommandée** : rien à installer, et un
fichier de sauvegarde `sauvegarde-eduweb.json` a déjà été préparé pour toi (à copier depuis
l'ancien PC sur une clé USB, puis à déposer à la racine du projet sur le nouveau PC).

### Méthode 1 — Fichier de sauvegarde + script (recommandée, aucun outil à installer)

Ces deux commandes se lancent sur le NOUVEAU PC, une fois le `.env` créé (Phase C) avec la
**nouvelle** base :

```bash
npx prisma migrate deploy          # crée les tables (schéma) dans la base vide
node scripts/restaurer-donnees.mjs # réinjecte toutes les données depuis sauvegarde-eduweb.json
```

Le script insère les tables dans le bon ordre (dépendances) et refuse de s'exécuter si la base
n'est pas vide. À la fin, il affiche le nombre de lignes restaurées.

> Pour (re)générer la sauvegarde depuis l'ancienne base à tout moment :
> `node scripts/exporter-donnees.mjs` (à lancer avec l'ANCIENNE `DATABASE_URL` dans `.env`).

### Méthode 2 — pg_dump / psql (alternative, nécessite le client PostgreSQL)

```bash
pg_dump "ANCIENNE_DIRECT_URL" --no-owner --no-privileges --no-acl -f sauvegarde-eduweb.sql
psql "NOUVELLE_DIRECT_URL" -f sauvegarde-eduweb.sql
```
Cette méthode copie aussi le schéma et l'historique des migrations : dans ce cas, **saute**
`prisma migrate deploy` (déjà fait par le dump).

✅ Dans les deux cas, la nouvelle base contient ensuite exactement les mêmes données que
l'ancienne.

---

## Phase C — Créer le fichier `.env` sur le nouveau PC

À la racine du projet, crée un fichier nommé `.env` (Claude Code peut le faire) avec ce contenu,
en remplaçant les valeurs :

```dotenv
# Base Neon — NOUVELLE base (Phase B)
DATABASE_URL="NOUVELLE_URL_POOLED"
DIRECT_URL="NOUVELLE_URL_DIRECT"

# Auth.js — génère un secret : npx auth secret  (ou réutilise l'ancien AUTH_SECRET)
AUTH_SECRET="colle-ici-un-secret-long-et-aleatoire"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Compte admin — SEULEMENT utile si tu relances le seed (inutile ici : les données sont restaurées).
# Reprends les mêmes valeurs que sur l'ancien PC (voir l'ancien .env).
ADMIN_EMAIL="admin@eduweb.ci"
ADMIN_PASSWORD="reprendre-la-valeur-de-l-ancien-.env"

# Intégrations optionnelles — laisse vide si non utilisées pour l'instant
RESEND_API_KEY=""
EMAIL_FROM="EduWeb Planner <no-reply@exemple.ci>"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
SMS_API_KEY=""
# Nécessaire UNIQUEMENT pour téléverser de nouveaux logos/cachets (Vercel Blob)
BLOB_READ_WRITE_TOKEN=""
```

> `.env` est ignoré par Git : il ne partira jamais sur GitHub, c'est voulu.

---

## Phase D — Lancer le projet en local

Depuis le dossier du projet :

```bash
npm install
npx prisma generate
npm run dev
```

Ouvre http://localhost:3000. Connecte-toi avec le **compte admin** (mêmes e-mail et mot de passe
que sur l'ancien PC — ils viennent de la base restaurée). Tu retrouves l'application avec
**toutes tes données**.

Vérification rapide que la base est bien branchée : `npx prisma migrate status` doit dire que la
base est à jour (« Database schema is up to date »).

---

## Phase E (optionnelle) — Redéployer en ligne sur Vercel

Seulement si tu veux une version en ligne (le développement local marche sans ça).

1. Sur https://vercel.com, « Add New → Project », importe ton **nouveau dépôt GitHub**.
2. Dans **Settings → Environment Variables**, ajoute les mêmes clés que le `.env` :
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, et mets `AUTH_URL` + `NEXT_PUBLIC_APP_URL` à
   l'URL Vercel (ex. `https://mon-projet.vercel.app`). Ajoute les autres clés si tu les utilises.
3. Déploie. Le build lance automatiquement `prisma migrate deploy` (script `vercel-build`) —
   comme le schéma est déjà à jour, ça ne change rien aux données.

---

## Bon à savoir

- **Images déjà téléversées** (emblèmes, logos, cachets, signatures) : elles restent affichées,
  car leur URL complète est stockée en base et pointe vers l'ancien stockage Vercel Blob. Pour
  **téléverser de NOUVEAUX** fichiers, il faut un `BLOB_READ_WRITE_TOKEN` (Vercel → Storage → Blob).
- **Ne supprime pas** l'ancien projet Neon ni l'ancien dépôt tant que tu n'as pas vérifié que le
  nouveau fonctionne (connexion admin + données présentes).
- **Sécurité** : garde `sauvegarde-eduweb.sql` et le fichier `.env` privés (ils contiennent des
  données et des secrets). Ne les committe jamais.
- Détails techniques du projet : voir `CLAUDE.md`, `ROADMAP.md` et `DEPLOYMENT.md`.
