-- Regroupement des activités par module (tuiles de 1er rang = modules, activités en sections).
-- Additif et idempotent.
ALTER TABLE "cours" ADD COLUMN IF NOT EXISTS "modulesGroupes" BOOLEAN NOT NULL DEFAULT false;
