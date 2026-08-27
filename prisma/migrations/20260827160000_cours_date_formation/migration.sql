-- Date (et heure) de la formation / du seminaire, affichee avec la duree sur les liens
-- d'inscription directe. Additive, idempotente, nullable.
ALTER TABLE "cours" ADD COLUMN IF NOT EXISTS "dateFormation" TIMESTAMP(3);
