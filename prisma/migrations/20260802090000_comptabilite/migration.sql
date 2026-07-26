-- Sous-module COMPTABILITÉ (docs/finance/11-Comptabilite + 05B) : plan comptable
-- paramétrable par établissement (semé depuis le plan OHADA simplifié du dépôt — le
-- 11A-Plan-Comptable-OHADA affinera subdivisions et intitulés à sa réception), journaux
-- (7 par défaut), ÉCRITURES en partie double (RM-700 : équilibre strict ; RM-701/702 :
-- validée intouchable, correction par CONTRE-PASSATION ; RM-703 : pièce obligatoire ;
-- RM-704 : exercice obligatoire ; RM-705 : périodes clôturées verrouillées), génération
-- automatique IDEMPOTENTE (une pièce = une écriture, unicité partielle par source),
-- clôtures de PÉRIODE mensuelles (la clôture d'EXERCICE existante est inchangée).
-- La comptabilité CALCULÉE historique (grand livre/balance/résultat/bilan dérivés) reste
-- intacte : le 11 ajoute le REGISTRE FORMEL, il ne remplace rien.

-- ── 1. Plan comptable ──
CREATE TABLE "comptes_comptables" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "classe" INTEGER NOT NULL,
    "nature" TEXT NOT NULL DEFAULT 'mixte',
    "parentNumero" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "dateOuverture" TIMESTAMP(3),
    "dateCloture" TIMESTAMP(3),
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comptes_comptables_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comptes_comptables_etablissementId_numero_idx" ON "comptes_comptables"("etablissementId", "numero");
-- Unicité du numéro parmi les comptes ACTIFS (RM-004 : un compte retiré peut être recréé).
CREATE UNIQUE INDEX "comptes_comptables_numero_actif_key" ON "comptes_comptables"("etablissementId", "numero") WHERE "annuleLe" IS NULL;
ALTER TABLE "comptes_comptables" ADD CONSTRAINT "comptes_comptables_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comptes_comptables" ADD CONSTRAINT "comptes_comptables_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Journaux comptables ──
CREATE TABLE "journaux_comptables" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journaux_comptables_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "journaux_comptables_etablissementId_code_idx" ON "journaux_comptables"("etablissementId", "code");
CREATE UNIQUE INDEX "journaux_comptables_code_actif_key" ON "journaux_comptables"("etablissementId", "code") WHERE "annuleLe" IS NULL;
ALTER TABLE "journaux_comptables" ADD CONSTRAINT "journaux_comptables_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journaux_comptables" ADD CONSTRAINT "journaux_comptables_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Écritures ──
CREATE TABLE "ecritures_comptables" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "numero" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "pieceJustificative" TEXT NOT NULL,
    "origine" TEXT NOT NULL DEFAULT 'manuelle',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "valideeParId" TEXT,
    "dateValidation" TIMESTAMP(3),
    "contreEcritureDeId" TEXT,
    "creeParId" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecritures_comptables_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ecritures_comptables_etablissementId_exercice_idx" ON "ecritures_comptables"("etablissementId", "exercice");
CREATE INDEX "ecritures_comptables_etablissementId_date_idx" ON "ecritures_comptables"("etablissementId", "date");
CREATE INDEX "ecritures_comptables_journalId_statut_idx" ON "ecritures_comptables"("journalId", "statut");
-- Génération automatique IDEMPOTENTE : une pièce source = UNE écriture active.
CREATE UNIQUE INDEX "ecritures_comptables_source_active_key" ON "ecritures_comptables"("etablissementId", "sourceType", "sourceId") WHERE "annuleLe" IS NULL AND "sourceType" IS NOT NULL AND "sourceId" IS NOT NULL;
ALTER TABLE "ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journaux_comptables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ecritures_comptables" ADD CONSTRAINT "ecritures_comptables_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Lignes d'écriture ──
CREATE TABLE "lignes_ecriture" (
    "id" TEXT NOT NULL,
    "ecritureId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "compteNumero" TEXT NOT NULL,
    "compteIntitule" TEXT NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "libelle" TEXT,
    "centreAnalytique" TEXT,
    "lettrage" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lignes_ecriture_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lignes_ecriture_ecritureId_idx" ON "lignes_ecriture"("ecritureId");
CREATE INDEX "lignes_ecriture_compteId_idx" ON "lignes_ecriture"("compteId");
ALTER TABLE "lignes_ecriture" ADD CONSTRAINT "lignes_ecriture_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "ecritures_comptables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lignes_ecriture" ADD CONSTRAINT "lignes_ecriture_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes_comptables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lignes_ecriture" ADD CONSTRAINT "lignes_ecriture_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5. Clôtures de période mensuelles (RM-705) ──
CREATE TABLE "clotures_periode" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "clotureParId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clotures_periode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "clotures_periode_etablissementId_periode_idx" ON "clotures_periode"("etablissementId", "periode");
-- Une période n'est CLÔTURÉE qu'une fois (réouverture exceptionnelle = annulation logique).
CREATE UNIQUE INDEX "clotures_periode_active_key" ON "clotures_periode"("etablissementId", "periode") WHERE "annuleLe" IS NULL;
ALTER TABLE "clotures_periode" ADD CONSTRAINT "clotures_periode_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clotures_periode" ADD CONSTRAINT "clotures_periode_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
