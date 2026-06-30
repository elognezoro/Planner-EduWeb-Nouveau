-- CreateEnum
CREATE TYPE "FormulePremium" AS ENUM ('petit', 'grand');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('carte', 'wave', 'orange', 'mtn', 'moov');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('en_attente', 'actif', 'expire');

-- CreateEnum
CREATE TYPE "StatutDemandePromo" AS ENUM ('en_attente', 'approuvee', 'refusee');

-- CreateTable
CREATE TABLE "codes_promo" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "pourcentage" INTEGER NOT NULL,
    "partenaire" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codes_promo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_code_promo" (
    "id" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "etablissementNom" TEXT,
    "motif" TEXT NOT NULL,
    "statut" "StatutDemandePromo" NOT NULL DEFAULT 'en_attente',
    "codeAttribue" TEXT,
    "traiteLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demandes_code_promo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abonnements_premium" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT,
    "souscritParId" TEXT NOT NULL,
    "formule" "FormulePremium" NOT NULL,
    "montantBase" INTEGER NOT NULL,
    "codePromoId" TEXT,
    "pourcentageReduction" INTEGER NOT NULL DEFAULT 0,
    "montantFinal" INTEGER NOT NULL,
    "modePaiement" "ModePaiement" NOT NULL,
    "statut" "StatutAbonnement" NOT NULL DEFAULT 'en_attente',
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abonnements_premium_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "codes_promo_code_key" ON "codes_promo"("code");

-- CreateIndex
CREATE INDEX "demandes_code_promo_statut_idx" ON "demandes_code_promo"("statut");

-- CreateIndex
CREATE INDEX "abonnements_premium_etablissementId_idx" ON "abonnements_premium"("etablissementId");

-- AddForeignKey
ALTER TABLE "demandes_code_promo" ADD CONSTRAINT "demandes_code_promo_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonnements_premium" ADD CONSTRAINT "abonnements_premium_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonnements_premium" ADD CONSTRAINT "abonnements_premium_souscritParId_fkey" FOREIGN KEY ("souscritParId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abonnements_premium" ADD CONSTRAINT "abonnements_premium_codePromoId_fkey" FOREIGN KEY ("codePromoId") REFERENCES "codes_promo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed des codes promo de référence (cahier partie 7)
INSERT INTO "codes_promo" ("id", "code", "libelle", "pourcentage", "partenaire", "actif") VALUES
  ('cp_eschool2025', 'E-SCHOOL2025', 'Taux préférentiel E-School EduWeb', 20, true, true),
  ('cp_earlybird', 'EARLYBIRD', 'Early bird (avant septembre)', 10, false, true),
  ('cp_groupe5', 'GROUPE5', 'Groupe 5+ établissements', 15, false, true),
  ('cp_izen50', 'IZEN50', 'IZEN Allocation – Soutien 50%', 50, true, true),
  ('cp_izen100', 'IZEN100', 'IZEN Allocation – Soutien complet', 100, true, true);
