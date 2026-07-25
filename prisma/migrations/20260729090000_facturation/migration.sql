-- Sous-module FACTURATION (docs/finance/07-Facturation + 05B) : factures & proformas d'élève
-- adossées aux créances du 06 (lignes liées), avoirs et notes de débit numérotés via les
-- séquences de la fondation (FAC/PRO/AVR/ND), cycle de vie historisé au journal d'audit.
-- Colonnes fondation systématiques (devise, dateComptable, version, annuleLe/annuleParId,
-- creeLe) ; unicité des numéros ACTIFS par index PARTIEL (RM-004 : jamais de suppression).

-- ── 1. Factures ──
CREATE TABLE "factures_eleve" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'facture',
    "numero" TEXT,
    "objet" TEXT NOT NULL,
    "observations" TEXT,
    "totalBrut" INTEGER NOT NULL DEFAULT 0,
    "totalRemises" INTEGER NOT NULL DEFAULT 0,
    "totalTaxes" INTEGER NOT NULL DEFAULT 0,
    "montantTotal" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "motifAnnulation" TEXT,
    "dateEmission" TIMESTAMP(3),
    "dateEcheance" TIMESTAMP(3),
    "dateValidation" TIMESTAMP(3),
    "creeParId" TEXT,
    "valideeParId" TEXT,
    "emiseParId" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "factures_eleve_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "factures_eleve_etablissementId_exercice_idx" ON "factures_eleve"("etablissementId", "exercice");
CREATE INDEX "factures_eleve_etablissementId_statut_idx" ON "factures_eleve"("etablissementId", "statut");
CREATE INDEX "factures_eleve_eleveId_statut_idx" ON "factures_eleve"("eleveId", "statut");
-- Unicité des numéros de factures ACTIVES par établissement (les annulées gardent leur numéro).
CREATE UNIQUE INDEX "factures_eleve_numero_actif_key" ON "factures_eleve"("etablissementId", "numero") WHERE "annuleLe" IS NULL AND "numero" IS NOT NULL;
ALTER TABLE "factures_eleve" ADD CONSTRAINT "factures_eleve_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "factures_eleve" ADD CONSTRAINT "factures_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "factures_eleve" ADD CONSTRAINT "factures_eleve_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Lignes de facture (liées aux créances du 06) ──
CREATE TABLE "lignes_facture" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "creanceId" TEXT,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "prixUnitaire" INTEGER NOT NULL,
    "remise" INTEGER NOT NULL DEFAULT 0,
    "taxe" INTEGER NOT NULL DEFAULT 0,
    "montant" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lignes_facture_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lignes_facture_factureId_idx" ON "lignes_facture"("factureId");
CREATE INDEX "lignes_facture_creanceId_idx" ON "lignes_facture"("creanceId");
ALTER TABLE "lignes_facture" ADD CONSTRAINT "lignes_facture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures_eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lignes_facture" ADD CONSTRAINT "lignes_facture_creanceId_fkey" FOREIGN KEY ("creanceId") REFERENCES "creances_eleve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lignes_facture" ADD CONSTRAINT "lignes_facture_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Avoirs ──
CREATE TABLE "avoirs_facture" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "creeParId" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "avoirs_facture_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "avoirs_facture_etablissementId_idx" ON "avoirs_facture"("etablissementId");
CREATE INDEX "avoirs_facture_factureId_idx" ON "avoirs_facture"("factureId");
CREATE UNIQUE INDEX "avoirs_facture_numero_actif_key" ON "avoirs_facture"("etablissementId", "numero") WHERE "annuleLe" IS NULL;
ALTER TABLE "avoirs_facture" ADD CONSTRAINT "avoirs_facture_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "avoirs_facture" ADD CONSTRAINT "avoirs_facture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures_eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "avoirs_facture" ADD CONSTRAINT "avoirs_facture_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Notes de débit ──
CREATE TABLE "notes_debit_facture" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "motif" TEXT,
    "creeParId" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notes_debit_facture_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notes_debit_facture_etablissementId_idx" ON "notes_debit_facture"("etablissementId");
CREATE INDEX "notes_debit_facture_factureId_idx" ON "notes_debit_facture"("factureId");
CREATE UNIQUE INDEX "notes_debit_facture_numero_actif_key" ON "notes_debit_facture"("etablissementId", "numero") WHERE "annuleLe" IS NULL;
ALTER TABLE "notes_debit_facture" ADD CONSTRAINT "notes_debit_facture_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes_debit_facture" ADD CONSTRAINT "notes_debit_facture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures_eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes_debit_facture" ADD CONSTRAINT "notes_debit_facture_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
