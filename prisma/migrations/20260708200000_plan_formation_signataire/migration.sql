-- Signataire du plan (Directeur des Écoles, Lycées et Collèges) : prénoms, nom, cachet et signature.
ALTER TABLE "plans_formation"
  ADD COLUMN "signatairePrenoms" TEXT,
  ADD COLUMN "signataireNom" TEXT,
  ADD COLUMN "cachetUrl" TEXT,
  ADD COLUMN "signatureUrl" TEXT;
