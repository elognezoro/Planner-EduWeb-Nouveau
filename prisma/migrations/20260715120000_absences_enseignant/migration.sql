-- Autorisations d'absence des enseignants (permissions / congés) saisies par l'établissement.
-- Alimente la heatmap des absences enseignants (consultation SEDEC/SENEC + établissement).
CREATE TABLE "absences_enseignant" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "demiJournee" TEXT NOT NULL DEFAULT 'journee',
    "motif" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'autorisee',
    "saisiParId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absences_enseignant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "absences_enseignant_etablissementId_idx" ON "absences_enseignant"("etablissementId");
CREATE INDEX "absences_enseignant_enseignantId_idx" ON "absences_enseignant"("enseignantId");
CREATE INDEX "absences_enseignant_date_idx" ON "absences_enseignant"("date");

ALTER TABLE "absences_enseignant" ADD CONSTRAINT "absences_enseignant_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "absences_enseignant" ADD CONSTRAINT "absences_enseignant_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "absences_enseignant" ADD CONSTRAINT "absences_enseignant_saisiParId_fkey" FOREIGN KEY ("saisiParId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
