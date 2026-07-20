-- Fiche de configuration de l'APFC : chef d'antenne + documents officiels (Vercel Blob) — même
-- mécanisme que la fiche du CAFOP (cafops.emblemeUrl/logoUrl/cachetUrl/signatureUrl), sans le
-- champ emblème (armoiries du pays affichées automatiquement, pas de dépôt personnalisé pour l'APFC).
ALTER TABLE "apfc" ADD COLUMN "chefAntenneNom" TEXT;
ALTER TABLE "apfc" ADD COLUMN "chefAntennePrenoms" TEXT;
ALTER TABLE "apfc" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "apfc" ADD COLUMN "cachetUrl" TEXT;
ALTER TABLE "apfc" ADD COLUMN "signatureUrl" TEXT;

-- Annuaire du personnel de l'APFC selon le profil disciplinaire (miroir de enseignants_cafop,
-- avec fonction + disciplines multiples + coordonnées).
CREATE TABLE "personnel_apfc" (
  "id" TEXT NOT NULL,
  "apfcId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "prenoms" TEXT,
  "fonction" TEXT,
  "disciplines" JSONB,
  "email" TEXT,
  "telephone" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personnel_apfc_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personnel_apfc_apfcId_idx" ON "personnel_apfc"("apfcId");

ALTER TABLE "personnel_apfc"
  ADD CONSTRAINT "personnel_apfc_apfcId_fkey" FOREIGN KEY ("apfcId") REFERENCES "apfc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
