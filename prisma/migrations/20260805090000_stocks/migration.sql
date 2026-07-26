-- Sous-module STOCKS (docs/finance/14-Stocks + 05B) : ENRICHIT l'économat existant par
-- AJOUT STRICT (aucune colonne supprimée/renommée — ventes, entrées, ajustements et
-- branchements du 12 continuent tels quels). Magasins hiérarchisés (parentId libre :
-- magasin → zone → rayon → étagère → emplacement), répartition du stock par magasin
-- (INVARIANT : Σ = articles_economat.stock), fiche article enrichie (unités, seuils
-- min/max/sécurité, EOQ, CUMP), lots/péremption, numéros de série uniques, réservations
-- (disponible = stock − réservations actives, RM-1100), inventaires à validation SECOND
-- acteur (RM-1105). REPRISE DOUCE en fin de migration : un magasin CENTRAL par
-- établissement possédant des articles + répartition initiale = stock actuel + CUMP amorcé
-- au prix d'achat connu.

-- ── 1. Fiche article enrichie (ALTER — jamais destructif) ──
ALTER TABLE "articles_economat" ADD COLUMN "code" TEXT;
ALTER TABLE "articles_economat" ADD COLUMN "codeBarres" TEXT;
ALTER TABLE "articles_economat" ADD COLUMN "description" TEXT;
ALTER TABLE "articles_economat" ADD COLUMN "sousCategorie" TEXT;
ALTER TABLE "articles_economat" ADD COLUMN "unite" TEXT NOT NULL DEFAULT 'unité';
ALTER TABLE "articles_economat" ADD COLUMN "typeArticle" TEXT NOT NULL DEFAULT 'consommable';
ALTER TABLE "articles_economat" ADD COLUMN "stockMax" INTEGER;
ALTER TABLE "articles_economat" ADD COLUMN "stockSecurite" INTEGER;
ALTER TABLE "articles_economat" ADD COLUMN "eoq" INTEGER;
ALTER TABLE "articles_economat" ADD COLUMN "cump" INTEGER;
ALTER TABLE "articles_economat" ADD COLUMN "tvaPourcent" INTEGER;
ALTER TABLE "articles_economat" ADD COLUMN "fournisseurPrincipalId" TEXT;
ALTER TABLE "articles_economat" ADD CONSTRAINT "articles_economat_fournisseurPrincipalId_fkey" FOREIGN KEY ("fournisseurPrincipalId") REFERENCES "fournisseurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Mouvements : localisation, motifs, liens (ALTER) ──
ALTER TABLE "mouvements_stock" ADD COLUMN "magasinId" TEXT;
ALTER TABLE "mouvements_stock" ADD COLUMN "lieMouvementId" TEXT;
ALTER TABLE "mouvements_stock" ADD COLUMN "motif" TEXT;
ALTER TABLE "mouvements_stock" ADD COLUMN "beneficiaire" TEXT;
ALTER TABLE "mouvements_stock" ADD COLUMN "valideParId" TEXT;
CREATE INDEX "mouvements_stock_magasinId_idx" ON "mouvements_stock"("magasinId");

-- ── 3. Magasins ──
CREATE TABLE "magasins_stock" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'central',
    "parentId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "responsableId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "magasins_stock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "magasins_stock_etablissementId_idx" ON "magasins_stock"("etablissementId");
-- Un SEUL magasin principal actif par établissement.
CREATE UNIQUE INDEX "magasins_stock_principal_actif_key" ON "magasins_stock"("etablissementId") WHERE "annuleLe" IS NULL AND "principal" = true;
ALTER TABLE "magasins_stock" ADD CONSTRAINT "magasins_stock_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "magasins_stock" ADD CONSTRAINT "magasins_stock_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "magasins_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "magasins_stock" ADD CONSTRAINT "magasins_stock_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "magasins_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Répartition du stock par magasin ──
CREATE TABLE "stocks_magasin" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "magasinId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stocks_magasin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stocks_magasin_articleId_magasinId_key" ON "stocks_magasin"("articleId", "magasinId");
CREATE INDEX "stocks_magasin_magasinId_idx" ON "stocks_magasin"("magasinId");
ALTER TABLE "stocks_magasin" ADD CONSTRAINT "stocks_magasin_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_economat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stocks_magasin" ADD CONSTRAINT "stocks_magasin_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "magasins_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. Lots ──
CREATE TABLE "lots_stock" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "numeroLot" TEXT NOT NULL,
    "dateFabrication" TIMESTAMP(3),
    "datePeremption" TIMESTAMP(3),
    "fournisseurRef" TEXT,
    "coutAcquisition" INTEGER,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lots_stock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lots_stock_articleId_idx" ON "lots_stock"("articleId");
CREATE UNIQUE INDEX "lots_stock_numero_actif_key" ON "lots_stock"("articleId", "numeroLot") WHERE "annuleLe" IS NULL;
ALTER TABLE "lots_stock" ADD CONSTRAINT "lots_stock_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_economat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lots_stock" ADD CONSTRAINT "lots_stock_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6. Numéros de série ──
CREATE TABLE "series_stock" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "numeroSerie" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'disponible',
    "observation" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "series_stock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "series_stock_articleId_idx" ON "series_stock"("articleId");
CREATE INDEX "series_stock_etablissementId_idx" ON "series_stock"("etablissementId");
-- « Numéro de série déjà utilisé » (409) : unicité parmi les séries ACTIVES de l'établissement.
CREATE UNIQUE INDEX "series_stock_numero_actif_key" ON "series_stock"("etablissementId", "numeroSerie") WHERE "annuleLe" IS NULL;
ALTER TABLE "series_stock" ADD CONSTRAINT "series_stock_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "series_stock" ADD CONSTRAINT "series_stock_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_economat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "series_stock" ADD CONSTRAINT "series_stock_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 7. Réservations ──
CREATE TABLE "reservations_stock" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "beneficiaire" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'active',
    "demandeParId" TEXT,
    "demandeParNom" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reservations_stock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reservations_stock_articleId_statut_idx" ON "reservations_stock"("articleId", "statut");
CREATE INDEX "reservations_stock_etablissementId_idx" ON "reservations_stock"("etablissementId");
ALTER TABLE "reservations_stock" ADD CONSTRAINT "reservations_stock_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations_stock" ADD CONSTRAINT "reservations_stock_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_economat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservations_stock" ADD CONSTRAINT "reservations_stock_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 8. Inventaires ──
CREATE TABLE "inventaires_stock" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "magasinId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "notes" TEXT,
    "compteParId" TEXT,
    "compteParNom" TEXT,
    "valideParId" TEXT,
    "valideParNom" TEXT,
    "dateValidation" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventaires_stock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventaires_stock_etablissementId_statut_idx" ON "inventaires_stock"("etablissementId", "statut");
CREATE UNIQUE INDEX "inventaires_stock_reference_active_key" ON "inventaires_stock"("etablissementId", "reference") WHERE "annuleLe" IS NULL;
ALTER TABLE "inventaires_stock" ADD CONSTRAINT "inventaires_stock_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventaires_stock" ADD CONSTRAINT "inventaires_stock_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "magasins_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventaires_stock" ADD CONSTRAINT "inventaires_stock_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "lignes_inventaire" (
    "id" TEXT NOT NULL,
    "inventaireId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "articleNom" TEXT NOT NULL,
    "stockTheorique" INTEGER NOT NULL,
    "stockPhysique" INTEGER,
    "observation" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lignes_inventaire_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lignes_inventaire_inventaireId_idx" ON "lignes_inventaire"("inventaireId");
ALTER TABLE "lignes_inventaire" ADD CONSTRAINT "lignes_inventaire_inventaireId_fkey" FOREIGN KEY ("inventaireId") REFERENCES "inventaires_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lignes_inventaire" ADD CONSTRAINT "lignes_inventaire_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_economat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 9. REPRISE DOUCE : magasin CENTRAL + répartition initiale + CUMP amorcé ──
-- Un magasin central principal par établissement possédant au moins un article actif.
INSERT INTO "magasins_stock" ("id", "etablissementId", "nom", "type", "statut", "principal")
SELECT gen_random_uuid()::text, e."etablissementId", 'Magasin central', 'central', 'ouvert', true
FROM (SELECT DISTINCT "etablissementId" FROM "articles_economat" WHERE "annuleLe" IS NULL) e;

-- Le stock actuel de chaque article devient celui du magasin central de son établissement.
INSERT INTO "stocks_magasin" ("id", "articleId", "magasinId", "quantite")
SELECT gen_random_uuid()::text, a."id", m."id", a."stock"
FROM "articles_economat" a
JOIN "magasins_stock" m
  ON m."etablissementId" = a."etablissementId" AND m."principal" = true AND m."annuleLe" IS NULL
WHERE a."annuleLe" IS NULL;

-- CUMP amorcé au prix d'achat connu (les prochaines entrées valorisées l'affineront).
UPDATE "articles_economat" SET "cump" = "prixAchat" WHERE "prixAchat" IS NOT NULL AND "cump" IS NULL;
