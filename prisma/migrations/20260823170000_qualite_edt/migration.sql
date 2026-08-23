-- Rapport de qualité du dernier EDT généré : affiché en permanence tant que l'EDT existe.
-- Additive et idempotente (base = production).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "qualiteEdt" JSONB;
