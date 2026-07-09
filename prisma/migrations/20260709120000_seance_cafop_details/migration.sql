-- Enrichissement des séances du cahier de texte CAFOP :
-- cascade thème/discipline, horaires, sous-titres hiérarchisés et objectifs.
ALTER TABLE "seances_cafop"
  ADD COLUMN "theme" TEXT,
  ADD COLUMN "discipline" TEXT,
  ADD COLUMN "heureDebut" TEXT,
  ADD COLUMN "heureFin" TEXT,
  ADD COLUMN "sousTitres" JSONB,
  ADD COLUMN "objectifs" JSONB;
