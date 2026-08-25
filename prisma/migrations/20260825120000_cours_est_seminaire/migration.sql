-- Marqueur « séminaire » sur un cours : figure dans la rubrique « Séminaires » de la page
-- Formations (au lieu de « Mes formations »). Additif et idempotent.
ALTER TABLE "cours" ADD COLUMN IF NOT EXISTS "estSeminaire" BOOLEAN NOT NULL DEFAULT false;
