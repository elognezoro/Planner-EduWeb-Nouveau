-- CreateTable : productions nominatives des participants (auto-évaluation, QCM, ateliers…)
CREATE TABLE "productions_seminaire" (
    "id" TEXT NOT NULL,
    "seminaire" TEXT NOT NULL,
    "activite" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "contenu" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productions_seminaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "productions_seminaire_seminaire_activite_utilisateurId_key" ON "productions_seminaire"("seminaire", "activite", "utilisateurId");
CREATE INDEX "productions_seminaire_seminaire_activite_idx" ON "productions_seminaire"("seminaire", "activite");
