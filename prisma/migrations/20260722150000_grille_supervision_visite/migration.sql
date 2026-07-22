-- Grille de supervision des professeurs du secondaire (référentiel officiel MENA) remplie EN
-- LIGNE pour chaque visite d'inspection : au plus UNE grille par visite (unicité sur "visiteId").
-- "reponses" = JSON { "1.1-a": "TS", … } (clé d'indicateur → code d'appréciation TS/S/P/I) ;
-- "seance" = volet « séance observée » (nature, titre, durée, effectifs) non porté par Visite ;
-- synthèse en 3 textes libres (points forts / points à améliorer / propositions du superviseur).
CREATE TABLE "grilles_supervision" (
  "id" TEXT NOT NULL,
  "visiteId" TEXT NOT NULL,
  "reponses" JSONB NOT NULL DEFAULT '{}',
  "seance" JSONB,
  "pointsForts" TEXT,
  "pointsAmeliorer" TEXT,
  "propositions" TEXT,
  "rempliParId" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "majLe" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "grilles_supervision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grilles_supervision_visiteId_key" ON "grilles_supervision"("visiteId");

CREATE INDEX "grilles_supervision_rempliParId_idx" ON "grilles_supervision"("rempliParId");

-- La grille suit sa visite (suppression en cascade).
ALTER TABLE "grilles_supervision"
  ADD CONSTRAINT "grilles_supervision_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "visites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La grille SURVIT à la suppression du compte de son rédacteur (rempliParId remis à NULL).
ALTER TABLE "grilles_supervision"
  ADD CONSTRAINT "grilles_supervision_rempliParId_fkey" FOREIGN KEY ("rempliParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
