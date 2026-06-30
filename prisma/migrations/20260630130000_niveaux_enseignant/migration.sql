-- CreateTable
CREATE TABLE "niveaux_enseignant" (
    "id" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "niveauId" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,

    CONSTRAINT "niveaux_enseignant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "niveaux_enseignant_etablissementId_idx" ON "niveaux_enseignant"("etablissementId");

-- CreateIndex
CREATE UNIQUE INDEX "niveaux_enseignant_enseignantId_niveauId_key" ON "niveaux_enseignant"("enseignantId", "niveauId");

-- AddForeignKey
ALTER TABLE "niveaux_enseignant" ADD CONSTRAINT "niveaux_enseignant_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveaux_enseignant" ADD CONSTRAINT "niveaux_enseignant_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "niveaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveaux_enseignant" ADD CONSTRAINT "niveaux_enseignant_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
