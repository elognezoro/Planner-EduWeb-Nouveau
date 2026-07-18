-- Comptabilité OHADA phase 2 : pointage des écritures bancaires (rapprochement),
-- relevés bancaires mensuels et budget prévisionnel par catégorie OHADA.

ALTER TABLE "operations_financieres" ADD COLUMN "pointeLe" TIMESTAMP(3);
ALTER TABLE "paiements_scolarite" ADD COLUMN "pointeLe" TIMESTAMP(3);

CREATE TABLE "releves_bancaires" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "mois" TEXT NOT NULL,
    "solde" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "releves_bancaires_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "releves_bancaires_etablissementId_mois_key" ON "releves_bancaires"("etablissementId", "mois");
ALTER TABLE "releves_bancaires" ADD CONSTRAINT "releves_bancaires_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "budget_lignes" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "sens" TEXT NOT NULL,
    "montantPrevu" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budget_lignes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "budget_lignes_etablissementId_exercice_categorie_sens_key" ON "budget_lignes"("etablissementId", "exercice", "categorie", "sens");
ALTER TABLE "budget_lignes" ADD CONSTRAINT "budget_lignes_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
