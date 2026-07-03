-- Barème de conduite configurable PAR ÉTABLISSEMENT (points retirés/ajoutés à la note /20).
-- Les valeurs par défaut reproduisent le barème V1 : rien ne change tant que le chef
-- d'établissement n'ajuste pas son propre degré de rigueur.
ALTER TABLE "etablissements" ADD COLUMN "conduiteAbsenceNj"     DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "etablissements" ADD COLUMN "conduiteRetardNj"      DOUBLE PRECISION NOT NULL DEFAULT 0.25;
ALTER TABLE "etablissements" ADD COLUMN "conduiteObservation"   DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "etablissements" ADD COLUMN "conduiteEncouragement" DOUBLE PRECISION NOT NULL DEFAULT 0.25;
