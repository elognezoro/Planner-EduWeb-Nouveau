-- CreateTable
CREATE TABLE "creneaux" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "classeNom" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "disciplineNom" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "enseignantNom" TEXT NOT NULL,
    "salleNom" TEXT NOT NULL,
    "jour" INTEGER NOT NULL,
    "periode" INTEGER NOT NULL,
    "duree" INTEGER NOT NULL DEFAULT 1,
    "anneeScolaireId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creneaux_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creneaux_etablissementId_idx" ON "creneaux"("etablissementId");

-- CreateIndex
CREATE INDEX "creneaux_classeId_idx" ON "creneaux"("classeId");

-- AddForeignKey
ALTER TABLE "creneaux" ADD CONSTRAINT "creneaux_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
