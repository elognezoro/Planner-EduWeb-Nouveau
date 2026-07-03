-- Cahier de texte v2 : séance pédagogique complète (titre, amorce, sous-titres hiérarchiques,
-- activités, horaire, brouillon/publié) + demandes d'accès à valider (parents, conseillers…).
CREATE TYPE "StatutSeanceCahier" AS ENUM ('brouillon', 'publie');
CREATE TYPE "StatutDemandeAcces" AS ENUM ('en_attente', 'accordee', 'refusee');

ALTER TABLE "cahier_texte"
  ADD COLUMN "statut" "StatutSeanceCahier" NOT NULL DEFAULT 'publie',
  ADD COLUMN "titre" TEXT,
  ADD COLUMN "heureDebut" TEXT,
  ADD COLUMN "dureeMin" INTEGER,
  ADD COLUMN "typeActivite" TEXT,
  ADD COLUMN "amorce" TEXT,
  ADD COLUMN "sousTitres" JSONB,
  ADD COLUMN "activitesApprentissage" JSONB,
  ADD COLUMN "activitesEvaluation" JSONB,
  ADD COLUMN "prochaineSeanceLe" TIMESTAMP(3),
  ADD COLUMN "enseignantId" TEXT;

ALTER TABLE "cahier_texte" ADD CONSTRAINT "cahier_texte_enseignantId_fkey"
  FOREIGN KEY ("enseignantId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "cahier_texte_statut_idx" ON "cahier_texte"("statut");

CREATE TABLE "demandes_acces_cahier" (
    "id" TEXT NOT NULL,
    "cahierId" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "statut" "StatutDemandeAcces" NOT NULL DEFAULT 'en_attente',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteLe" TIMESTAMP(3),

    CONSTRAINT "demandes_acces_cahier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demandes_acces_cahier_cahierId_idx" ON "demandes_acces_cahier"("cahierId");
CREATE INDEX "demandes_acces_cahier_statut_idx" ON "demandes_acces_cahier"("statut");

ALTER TABLE "demandes_acces_cahier" ADD CONSTRAINT "demandes_acces_cahier_cahierId_fkey"
  FOREIGN KEY ("cahierId") REFERENCES "cahier_texte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demandes_acces_cahier" ADD CONSTRAINT "demandes_acces_cahier_demandeurId_fkey"
  FOREIGN KEY ("demandeurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
