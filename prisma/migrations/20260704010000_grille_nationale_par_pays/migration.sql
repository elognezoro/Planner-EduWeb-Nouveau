-- Grille horaire NATIONALE définie par pays : chaque pays a son propre modèle par défaut
-- (les lignes d'établissement gardent le pays de leur établissement, la colonne sert
-- surtout aux lignes nationales, etablissementId NULL).
ALTER TABLE "grilles_horaires"
  ADD COLUMN "pays" TEXT NOT NULL DEFAULT 'Côte d''Ivoire';

CREATE INDEX "grilles_horaires_pays_idx" ON "grilles_horaires"("pays");
