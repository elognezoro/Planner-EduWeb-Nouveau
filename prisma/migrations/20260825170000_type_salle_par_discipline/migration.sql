-- Salles ressources : disciplines nécessitant une salle spécialisée partagée (additif, idempotent).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "typeSalleParDiscipline" JSONB NOT NULL DEFAULT '[]';
