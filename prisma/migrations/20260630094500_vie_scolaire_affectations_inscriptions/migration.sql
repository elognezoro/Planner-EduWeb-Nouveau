-- CreateTable
CREATE TABLE "affectations_enseignant" (
    "id" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affectations_enseignant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "anneeScolaireId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affectations_enseignant_classeId_idx" ON "affectations_enseignant"("classeId");

-- CreateIndex
CREATE INDEX "affectations_enseignant_enseignantId_idx" ON "affectations_enseignant"("enseignantId");

-- CreateIndex
CREATE UNIQUE INDEX "affectations_enseignant_enseignantId_classeId_disciplineId_key" ON "affectations_enseignant"("enseignantId", "classeId", "disciplineId");

-- CreateIndex
CREATE INDEX "inscriptions_classeId_idx" ON "inscriptions"("classeId");

-- CreateIndex
CREATE INDEX "inscriptions_eleveId_idx" ON "inscriptions"("eleveId");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_eleveId_anneeScolaireId_key" ON "inscriptions"("eleveId", "anneeScolaireId");

-- AddForeignKey
ALTER TABLE "affectations_enseignant" ADD CONSTRAINT "affectations_enseignant_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_enseignant" ADD CONSTRAINT "affectations_enseignant_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_enseignant" ADD CONSTRAINT "affectations_enseignant_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "annees_scolaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;
