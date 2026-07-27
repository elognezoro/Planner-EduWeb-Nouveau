-- Double authentification (2FA) par e-mail — Étape 1.
-- Écrite à la main (la base est la PRODUCTION) ; appliquée par `prisma migrate deploy`
-- dans vercel-build. Aucune donnée n'est modifiée : uniquement des ajouts de valeurs
-- d'énumération et de colonnes avec valeurs par défaut sûres.

-- Nouveaux types de jetons (codes 2FA). ADD VALUE ne réutilise pas la valeur dans la
-- même transaction : sans risque ici (aucune donnée insérée avec ces valeurs).
ALTER TYPE "TypeJeton" ADD VALUE IF NOT EXISTS 'connexion_2fa';
ALTER TYPE "TypeJeton" ADD VALUE IF NOT EXISTS 'activation_2fa';

-- Compteur de tentatives erronées sur un jeton (borne la force brute d'un code à 6 chiffres).
ALTER TABLE "jetons" ADD COLUMN IF NOT EXISTS "tentatives" INTEGER NOT NULL DEFAULT 0;

-- Préférence 2FA par utilisateur (désactivée par défaut ; canal « email » par défaut).
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "deuxFacteursActif" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "deuxFacteursMethode" TEXT NOT NULL DEFAULT 'email';
