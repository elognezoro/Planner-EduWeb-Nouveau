-- Salle attitrée : règle dure/souple (additif, idempotent, défaut false = dure = comportement actuel).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "salleAttribueeSouple" BOOLEAN NOT NULL DEFAULT false;
