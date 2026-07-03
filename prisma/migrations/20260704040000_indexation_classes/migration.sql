-- Indexation des classes pédagogiques au calcul : « @ » = indices en lettres
-- (6ème A, 6ème B…), « # » = indices numériques (6ème 1, 6ème 2…). Choix par établissement.
ALTER TABLE "etablissements"
  ADD COLUMN "indexationClasses" TEXT NOT NULL DEFAULT '@';
