-- AlterTable : réglage admin « vérification immédiate » (bouton Vérifier par question), additif
ALTER TABLE "quiz" ADD COLUMN "verificationImmediate" BOOLEAN NOT NULL DEFAULT true;
