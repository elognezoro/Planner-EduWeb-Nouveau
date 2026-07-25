-- Sous-module SCOLARITÉ (docs/finance/06-Scolarite + 05B) : catégories de frais avec priorité
-- d'imputation, frais enrichis (code, catégorie, série/cycle/statut, validité, mode de calcul),
-- CRÉANCES élève (pièce structurante, prépare 07-Facturation), exonérations, bourses, plans de
-- paiement, règles & pénalités, avances, demandes de remboursement, règles de blocage.
-- Tout naît conforme à la fondation transverse 20260726090000 : annulations logiques
-- (annuleLe/annuleParId), devise, dateComptable, verrouillage optimiste (version).

-- ── 1. Catégories de frais (priorité d'imputation configurable) ──
CREATE TABLE "categories_frais" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT,
    "ordreImputation" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_frais_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "categories_frais_etablissementId_nom_idx" ON "categories_frais"("etablissementId", "nom");
-- Unicité limitée aux catégories ACTIVES (RM-004 : une catégorie annulée peut être recréée).
CREATE UNIQUE INDEX "categories_frais_active_par_nom_key" ON "categories_frais"("etablissementId", "nom") WHERE "annuleLe" IS NULL;
ALTER TABLE "categories_frais" ADD CONSTRAINT "categories_frais_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories_frais" ADD CONSTRAINT "categories_frais_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Frais enrichis (paramétrage 06) — colonnes nullables/défauts : barèmes existants intacts ──
ALTER TABLE "frais_scolarite" ADD COLUMN "code" TEXT;
ALTER TABLE "frais_scolarite" ADD COLUMN "description" TEXT;
ALTER TABLE "frais_scolarite" ADD COLUMN "categorieId" TEXT;
ALTER TABLE "frais_scolarite" ADD COLUMN "serie" TEXT;
ALTER TABLE "frais_scolarite" ADD COLUMN "cycle" TEXT;
ALTER TABLE "frais_scolarite" ADD COLUMN "statutEleve" TEXT;
ALTER TABLE "frais_scolarite" ADD COLUMN "dateDebut" TIMESTAMP(3);
ALTER TABLE "frais_scolarite" ADD COLUMN "dateFin" TIMESTAMP(3);
ALTER TABLE "frais_scolarite" ADD COLUMN "modeCalcul" TEXT NOT NULL DEFAULT 'fixe';
CREATE INDEX "frais_scolarite_categorieId_idx" ON "frais_scolarite"("categorieId");
ALTER TABLE "frais_scolarite" ADD CONSTRAINT "frais_scolarite_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_frais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Créances élève ──
CREATE TABLE "creances_eleve" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "fraisId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateEcheance" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'generee',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creances_eleve_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "creances_eleve_etablissementId_exercice_idx" ON "creances_eleve"("etablissementId", "exercice");
CREATE INDEX "creances_eleve_eleveId_statut_idx" ON "creances_eleve"("eleveId", "statut");
CREATE INDEX "creances_eleve_fraisId_idx" ON "creances_eleve"("fraisId");
ALTER TABLE "creances_eleve" ADD CONSTRAINT "creances_eleve_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creances_eleve" ADD CONSTRAINT "creances_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creances_eleve" ADD CONSTRAINT "creances_eleve_fraisId_fkey" FOREIGN KEY ("fraisId") REFERENCES "frais_scolarite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creances_eleve" ADD CONSTRAINT "creances_eleve_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Exonérations ──
CREATE TABLE "exonerations_eleve" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "fraisId" TEXT,
    "type" TEXT NOT NULL,
    "taux" INTEGER,
    "montant" INTEGER,
    "decision" TEXT NOT NULL,
    "responsableId" TEXT,
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exonerations_eleve_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exonerations_eleve_etablissementId_idx" ON "exonerations_eleve"("etablissementId");
CREATE INDEX "exonerations_eleve_eleveId_idx" ON "exonerations_eleve"("eleveId");
ALTER TABLE "exonerations_eleve" ADD CONSTRAINT "exonerations_eleve_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exonerations_eleve" ADD CONSTRAINT "exonerations_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exonerations_eleve" ADD CONSTRAINT "exonerations_eleve_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5. Bourses & prises en charge ──
CREATE TABLE "bourses_eleve" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organisme" TEXT,
    "taux" INTEGER,
    "montantFixe" INTEGER,
    "fraisCibles" JSONB,
    "periode" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bourses_eleve_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bourses_eleve_etablissementId_idx" ON "bourses_eleve"("etablissementId");
CREATE INDEX "bourses_eleve_eleveId_idx" ON "bourses_eleve"("eleveId");
ALTER TABLE "bourses_eleve" ADD CONSTRAINT "bourses_eleve_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bourses_eleve" ADD CONSTRAINT "bourses_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bourses_eleve" ADD CONSTRAINT "bourses_eleve_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6. Plans de paiement ──
CREATE TABLE "plans_paiement" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "creanceId" TEXT,
    "libelle" TEXT,
    "echeances" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plans_paiement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "plans_paiement_etablissementId_idx" ON "plans_paiement"("etablissementId");
CREATE INDEX "plans_paiement_eleveId_idx" ON "plans_paiement"("eleveId");
ALTER TABLE "plans_paiement" ADD CONSTRAINT "plans_paiement_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plans_paiement" ADD CONSTRAINT "plans_paiement_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plans_paiement" ADD CONSTRAINT "plans_paiement_creanceId_fkey" FOREIGN KEY ("creanceId") REFERENCES "creances_eleve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plans_paiement" ADD CONSTRAINT "plans_paiement_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 7. Règles de pénalités + pénalités appliquées ──
CREATE TABLE "regles_penalites" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "declencheur" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valeur" DECIMAL(18,2) NOT NULL,
    "delaiJours" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "regles_penalites_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "regles_penalites_etablissementId_idx" ON "regles_penalites"("etablissementId");
ALTER TABLE "regles_penalites" ADD CONSTRAINT "regles_penalites_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regles_penalites" ADD CONSTRAINT "regles_penalites_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "penalites_eleve" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "creanceId" TEXT NOT NULL,
    "regleId" TEXT,
    "montant" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'appliquee',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "penalites_eleve_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "penalites_eleve_eleveId_idx" ON "penalites_eleve"("eleveId");
CREATE INDEX "penalites_eleve_creanceId_idx" ON "penalites_eleve"("creanceId");
ALTER TABLE "penalites_eleve" ADD CONSTRAINT "penalites_eleve_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "penalites_eleve" ADD CONSTRAINT "penalites_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "penalites_eleve" ADD CONSTRAINT "penalites_eleve_creanceId_fkey" FOREIGN KEY ("creanceId") REFERENCES "creances_eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "penalites_eleve" ADD CONSTRAINT "penalites_eleve_regleId_fkey" FOREIGN KEY ("regleId") REFERENCES "regles_penalites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "penalites_eleve" ADD CONSTRAINT "penalites_eleve_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 8. Avances / acomptes ──
CREATE TABLE "avances_eleve" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "solde" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'especes',
    "reference" TEXT,
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "avances_eleve_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "avances_eleve_etablissementId_idx" ON "avances_eleve"("etablissementId");
CREATE INDEX "avances_eleve_eleveId_idx" ON "avances_eleve"("eleveId");
ALTER TABLE "avances_eleve" ADD CONSTRAINT "avances_eleve_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "avances_eleve" ADD CONSTRAINT "avances_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "avances_eleve" ADD CONSTRAINT "avances_eleve_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 9. Demandes de remboursement ──
CREATE TABLE "demandes_remboursement" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "paiementId" TEXT,
    "montant" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'demandee',
    "demandeParId" TEXT,
    "valideeParId" TEXT,
    "dateValidation" TIMESTAMP(3),
    "operationId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demandes_remboursement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "demandes_remboursement_etablissementId_statut_idx" ON "demandes_remboursement"("etablissementId", "statut");
CREATE INDEX "demandes_remboursement_eleveId_idx" ON "demandes_remboursement"("eleveId");
ALTER TABLE "demandes_remboursement" ADD CONSTRAINT "demandes_remboursement_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demandes_remboursement" ADD CONSTRAINT "demandes_remboursement_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demandes_remboursement" ADD CONSTRAINT "demandes_remboursement_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "paiements_scolarite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demandes_remboursement" ADD CONSTRAINT "demandes_remboursement_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 10. Règles de blocage pédagogique (configuration + consultation en V1) ──
CREATE TABLE "regles_blocage" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "seuilImpaye" DECIMAL(18,2),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "regles_blocage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "regles_blocage_etablissementId_type_idx" ON "regles_blocage"("etablissementId", "type");
-- Unicité limitée aux règles ACTIVES (RM-004 : une règle annulée peut être recréée).
CREATE UNIQUE INDEX "regles_blocage_active_par_type_key" ON "regles_blocage"("etablissementId", "type") WHERE "annuleLe" IS NULL;
ALTER TABLE "regles_blocage" ADD CONSTRAINT "regles_blocage_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regles_blocage" ADD CONSTRAINT "regles_blocage_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
