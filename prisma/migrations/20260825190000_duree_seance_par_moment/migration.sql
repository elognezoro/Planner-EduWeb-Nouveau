-- Durée élémentaire de séance par moment (matin / après-midi) — additif, idempotent, défaut 55 min.
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "dureeSeanceMatin" INTEGER NOT NULL DEFAULT 55;
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "dureeSeanceApresMidi" INTEGER NOT NULL DEFAULT 55;
