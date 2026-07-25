-- Sous-module CAISSE (docs/finance/09-Caisse + 05B) : caisses par établissement, SESSIONS
-- (ouverture avec fonds initial → mouvements rattachés → comptage physique → clôture avec
-- totaux figés, RM-505), écarts justifiés et validés par un SECOND acteur, mouvements
-- internes de trésorerie (approvisionnements, décaissements, transferts, versements/retraits
-- banque — l'effectif bancaire relevant du 10). RM-500→505 :
--  - RM-501/502 : une seule session OUVERTE par caisse (et par caissier) — index uniques
--    PARTIELS « WHERE statut = 'ouverte' AND annuleLe IS NULL » ;
--  - RM-504 : rattachement des paiements et opérations à la session (colonnes sessionCaisseId,
--    nulles pour les établissements sans caisses : AUCUNE régression des flux existants).
-- Colonnes fondation systématiques (devise, dateComptable, version, annuleLe/annuleParId, creeLe).

-- ── 1. Caisses ──
CREATE TABLE "caisses_etablissement" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'physique',
    "responsableId" TEXT,
    "plafond" INTEGER,
    "decouvertAutorise" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'active',
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "caisses_etablissement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "caisses_etablissement_etablissementId_nom_idx" ON "caisses_etablissement"("etablissementId", "nom");
-- Unicité du nom parmi les caisses ACTIVES (RM-004 : une caisse retirée peut être recréée).
CREATE UNIQUE INDEX "caisses_etablissement_nom_actif_key" ON "caisses_etablissement"("etablissementId", "nom") WHERE "annuleLe" IS NULL;
ALTER TABLE "caisses_etablissement" ADD CONSTRAINT "caisses_etablissement_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "caisses_etablissement" ADD CONSTRAINT "caisses_etablissement_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "caisses_etablissement" ADD CONSTRAINT "caisses_etablissement_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Sessions de caisse ──
CREATE TABLE "sessions_caisse" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "caisseId" TEXT NOT NULL,
    "caissierId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouverte',
    "fondsInitial" INTEGER NOT NULL,
    "observations" TEXT,
    "ouverteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clotureeLe" TIMESTAMP(3),
    "totalEncaissements" INTEGER,
    "totalDecaissements" INTEGER,
    "soldeTheorique" INTEGER,
    "soldeReel" INTEGER,
    "ecart" INTEGER,
    "typeEcart" TEXT,
    "motifEcart" TEXT,
    "ecartValideParId" TEXT,
    "ecartValideLe" TIMESTAMP(3),
    "montantAVerser" INTEGER,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_caisse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sessions_caisse_caisseId_statut_idx" ON "sessions_caisse"("caisseId", "statut");
CREATE INDEX "sessions_caisse_etablissementId_ouverteLe_idx" ON "sessions_caisse"("etablissementId", "ouverteLe");
CREATE INDEX "sessions_caisse_caissierId_idx" ON "sessions_caisse"("caissierId");
-- RM-501/502 : une seule session OUVERTE par caisse — et une par caissier (rattachement automatique).
CREATE UNIQUE INDEX "sessions_caisse_ouverte_par_caisse_key" ON "sessions_caisse"("caisseId") WHERE "statut" = 'ouverte' AND "annuleLe" IS NULL;
CREATE UNIQUE INDEX "sessions_caisse_ouverte_par_caissier_key" ON "sessions_caisse"("caissierId") WHERE "statut" = 'ouverte' AND "annuleLe" IS NULL;
ALTER TABLE "sessions_caisse" ADD CONSTRAINT "sessions_caisse_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions_caisse" ADD CONSTRAINT "sessions_caisse_caisseId_fkey" FOREIGN KEY ("caisseId") REFERENCES "caisses_etablissement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions_caisse" ADD CONSTRAINT "sessions_caisse_caissierId_fkey" FOREIGN KEY ("caissierId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions_caisse" ADD CONSTRAINT "sessions_caisse_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Mouvements internes de caisse ──
CREATE TABLE "mouvements_caisse" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "beneficiaire" TEXT,
    "motif" TEXT,
    "pieceJustificative" TEXT,
    "valideParId" TEXT,
    "lieMouvementId" TEXT,
    "saisiParId" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mouvements_caisse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mouvements_caisse_sessionId_idx" ON "mouvements_caisse"("sessionId");
CREATE INDEX "mouvements_caisse_etablissementId_creeLe_idx" ON "mouvements_caisse"("etablissementId", "creeLe");
ALTER TABLE "mouvements_caisse" ADD CONSTRAINT "mouvements_caisse_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mouvements_caisse" ADD CONSTRAINT "mouvements_caisse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions_caisse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mouvements_caisse" ADD CONSTRAINT "mouvements_caisse_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Rattachement des flux existants aux sessions (RM-504) ──
ALTER TABLE "paiements_scolarite" ADD COLUMN "sessionCaisseId" TEXT;
CREATE INDEX "paiements_scolarite_sessionCaisseId_idx" ON "paiements_scolarite"("sessionCaisseId");
ALTER TABLE "paiements_scolarite" ADD CONSTRAINT "paiements_scolarite_sessionCaisseId_fkey" FOREIGN KEY ("sessionCaisseId") REFERENCES "sessions_caisse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operations_financieres" ADD COLUMN "sessionCaisseId" TEXT;
CREATE INDEX "operations_financieres_sessionCaisseId_idx" ON "operations_financieres"("sessionCaisseId");
ALTER TABLE "operations_financieres" ADD CONSTRAINT "operations_financieres_sessionCaisseId_fkey" FOREIGN KEY ("sessionCaisseId") REFERENCES "sessions_caisse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
