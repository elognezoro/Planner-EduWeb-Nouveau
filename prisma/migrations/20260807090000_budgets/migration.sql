-- Sous-module BUDGETS (docs/finance/16-Budgets + 05B) : ENRICHIT le budget existant par
-- AJOUT STRICT (budget_lignes conserve toutes ses colonnes ; l'upsert legacy et le contrôle
-- budgétaire du 12 continuent tels quels). Enveloppes votées (workflow), centres de coûts/
-- profits, révisions historisées (RM-1301), engagements manuels (contrats/marchés/
-- conventions, RM-1302). VOTÉ / ENGAGÉ / CONSOMMÉ / DISPONIBLE sont DÉRIVÉS en temps réel
-- (jamais stockés) — le 16 absorbe et généralise l'engagement déjà posé au 12.

-- ── 1. Enveloppes budgétaires (workflow) ──
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'fonctionnement',
    "libelle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "preparParId" TEXT,
    "preparParNom" TEXT,
    "voteParId" TEXT,
    "voteParNom" TEXT,
    "dateVote" TIMESTAMP(3),
    "notes" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "budgets_etablissementId_exercice_idx" ON "budgets"("etablissementId", "exercice");
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Centres de coûts / profits ──
CREATE TABLE "centres_cout" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'cout',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "centres_cout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "centres_cout_etablissementId_idx" ON "centres_cout"("etablissementId");
CREATE UNIQUE INDEX "centres_cout_code_actif_key" ON "centres_cout"("etablissementId", "code") WHERE "annuleLe" IS NULL;
ALTER TABLE "centres_cout" ADD CONSTRAINT "centres_cout_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "centres_cout" ADD CONSTRAINT "centres_cout_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Enrichissement de budget_lignes (ALTER — jamais destructif) ──
ALTER TABLE "budget_lignes" ADD COLUMN "montantRevise" INTEGER;
ALTER TABLE "budget_lignes" ADD COLUMN "code" TEXT;
ALTER TABLE "budget_lignes" ADD COLUMN "libelle" TEXT;
ALTER TABLE "budget_lignes" ADD COLUMN "budgetId" TEXT;
ALTER TABLE "budget_lignes" ADD COLUMN "centreCoutId" TEXT;
ALTER TABLE "budget_lignes" ADD COLUMN "statut" TEXT NOT NULL DEFAULT 'active';
CREATE INDEX "budget_lignes_budgetId_idx" ON "budget_lignes"("budgetId");
ALTER TABLE "budget_lignes" ADD CONSTRAINT "budget_lignes_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budget_lignes" ADD CONSTRAINT "budget_lignes_centreCoutId_fkey" FOREIGN KEY ("centreCoutId") REFERENCES "centres_cout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Révisions budgétaires (historique, RM-1301) ──
CREATE TABLE "revisions_budget" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ligneId" TEXT,
    "ligneCibleId" TEXT,
    "categorie" TEXT,
    "montant" INTEGER NOT NULL,
    "montantAvant" INTEGER,
    "montantApres" INTEGER,
    "motif" TEXT NOT NULL,
    "parId" TEXT,
    "parNom" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revisions_budget_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "revisions_budget_etablissementId_exercice_idx" ON "revisions_budget"("etablissementId", "exercice");
ALTER TABLE "revisions_budget" ADD CONSTRAINT "revisions_budget_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. Engagements manuels (contrats / marchés / conventions, RM-1302) ──
CREATE TABLE "engagements_budget" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "centreCoutId" TEXT,
    "montant" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'autre',
    "reference" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "parId" TEXT,
    "parNom" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "engagements_budget_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "engagements_budget_etablissementId_exercice_statut_idx" ON "engagements_budget"("etablissementId", "exercice", "statut");
ALTER TABLE "engagements_budget" ADD CONSTRAINT "engagements_budget_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagements_budget" ADD CONSTRAINT "engagements_budget_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
