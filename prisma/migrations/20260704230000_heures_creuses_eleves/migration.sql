-- Option du chef d'établissement : autoriser des heures creuses dans l'emploi du temps
-- des élèves (pour leur permettre de souffler) — le solveur cesse alors de les pénaliser.
ALTER TABLE "etablissements"
  ADD COLUMN "autoriserHeuresCreuses" BOOLEAN NOT NULL DEFAULT false;
