-- Cloture des inscriptions d'une formation : passe cette date, les liens d'inscription
-- directe sont fermes. Additive, idempotente, nullable.
ALTER TABLE "cours" ADD COLUMN IF NOT EXISTS "dateLimiteInscription" TIMESTAMP(3);
