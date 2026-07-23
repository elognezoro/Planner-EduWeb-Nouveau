-- Rapport bilan narratif de la Coordination Régionale Disciplinaire (CRD) d'une antenne APFC
-- (modèle officiel « Rapport bilan CRD » fourni par le client), rempli EN LIGNE sur la page
-- « Rapports Pédagogiques Disciplinaires » : au plus UN rapport par couple (antenne, discipline).
-- "contenu" (JSONB) = structure complète du rapport : membres, introduction, tableaux d'activités
-- et de programmes (lignes/valeurs), analyse en 3 volets, conclusion, coordinateur — structure
-- décrite dans le module pur src/lib/inspection/rapport-disciplinaire.ts.
CREATE TABLE "rapports_disciplinaires" (
  "id" TEXT NOT NULL,
  "apfcId" TEXT NOT NULL,
  "discipline" TEXT NOT NULL,
  "titre" TEXT,
  "contenu" JSONB NOT NULL,
  "rempliParId" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "majLe" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rapports_disciplinaires_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rapports_disciplinaires_apfcId_discipline_key" ON "rapports_disciplinaires"("apfcId", "discipline");

CREATE INDEX "rapports_disciplinaires_rempliParId_idx" ON "rapports_disciplinaires"("rempliParId");

-- Le rapport suit son antenne (suppression en cascade avec l'APFC).
ALTER TABLE "rapports_disciplinaires"
  ADD CONSTRAINT "rapports_disciplinaires_apfcId_fkey" FOREIGN KEY ("apfcId") REFERENCES "apfc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Le rapport SURVIT à la suppression du compte de son rédacteur (rempliParId remis à NULL).
ALTER TABLE "rapports_disciplinaires"
  ADD CONSTRAINT "rapports_disciplinaires_rempliParId_fkey" FOREIGN KEY ("rempliParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
