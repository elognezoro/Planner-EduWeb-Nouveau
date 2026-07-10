-- Annuaire des enseignants d'un CAFOP (nom, prénoms, discipline), géré dans « Gestion des CAFOP ».
CREATE TABLE "enseignants_cafop" (
  "id" TEXT NOT NULL,
  "cafopId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "prenoms" TEXT,
  "discipline" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enseignants_cafop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "enseignants_cafop_cafopId_idx" ON "enseignants_cafop"("cafopId");

ALTER TABLE "enseignants_cafop"
  ADD CONSTRAINT "enseignants_cafop_cafopId_fkey" FOREIGN KEY ("cafopId") REFERENCES "cafops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
