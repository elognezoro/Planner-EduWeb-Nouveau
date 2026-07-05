-- Volume horaire hebdomadaire dû par enseignant (plafond de service dans le solveur EDT).
ALTER TABLE "etablissements"
  ADD COLUMN "volumeHoraire1erCycle" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "volumeHoraire2ndCycle" INTEGER NOT NULL DEFAULT 0;
