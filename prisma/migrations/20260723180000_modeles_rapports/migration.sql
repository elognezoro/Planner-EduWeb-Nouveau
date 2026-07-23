-- Modèle PERSONNEL de rapport : la CONFIGURATION réutilisable d'un utilisateur (en-tête
-- personnalisé, sections masquées, sections libres et zones types, titre type) — jamais les
-- données d'instance. Un modèle par utilisateur et par type de rapport ("typeRapport" :
-- « crd » pour l'instant — champ générique pour étendre plus tard aux autres rapports).
-- "structure" (JSONB) est décrite par StructureModele (src/lib/inspection/rapport-disciplinaire.ts).
CREATE TABLE "modeles_rapports" (
  "id" TEXT NOT NULL,
  "typeRapport" TEXT NOT NULL,
  "proprietaireId" TEXT NOT NULL,
  "structure" JSONB NOT NULL,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "majLe" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "modeles_rapports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "modeles_rapports_proprietaireId_typeRapport_key" ON "modeles_rapports"("proprietaireId", "typeRapport");

-- Le modèle suit son propriétaire (suppression en cascade avec le compte).
ALTER TABLE "modeles_rapports"
  ADD CONSTRAINT "modeles_rapports_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
