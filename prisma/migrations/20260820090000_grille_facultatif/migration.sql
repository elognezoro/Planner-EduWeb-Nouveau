-- Disciplines FACULTATIVES dans la grille horaire (ex : LV2 en 1èreC/D et TleC/D d'après la
-- Circulaire N° 0311) : proposées par le modèle national mais NON générées par défaut ; chaque
-- établissement les inclut s'il peut les assurer (surcharge locale). Migration additive idempotente.
ALTER TABLE "grilles_horaires" ADD COLUMN IF NOT EXISTS "facultatif" BOOLEAN NOT NULL DEFAULT false;
