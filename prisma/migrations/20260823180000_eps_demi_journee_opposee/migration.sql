-- EPS isolée dans la demi-journée opposée (double vacation) : réglage du chef d'établissement.
-- Additive et idempotente (base = production).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "epsDemiJourneeOpposee" BOOLEAN NOT NULL DEFAULT false;
-- Salle attitrée par classe (réduire les déplacements des élèves — une salle physique sert
-- la classe du matin ET celle de l'après-midi en double vacation).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "salleFixeParClasse" BOOLEAN NOT NULL DEFAULT false;
