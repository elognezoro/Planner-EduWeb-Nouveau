-- Verrouillage de la configuration d'établissement (additif, idempotent).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "configVerrouillee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "configVerrouilleeLe" TIMESTAMP(3);
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "configVerrouilleeParId" TEXT;
