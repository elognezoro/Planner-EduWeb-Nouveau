-- Compétence territoriale d'une antenne (APFC) sur les établissements de sa zone : un
-- établissement ne relève que d'UNE seule APFC (unicité sur etablissementId). Alimente le bloc
-- « Établissements couverts » de la fiche APFC (saisie manuelle par recherche + import CSV).
CREATE TABLE "couvertures_apfc" (
  "id" TEXT NOT NULL,
  "apfcId" TEXT NOT NULL,
  "etablissementId" TEXT NOT NULL,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "couvertures_apfc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "couvertures_apfc_etablissementId_key" ON "couvertures_apfc"("etablissementId");

CREATE INDEX "couvertures_apfc_apfcId_idx" ON "couvertures_apfc"("apfcId");

ALTER TABLE "couvertures_apfc"
  ADD CONSTRAINT "couvertures_apfc_apfcId_fkey" FOREIGN KEY ("apfcId") REFERENCES "apfc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "couvertures_apfc"
  ADD CONSTRAINT "couvertures_apfc_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
