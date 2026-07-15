-- CreateTable : demandes d'autorisation d'absence (workflow demande → décision → fiche)
CREATE TABLE "demandes_absence" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "estEnseignant" BOOLEAN NOT NULL DEFAULT false,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "classesAffectees" JSONB,
    "nbSeancesAffectees" INTEGER NOT NULL DEFAULT 0,
    "avecSuppleance" BOOLEAN NOT NULL DEFAULT false,
    "suppleants" JSONB,
    "datesRattrapage" JSONB,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "decisionParId" TEXT,
    "decisionLe" TIMESTAMP(3),
    "motifDecision" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demandes_absence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demandes_absence_etablissementId_idx" ON "demandes_absence"("etablissementId");
CREATE INDEX "demandes_absence_demandeurId_idx" ON "demandes_absence"("demandeurId");
CREATE INDEX "demandes_absence_statut_idx" ON "demandes_absence"("statut");

-- AlterTable : lien optionnel absence → demande d'origine
ALTER TABLE "absences_enseignant" ADD COLUMN "demandeAbsenceId" TEXT;
CREATE INDEX "absences_enseignant_demandeAbsenceId_idx" ON "absences_enseignant"("demandeAbsenceId");

-- AddForeignKey
ALTER TABLE "demandes_absence" ADD CONSTRAINT "demandes_absence_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demandes_absence" ADD CONSTRAINT "demandes_absence_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demandes_absence" ADD CONSTRAINT "demandes_absence_decisionParId_fkey" FOREIGN KEY ("decisionParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "absences_enseignant" ADD CONSTRAINT "absences_enseignant_demandeAbsenceId_fkey" FOREIGN KEY ("demandeAbsenceId") REFERENCES "demandes_absence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
