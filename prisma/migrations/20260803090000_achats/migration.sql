-- Sous-module ACHATS (docs/finance/12-Achats + 99 WF-004, 05B) : cycle Procure-to-Pay —
-- fournisseurs (MINIMUM du 12, le référentiel complet viendra au 13), demandes d'achat
-- (validation par seuils, séparation demandeur ≠ validateur), consultations/devis, bons de
-- commande (RM-900 : demande approuvée ; RM-901 : fournisseur actif ; RM-905 : engagements),
-- réceptions partielles/totales (RM-902 : cumul ≤ commandé, entrée en stock économat),
-- factures fournisseurs (RM-903 : jamais payées deux fois ; RM-904 : la validation crée
-- l'écriture AC débit charge / crédit 401 du registre 11), paiements (opération 60x +
-- écriture débit 401 / crédit trésorerie), retours (bon BR, stock régularisé, contre-écriture).

-- ── 1. Fournisseurs ──
CREATE TABLE "fournisseurs" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "raisonSociale" TEXT NOT NULL,
    "nomCommercial" TEXT,
    "type" TEXT NOT NULL DEFAULT 'biens',
    "contactNom" TEXT,
    "contactFonction" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "numeroRccm" TEXT,
    "numeroFiscal" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "notes" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fournisseurs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fournisseurs_etablissementId_statut_idx" ON "fournisseurs"("etablissementId", "statut");
CREATE UNIQUE INDEX "fournisseurs_code_actif_key" ON "fournisseurs"("etablissementId", "code") WHERE "annuleLe" IS NULL;
ALTER TABLE "fournisseurs" ADD CONSTRAINT "fournisseurs_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fournisseurs" ADD CONSTRAINT "fournisseurs_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Demandes d'achat ──
CREATE TABLE "demandes_achat" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "numero" TEXT,
    "typeAchat" TEXT NOT NULL DEFAULT 'biens',
    "objet" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "service" TEXT,
    "centreCout" TEXT,
    "urgence" TEXT NOT NULL DEFAULT 'normale',
    "categorieBudget" TEXT NOT NULL,
    "montantEstime" INTEGER NOT NULL,
    "pieceJustificative" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "demandeurId" TEXT,
    "demandeurNom" TEXT NOT NULL,
    "decideParId" TEXT,
    "decideParNom" TEXT,
    "dateDecision" TIMESTAMP(3),
    "motifRefus" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demandes_achat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "demandes_achat_etablissementId_statut_idx" ON "demandes_achat"("etablissementId", "statut");
CREATE INDEX "demandes_achat_etablissementId_exercice_idx" ON "demandes_achat"("etablissementId", "exercice");
CREATE UNIQUE INDEX "demandes_achat_numero_actif_key" ON "demandes_achat"("etablissementId", "numero") WHERE "annuleLe" IS NULL AND "numero" IS NOT NULL;
ALTER TABLE "demandes_achat" ADD CONSTRAINT "demandes_achat_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demandes_achat" ADD CONSTRAINT "demandes_achat_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Devis / consultations fournisseurs ──
CREATE TABLE "devis_fournisseur" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "delaiJours" INTEGER,
    "conditions" TEXT,
    "pieceReference" TEXT,
    "retenu" BOOLEAN NOT NULL DEFAULT false,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devis_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "devis_fournisseur_demandeId_idx" ON "devis_fournisseur"("demandeId");
ALTER TABLE "devis_fournisseur" ADD CONSTRAINT "devis_fournisseur_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "devis_fournisseur" ADD CONSTRAINT "devis_fournisseur_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_achat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "devis_fournisseur" ADD CONSTRAINT "devis_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "devis_fournisseur" ADD CONSTRAINT "devis_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Bons de commande ──
CREATE TABLE "bons_commande" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "numero" TEXT,
    "demandeId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "conditionsPaiement" TEXT,
    "lieuLivraison" TEXT,
    "dateLivraisonPrevue" TIMESTAMP(3),
    "emisParId" TEXT,
    "emisParNom" TEXT,
    "dateEmission" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bons_commande_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bons_commande_etablissementId_statut_idx" ON "bons_commande"("etablissementId", "statut");
CREATE INDEX "bons_commande_demandeId_idx" ON "bons_commande"("demandeId");
CREATE INDEX "bons_commande_fournisseurId_idx" ON "bons_commande"("fournisseurId");
CREATE UNIQUE INDEX "bons_commande_numero_actif_key" ON "bons_commande"("etablissementId", "numero") WHERE "annuleLe" IS NULL AND "numero" IS NOT NULL;
ALTER TABLE "bons_commande" ADD CONSTRAINT "bons_commande_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bons_commande" ADD CONSTRAINT "bons_commande_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_achat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bons_commande" ADD CONSTRAINT "bons_commande_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bons_commande" ADD CONSTRAINT "bons_commande_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5. Lignes de bon de commande ──
CREATE TABLE "lignes_bon_commande" (
    "id" TEXT NOT NULL,
    "bonCommandeId" TEXT NOT NULL,
    "articleId" TEXT,
    "designation" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lignes_bon_commande_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lignes_bon_commande_bonCommandeId_idx" ON "lignes_bon_commande"("bonCommandeId");
ALTER TABLE "lignes_bon_commande" ADD CONSTRAINT "lignes_bon_commande_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "bons_commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lignes_bon_commande" ADD CONSTRAINT "lignes_bon_commande_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6. Réceptions ──
CREATE TABLE "receptions_achat" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "bonCommandeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receptionnaireId" TEXT,
    "receptionnaireNom" TEXT NOT NULL,
    "observations" TEXT,
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "receptions_achat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "receptions_achat_bonCommandeId_idx" ON "receptions_achat"("bonCommandeId");
CREATE INDEX "receptions_achat_etablissementId_idx" ON "receptions_achat"("etablissementId");
ALTER TABLE "receptions_achat" ADD CONSTRAINT "receptions_achat_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receptions_achat" ADD CONSTRAINT "receptions_achat_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "bons_commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receptions_achat" ADD CONSTRAINT "receptions_achat_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 7. Lignes de réception ──
CREATE TABLE "lignes_reception" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "ligneBonCommandeId" TEXT NOT NULL,
    "quantiteRecue" INTEGER NOT NULL,
    "quantiteRefusee" INTEGER NOT NULL DEFAULT 0,
    "observation" TEXT,
    "mouvementStockId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lignes_reception_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lignes_reception_receptionId_idx" ON "lignes_reception"("receptionId");
CREATE INDEX "lignes_reception_ligneBonCommandeId_idx" ON "lignes_reception"("ligneBonCommandeId");
ALTER TABLE "lignes_reception" ADD CONSTRAINT "lignes_reception_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "receptions_achat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lignes_reception" ADD CONSTRAINT "lignes_reception_ligneBonCommandeId_fkey" FOREIGN KEY ("ligneBonCommandeId") REFERENCES "lignes_bon_commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 8. Factures fournisseurs ──
CREATE TABLE "factures_fournisseur" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "bonCommandeId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "numeroFournisseur" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montant" INTEGER NOT NULL,
    "taxes" INTEGER NOT NULL DEFAULT 0,
    "dateEcheance" TIMESTAMP(3),
    "pieceJustificative" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'saisie',
    "valideeParId" TEXT,
    "valideeParNom" TEXT,
    "dateValidation" TIMESTAMP(3),
    "motifAnnulation" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "factures_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "factures_fournisseur_etablissementId_statut_idx" ON "factures_fournisseur"("etablissementId", "statut");
CREATE INDEX "factures_fournisseur_bonCommandeId_idx" ON "factures_fournisseur"("bonCommandeId");
-- RM-903 (amont) : une même facture fournisseur n'est jamais SAISIE deux fois.
CREATE UNIQUE INDEX "factures_fournisseur_numero_actif_key" ON "factures_fournisseur"("etablissementId", "fournisseurId", "numeroFournisseur") WHERE "annuleLe" IS NULL;
ALTER TABLE "factures_fournisseur" ADD CONSTRAINT "factures_fournisseur_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "factures_fournisseur" ADD CONSTRAINT "factures_fournisseur_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "bons_commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "factures_fournisseur" ADD CONSTRAINT "factures_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "factures_fournisseur" ADD CONSTRAINT "factures_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 9. Paiements fournisseurs ──
CREATE TABLE "paiements_fournisseur" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'especes',
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operationId" TEXT,
    "payeParId" TEXT,
    "payeParNom" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paiements_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "paiements_fournisseur_factureId_idx" ON "paiements_fournisseur"("factureId");
CREATE INDEX "paiements_fournisseur_etablissementId_idx" ON "paiements_fournisseur"("etablissementId");
ALTER TABLE "paiements_fournisseur" ADD CONSTRAINT "paiements_fournisseur_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paiements_fournisseur" ADD CONSTRAINT "paiements_fournisseur_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures_fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paiements_fournisseur" ADD CONSTRAINT "paiements_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 10. Retours fournisseurs ──
CREATE TABLE "retours_fournisseur" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "bonCommandeId" TEXT NOT NULL,
    "ligneBonCommandeId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "mouvementStockId" TEXT,
    "retourneParId" TEXT,
    "retourneParNom" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retours_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "retours_fournisseur_bonCommandeId_idx" ON "retours_fournisseur"("bonCommandeId");
CREATE INDEX "retours_fournisseur_etablissementId_idx" ON "retours_fournisseur"("etablissementId");
CREATE UNIQUE INDEX "retours_fournisseur_numero_actif_key" ON "retours_fournisseur"("etablissementId", "numero") WHERE "annuleLe" IS NULL;
ALTER TABLE "retours_fournisseur" ADD CONSTRAINT "retours_fournisseur_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retours_fournisseur" ADD CONSTRAINT "retours_fournisseur_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "bons_commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retours_fournisseur" ADD CONSTRAINT "retours_fournisseur_ligneBonCommandeId_fkey" FOREIGN KEY ("ligneBonCommandeId") REFERENCES "lignes_bon_commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retours_fournisseur" ADD CONSTRAINT "retours_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
