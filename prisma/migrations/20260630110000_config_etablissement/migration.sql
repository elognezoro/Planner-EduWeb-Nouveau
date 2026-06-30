-- AlterTable
ALTER TABLE "etablissements" ADD COLUMN     "anneeScolaire" TEXT,
ADD COLUMN     "cachetUrl" TEXT,
ADD COLUMN     "creneauxParJour" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "effectifSouhaiteParClasse" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "emblemeUrl" TEXT,
ADD COLUMN     "fonctionChef" TEXT,
ADD COLUMN     "horaireDebutMatin" TEXT DEFAULT '07:30',
ADD COLUMN     "horaireFinJournee" TEXT DEFAULT '18:00',
ADD COLUMN     "horairePauseMatinDebut" TEXT DEFAULT '09:45',
ADD COLUMN     "horairePauseMatinFin" TEXT DEFAULT '10:05',
ADD COLUMN     "horairePauseMidiDebut" TEXT DEFAULT '12:00',
ADD COLUMN     "horaireRepriseApresMidi" TEXT DEFAULT '15:00',
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "ministere" TEXT,
ADD COLUMN     "nbSallesDisponibles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nomChef" TEXT,
ADD COLUMN     "pays" TEXT DEFAULT 'Côte d''Ivoire',
ADD COLUMN     "planRapport" TEXT,
ADD COLUMN     "presentationRapport" TEXT DEFAULT 'Accordéon',
ADD COLUMN     "signatureUrl" TEXT,
ADD COLUMN     "sloganBulletin" TEXT DEFAULT 'Union – Discipline – Travail';

-- AlterTable
ALTER TABLE "grilles_horaires" ADD COLUMN     "seancesMinutes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "niveaux_etablissement" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "niveauId" TEXT NOT NULL,
    "effectif" INTEGER NOT NULL DEFAULT 0,
    "vacation" "RegimeVacation" NOT NULL DEFAULT 'simple',
    "nbClasses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "niveaux_etablissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "champs_enseignant" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "etiquette" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "placeholder" TEXT,
    "requis" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "champs_enseignant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competences_enseignant" (
    "id" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,

    CONSTRAINT "competences_enseignant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "niveaux_etablissement_etablissementId_idx" ON "niveaux_etablissement"("etablissementId");

-- CreateIndex
CREATE UNIQUE INDEX "niveaux_etablissement_etablissementId_niveauId_key" ON "niveaux_etablissement"("etablissementId", "niveauId");

-- CreateIndex
CREATE INDEX "champs_enseignant_etablissementId_idx" ON "champs_enseignant"("etablissementId");

-- CreateIndex
CREATE INDEX "competences_enseignant_etablissementId_idx" ON "competences_enseignant"("etablissementId");

-- CreateIndex
CREATE UNIQUE INDEX "competences_enseignant_enseignantId_disciplineId_key" ON "competences_enseignant"("enseignantId", "disciplineId");

-- AddForeignKey
ALTER TABLE "niveaux_etablissement" ADD CONSTRAINT "niveaux_etablissement_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveaux_etablissement" ADD CONSTRAINT "niveaux_etablissement_niveauId_fkey" FOREIGN KEY ("niveauId") REFERENCES "niveaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champs_enseignant" ADD CONSTRAINT "champs_enseignant_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competences_enseignant" ADD CONSTRAINT "competences_enseignant_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competences_enseignant" ADD CONSTRAINT "competences_enseignant_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "disciplines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competences_enseignant" ADD CONSTRAINT "competences_enseignant_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
