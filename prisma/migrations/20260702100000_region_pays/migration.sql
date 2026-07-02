-- Région multi-pays : ajout du pays de rattachement et unicité (pays, nom)
ALTER TABLE "regions" ADD COLUMN "pays" TEXT NOT NULL DEFAULT 'Côte d''Ivoire';

DROP INDEX "regions_nom_key";

CREATE UNIQUE INDEX "regions_pays_nom_key" ON "regions"("pays", "nom");
