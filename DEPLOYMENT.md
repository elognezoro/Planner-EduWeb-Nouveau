# Déploiement — EduWeb Planner

Déploiement sur **Vercel** avec base **PostgreSQL Neon**. Aucun secret n'est versionné :
les valeurs réelles se renseignent dans les variables d'environnement Vercel (et `.env` en local).

## 1. Base de données (Neon)

Le schéma est géré par Prisma. La première migration est déjà présente dans
[`prisma/migrations/`](prisma/migrations). Pour (re)synchroniser une base :

```bash
npm run db:migrate   # applique les migrations (dev)
npm run db:seed      # rôles, admin, régions, niveaux, disciplines, grille nationale
```

En production, le script **`vercel-build`** exécute automatiquement `prisma migrate deploy`
avant le build, donc les migrations en attente sont appliquées à chaque déploiement.

## 2. Import du projet sur Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project**.
2. **Import Git Repository** → autoriser GitHub si nécessaire → sélectionner
   `EduWeb_Planner`.
3. Framework détecté automatiquement : **Next.js** (laisser les réglages par défaut ;
   Vercel utilise le script `vercel-build`).
4. Renseigner les **variables d'environnement** (section suivante).
5. **Deploy**.

## 3. Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DATABASE_URL` | Neon, endpoint *pooled*, `sslmode=require` (sans `channel_binding`) | ✅ |
| `DIRECT_URL` | Neon, endpoint *direct* (migrations) | ✅ |
| `AUTH_SECRET` | Secret Auth.js (`npx auth secret`) | ✅ |
| `AUTH_URL` | URL publique du déploiement (ex : `https://eduweb-planner.vercel.app`) | recommandé |
| `NEXT_PUBLIC_APP_URL` | Même URL — utilisée dans les liens e-mail | recommandé |
| `RESEND_API_KEY` | E-mails transactionnels (sinon e-mails *simulés*) | optionnel |
| `EMAIL_FROM` | Adresse expéditrice vérifiée Resend | optionnel |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Facturation (Phase 7) | optionnel |

> ⚠️ `DATABASE_URL` utilise l'endpoint **pooled** sans `channel_binding=require`
> (non géré par le driver `pg`). `DIRECT_URL` utilise l'endpoint **direct**.

## 4. Après le premier déploiement

1. Récupérer l'URL Vercel, renseigner `AUTH_URL` et `NEXT_PUBLIC_APP_URL`, puis redéployer.
2. Se connecter avec le compte administrateur initial créé par le seed, **puis changer son
   mot de passe** et créer les comptes réels.
3. (Optionnel) configurer Resend pour l'envoi réel des e-mails.

## 5. Redéploiements

Chaque `git push` sur `main` déclenche un redéploiement automatique sur Vercel.
