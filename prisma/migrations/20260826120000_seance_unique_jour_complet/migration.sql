-- Réglages de génération EDT en double flux (additif, idempotent) :
--   séance unique les jours à demi-journée fermée pour tous · niveaux « un jour complet » · jours ouvrés.
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "seanceUniqueDemiFermee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "niveauxUnJourComplet" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "joursOuvres" INTEGER NOT NULL DEFAULT 5;
