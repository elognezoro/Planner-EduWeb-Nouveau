-- Régime de notation choisi PAR ÉTABLISSEMENT (chef d'établissement) :
-- trimestriel (3), semestriel (2) ou séquentiel (6 ou 8 séquences, au choix).
-- Null = l'établissement hérite du régime de la Configuration générale.
ALTER TYPE "RegimeNotation" ADD VALUE IF NOT EXISTS 'sequence';

ALTER TABLE "etablissements"
  ADD COLUMN "regimeNotation" "RegimeNotation",
  ADD COLUMN "nbSequences" INTEGER;
