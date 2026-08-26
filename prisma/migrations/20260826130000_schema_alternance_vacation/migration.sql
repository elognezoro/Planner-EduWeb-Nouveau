-- Schéma d'alternance de la vacation (additif, idempotent).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "schemaAlternanceVacation" TEXT NOT NULL DEFAULT 'quotidienne';
