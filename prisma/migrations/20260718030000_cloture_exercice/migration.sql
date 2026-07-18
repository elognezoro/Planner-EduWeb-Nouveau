-- Phase 3 : clôture d'exercice (à-nouveaux) — les écritures antérieures sont verrouillées.
CREATE TABLE "clotures_exercice" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "finPeriode" TIMESTAMP(3) NOT NULL,
    "resultat" INTEGER NOT NULL,
    "soldes" JSONB NOT NULL,
    "notes" TEXT,
    "clotureParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clotures_exercice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clotures_exercice_etablissementId_exercice_key" ON "clotures_exercice"("etablissementId", "exercice");
ALTER TABLE "clotures_exercice" ADD CONSTRAINT "clotures_exercice_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
