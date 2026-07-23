-- Rapport narratif d'ANTENNE (APFC) — modèles officiels « Rapport trimestriel » et « Rapport
-- annuel » du client, remplis EN LIGNE sur la page « Rapports d'antennes » : au plus UN
-- rapport par (antenne, type, période). "type" = 'trimestriel' | 'annuel' ; "periode" =
-- « 2025-2026-T1 » (trimestriel) ou « 2025-2026 » (annuel). "contenu" (JSONB) = structure
-- complète (introduction, tableaux d'activités, programmes — dont matrices par discipline —,
-- analyse, conclusion, configuration libre, en-tête) — décrite dans le module pur
-- src/lib/inspection/rapport-antenne.ts.
CREATE TABLE "rapports_antennes" (
  "id" TEXT NOT NULL,
  "apfcId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "periode" TEXT NOT NULL,
  "titre" TEXT,
  "contenu" JSONB NOT NULL,
  "rempliParId" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "majLe" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rapports_antennes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rapports_antennes_apfcId_type_periode_key" ON "rapports_antennes"("apfcId", "type", "periode");

CREATE INDEX "rapports_antennes_rempliParId_idx" ON "rapports_antennes"("rempliParId");

-- Le rapport suit son antenne (suppression en cascade avec l'APFC).
ALTER TABLE "rapports_antennes"
  ADD CONSTRAINT "rapports_antennes_apfcId_fkey" FOREIGN KEY ("apfcId") REFERENCES "apfc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Le rapport SURVIT à la suppression du compte de son rédacteur (rempliParId remis à NULL).
ALTER TABLE "rapports_antennes"
  ADD CONSTRAINT "rapports_antennes_rempliParId_fkey" FOREIGN KEY ("rempliParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
