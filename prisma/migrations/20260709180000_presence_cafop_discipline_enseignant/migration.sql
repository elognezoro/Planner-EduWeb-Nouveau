-- Contexte de séance au registre d'appel CAFOP : discipline (plan de formation)
-- et enseignant (compte « enseignant » du centre) enregistrés avec l'appel.
ALTER TABLE "presences_cafop"
  ADD COLUMN "discipline" TEXT,
  ADD COLUMN "enseignantId" TEXT;

CREATE INDEX "presences_cafop_enseignantId_idx" ON "presences_cafop"("enseignantId");
