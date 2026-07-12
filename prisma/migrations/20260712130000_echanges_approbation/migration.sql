-- Fil de discussion entre l'administration et le demandeur d'un rôle (page « Approbations »).
CREATE TABLE "echanges_approbation" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "duDemandeur" BOOLEAN NOT NULL DEFAULT false,
    "contenu" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "echanges_approbation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "echanges_approbation_demandeId_creeLe_idx" ON "echanges_approbation"("demandeId", "creeLe");

ALTER TABLE "echanges_approbation" ADD CONSTRAINT "echanges_approbation_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "echanges_approbation" ADD CONSTRAINT "echanges_approbation_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
