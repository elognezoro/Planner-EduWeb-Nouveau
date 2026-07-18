-- Finances de l'établissement (SRS Finance V1) : rôle « Économe », barèmes de frais
-- (échéanciers, remises, bourses), paiements de scolarité avec reçus numérotés,
-- journal recettes/dépenses (OHADA simplifié), économat (articles, stocks, ventes).

-- Rôle « Économe » (périmètre établissement) — gère les finances de son établissement.
INSERT INTO "roles" ("id", "nomTechnique", "libelle", "description", "rang") VALUES
  ('role_econome', 'econome', 'Économe',
   'Gestion financière de l''établissement : frais et échéanciers, encaissements de scolarité avec reçus, dépenses et recettes, économat (stocks et ventes).', 57)
ON CONFLICT ("nomTechnique") DO NOTHING;

CREATE TABLE "frais_scolarite" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "anneeScolaireId" TEXT,
    "niveauId" TEXT,
    "libelle" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "tranches" JSONB,
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "frais_scolarite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "frais_scolarite_etablissementId_idx" ON "frais_scolarite"("etablissementId");
ALTER TABLE "frais_scolarite" ADD CONSTRAINT "frais_scolarite_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "remises_eleve" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "fraisId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'remise',
    "libelle" TEXT NOT NULL,
    "montant" INTEGER,
    "pourcentage" INTEGER,
    "accordeParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "remises_eleve_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "remises_eleve_etablissementId_idx" ON "remises_eleve"("etablissementId");
CREATE INDEX "remises_eleve_eleveId_idx" ON "remises_eleve"("eleveId");
ALTER TABLE "remises_eleve" ADD CONSTRAINT "remises_eleve_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remises_eleve" ADD CONSTRAINT "remises_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "paiements_scolarite" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "fraisId" TEXT,
    "libelle" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'especes',
    "reference" TEXT,
    "numeroRecu" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annule" BOOLEAN NOT NULL DEFAULT false,
    "motifAnnulation" TEXT,
    "encaisseParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paiements_scolarite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "paiements_scolarite_etablissementId_numeroRecu_key" ON "paiements_scolarite"("etablissementId", "numeroRecu");
CREATE INDEX "paiements_scolarite_etablissementId_date_idx" ON "paiements_scolarite"("etablissementId", "date");
CREATE INDEX "paiements_scolarite_eleveId_idx" ON "paiements_scolarite"("eleveId");
ALTER TABLE "paiements_scolarite" ADD CONSTRAINT "paiements_scolarite_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paiements_scolarite" ADD CONSTRAINT "paiements_scolarite_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operations_financieres" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "sens" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'especes',
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annule" BOOLEAN NOT NULL DEFAULT false,
    "motifAnnulation" TEXT,
    "saisiParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operations_financieres_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "operations_financieres_etablissementId_date_idx" ON "operations_financieres"("etablissementId", "date");
ALTER TABLE "operations_financieres" ADD CONSTRAINT "operations_financieres_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "articles_economat" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT,
    "prixVente" INTEGER NOT NULL,
    "prixAchat" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" INTEGER NOT NULL DEFAULT 5,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "articles_economat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "articles_economat_etablissementId_idx" ON "articles_economat"("etablissementId");
ALTER TABLE "articles_economat" ADD CONSTRAINT "articles_economat_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mouvements_stock" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "montant" INTEGER,
    "mode" TEXT,
    "eleveId" TEXT,
    "acheteur" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saisiParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mouvements_stock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mouvements_stock_articleId_idx" ON "mouvements_stock"("articleId");
CREATE INDEX "mouvements_stock_etablissementId_date_idx" ON "mouvements_stock"("etablissementId", "date");
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles_economat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
