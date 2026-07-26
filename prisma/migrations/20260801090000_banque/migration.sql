-- Sous-module BANQUE (docs/finance/10-Banque + 05B) : comptes bancaires & Mobile Money
-- institutionnels (solde CALCULÉ : soldeInitial + mouvements actifs), mouvements bancaires
-- (dépôts issus des caisses — RM-600, boucle avec versement_banque du 09 —, retraits,
-- virements avec paire liée, prélèvements, frais → OperationFinanciere cat. 63 (RM-604),
-- intérêts → cat. 77 (RM-605)), registre des CHÈQUES (émis/reçus, statuts historisés),
-- relevés bancaires PAR COMPTE (le relevé global historique reste valide — compat totale).
-- Colonnes fondation systématiques ; index uniques PARTIELS pour les unicités d'actifs.

-- ── 1. Comptes bancaires ──
CREATE TABLE "comptes_bancaires" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'courant',
    "banque" TEXT NOT NULL,
    "agence" TEXT,
    "numeroCompte" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "responsableId" TEXT,
    "soldeInitial" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "dateOuverture" TIMESTAMP(3),
    "dateFermeture" TIMESTAMP(3),
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comptes_bancaires_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comptes_bancaires_etablissementId_nom_idx" ON "comptes_bancaires"("etablissementId", "nom");
-- Unicité du nom parmi les comptes ACTIFS (RM-004 : un compte archivé peut être recréé).
CREATE UNIQUE INDEX "comptes_bancaires_nom_actif_key" ON "comptes_bancaires"("etablissementId", "nom") WHERE "annuleLe" IS NULL;
ALTER TABLE "comptes_bancaires" ADD CONSTRAINT "comptes_bancaires_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comptes_bancaires" ADD CONSTRAINT "comptes_bancaires_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comptes_bancaires" ADD CONSTRAINT "comptes_bancaires_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Mouvements bancaires ──
CREATE TABLE "mouvements_bancaires" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "reference" TEXT,
    "pieceJustificative" TEXT NOT NULL,
    "beneficiaire" TEXT,
    "mouvementCaisseId" TEXT,
    "lieMouvementId" TEXT,
    "chequeId" TEXT,
    "operationId" TEXT,
    "dateOperation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pointeLe" TIMESTAMP(3),
    "saisiParId" TEXT,
    "valideParId" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mouvements_bancaires_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mouvements_bancaires_compteId_dateOperation_idx" ON "mouvements_bancaires"("compteId", "dateOperation");
CREATE INDEX "mouvements_bancaires_etablissementId_dateOperation_idx" ON "mouvements_bancaires"("etablissementId", "dateOperation");
CREATE INDEX "mouvements_bancaires_mouvementCaisseId_idx" ON "mouvements_bancaires"("mouvementCaisseId");
-- Un versement de caisse ne peut être CONFIRMÉ en banque qu'UNE fois (dépôt actif unique).
CREATE UNIQUE INDEX "mouvements_bancaires_versement_confirme_key" ON "mouvements_bancaires"("mouvementCaisseId") WHERE "annuleLe" IS NULL AND "mouvementCaisseId" IS NOT NULL;
ALTER TABLE "mouvements_bancaires" ADD CONSTRAINT "mouvements_bancaires_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mouvements_bancaires" ADD CONSTRAINT "mouvements_bancaires_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes_bancaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mouvements_bancaires" ADD CONSTRAINT "mouvements_bancaires_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Registre des chèques ──
CREATE TABLE "cheques_bancaires" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "compteId" TEXT,
    "sens" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "banque" TEXT,
    "montant" INTEGER NOT NULL,
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emetteur" TEXT,
    "beneficiaire" TEXT,
    "paiementId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_circulation',
    "motifStatut" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cheques_bancaires_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cheques_bancaires_etablissementId_sens_statut_idx" ON "cheques_bancaires"("etablissementId", "sens", "statut");
CREATE INDEX "cheques_bancaires_compteId_idx" ON "cheques_bancaires"("compteId");
-- Unicité du numéro parmi les chèques ACTIFS d'un même sens.
CREATE UNIQUE INDEX "cheques_bancaires_numero_actif_key" ON "cheques_bancaires"("etablissementId", "sens", "numero") WHERE "annuleLe" IS NULL;
ALTER TABLE "cheques_bancaires" ADD CONSTRAINT "cheques_bancaires_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cheques_bancaires" ADD CONSTRAINT "cheques_bancaires_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes_bancaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cheques_bancaires" ADD CONSTRAINT "cheques_bancaires_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Relevés bancaires PAR COMPTE (compat : le relevé global historique reste valide) ──
ALTER TABLE "releves_bancaires" ADD COLUMN "compteId" TEXT;
CREATE INDEX "releves_bancaires_compteId_idx" ON "releves_bancaires"("compteId");
CREATE INDEX "releves_bancaires_etablissementId_mois_idx" ON "releves_bancaires"("etablissementId", "mois");
ALTER TABLE "releves_bancaires" ADD CONSTRAINT "releves_bancaires_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "comptes_bancaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- L'unique historique (etablissementId, mois) est remplacé par des uniques PARTIELS d'actifs :
DROP INDEX "releves_bancaires_etablissementId_mois_key";
CREATE UNIQUE INDEX "releves_bancaires_global_actif_key" ON "releves_bancaires"("etablissementId", "mois") WHERE "annuleLe" IS NULL AND "compteId" IS NULL;
CREATE UNIQUE INDEX "releves_bancaires_compte_actif_key" ON "releves_bancaires"("etablissementId", "compteId", "mois") WHERE "annuleLe" IS NULL AND "compteId" IS NOT NULL;
