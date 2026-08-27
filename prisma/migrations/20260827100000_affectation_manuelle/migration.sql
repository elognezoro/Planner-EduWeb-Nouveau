-- Epinglage MANUEL enseignant<->classe<->discipline : le generateur d'EDT IMPOSE cet enseignant
-- (contrainte dure) et l'auto-affectation ne le remplace jamais. Additive, idempotente, defaut false.
ALTER TABLE "affectations_enseignant" ADD COLUMN IF NOT EXISTS "manuel" BOOLEAN NOT NULL DEFAULT false;
