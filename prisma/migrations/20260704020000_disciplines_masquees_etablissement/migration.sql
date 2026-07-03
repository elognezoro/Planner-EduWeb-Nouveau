-- Particularités d'établissement : chaque établissement peut retirer des disciplines
-- de SA liste d'effectifs enseignants (sans toucher au référentiel des autres).
ALTER TABLE "etablissements"
  ADD COLUMN "disciplinesMasquees" TEXT[] NOT NULL DEFAULT '{}';
