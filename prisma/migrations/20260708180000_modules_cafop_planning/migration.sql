-- Enrichissement des modules de formation CAFOP : code, niveau (année), semestre et jalons de planning.
ALTER TABLE "modules_cafop"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "annee" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "semestre" INTEGER,
  ADD COLUMN "dateDebut" TIMESTAMP(3),
  ADD COLUMN "dateFin" TIMESTAMP(3),
  ADD COLUMN "datePretest" TIMESTAMP(3),
  ADD COLUMN "dateEvaluation" TIMESTAMP(3);

CREATE INDEX "modules_cafop_annee_idx" ON "modules_cafop"("annee");
