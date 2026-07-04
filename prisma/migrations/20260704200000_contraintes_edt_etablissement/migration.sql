-- Contraintes d'emploi du temps paramétrables par l'établissement :
-- 1) paramètres conditionnels de double vacation (élèves), liste flexible ;
-- 2) plages horaires d'EPS (matin / après-midi) où le solveur confine les séances d'EPS ;
-- 3) enseignants : jour de repos hebdomadaire garanti + regroupement des heures creuses.
ALTER TABLE "etablissements"
  ADD COLUMN "conditionsVacation" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "epsMatinDebut" TEXT,
  ADD COLUMN "epsMatinFin" TEXT,
  ADD COLUMN "epsApresMidiDebut" TEXT,
  ADD COLUMN "epsApresMidiFin" TEXT,
  ADD COLUMN "reposEnseignant" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "regrouperHeuresCreuses" BOOLEAN NOT NULL DEFAULT true;
