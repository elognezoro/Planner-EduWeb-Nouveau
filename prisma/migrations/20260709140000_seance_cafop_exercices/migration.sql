-- Séance du cahier de texte CAFOP : prochaine séance (date) + sous-bloc « Exercices »
-- (résumé + lien du CAFOP en ligne, ex. https://cfpl2.eduweb.ci).
ALTER TABLE "seances_cafop"
  ADD COLUMN "prochaineSeance" TIMESTAMP(3),
  ADD COLUMN "exercices" TEXT,
  ADD COLUMN "exercicesUrl" TEXT;
