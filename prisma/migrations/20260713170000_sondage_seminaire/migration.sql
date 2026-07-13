-- AlterTable : formateurs habilités d'un séminaire (e-mails)
ALTER TABLE "config_seminaires" ADD COLUMN "formateurs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable : réponses nominatives aux activités de sondage
CREATE TABLE "reponses_sondage" (
    "id" TEXT NOT NULL,
    "seminaire" TEXT NOT NULL,
    "activite" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "mot" TEXT,
    "idee" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reponses_sondage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reponses_sondage_seminaire_activite_utilisateurId_key" ON "reponses_sondage"("seminaire", "activite", "utilisateurId");
CREATE INDEX "reponses_sondage_seminaire_activite_idx" ON "reponses_sondage"("seminaire", "activite");

-- CreateTable : état de partage d'une activité de sondage (piloté par le formateur)
CREATE TABLE "etats_sondage" (
    "id" TEXT NOT NULL,
    "seminaire" TEXT NOT NULL,
    "activite" TEXT NOT NULL,
    "nuagePartage" BOOLEAN NOT NULL DEFAULT false,
    "ideesOuvertes" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etats_sondage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etats_sondage_seminaire_activite_key" ON "etats_sondage"("seminaire", "activite");
