-- CreateTable
CREATE TABLE "effectifs_enseignant" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "cycle" "CycleNiveau" NOT NULL,
    "nombre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "effectifs_enseignant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "effectifs_enseignant_etablissementId_idx" ON "effectifs_enseignant"("etablissementId");

-- CreateIndex
CREATE UNIQUE INDEX "effectifs_enseignant_etablissementId_disciplineId_cycle_key" ON "effectifs_enseignant"("etablissementId", "disciplineId", "cycle");

-- AddForeignKey
ALTER TABLE "effectifs_enseignant" ADD CONSTRAINT "effectifs_enseignant_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "effectifs_enseignant" ADD CONSTRAINT "effectifs_enseignant_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "disciplines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
