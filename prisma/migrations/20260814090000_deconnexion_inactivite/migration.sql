-- Déconnexion automatique après inactivité (paramètre global réglé par l'admin système).
-- Additive et idempotente : appliquée par « prisma migrate deploy » au déploiement (vercel-build).
ALTER TABLE "configuration" ADD COLUMN IF NOT EXISTS "inactiviteDeconnexionActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "configuration" ADD COLUMN IF NOT EXISTS "inactiviteDelaiMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "configuration" ADD COLUMN IF NOT EXISTS "inactiviteAvertissementSecondes" INTEGER NOT NULL DEFAULT 60;
