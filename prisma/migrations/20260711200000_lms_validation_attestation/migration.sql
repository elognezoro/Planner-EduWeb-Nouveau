-- AlterTable : seuil de complétion configurable + champs d'attestation (additif, valeurs par défaut préservant le comportement actuel)
ALTER TABLE "cours" ADD COLUMN "seuilCompletion" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "cours" ADD COLUMN "attestationSignataire" TEXT;
ALTER TABLE "cours" ADD COLUMN "attestationFonction" TEXT;
ALTER TABLE "cours" ADD COLUMN "attestationMention" TEXT;
