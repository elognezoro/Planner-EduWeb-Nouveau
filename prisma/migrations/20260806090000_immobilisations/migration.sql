-- Sous-module IMMOBILISATIONS (docs/finance/15-Immobilisations + 05B) : passeport numérique
-- de l'actif (RM-1200 code patrimonial unique), amortissement LINÉAIRE calculé
-- automatiquement (plan DÉRIVÉ, VNC jamais stockée — seules les dotations COMPTABILISÉES
-- persistent, écriture 681/28x, RM-1202 ; pas d'amortissement avant la mise en service,
-- RM-1201), cycle de vie à transitions motivées, maintenance préventive/corrective,
-- réévaluation, sortie d'actif avec écriture comptable (RM-1203) décidée par un SECOND
-- acteur, timeline (passeport). RM-1205 : l'actif issu du stock conserve la référence du
-- mouvement d'origine. Les comptes classe 2/28/68/81/82/106/481 sont semés à la demande par
-- assurerComptesImmobilisations (le plan V1 du dépôt ne portait que les classes 6 et 7).

-- ── 1. Fiche d'immobilisation (passeport) ──
CREATE TABLE "immobilisations" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeBarres" TEXT,
    "designation" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT NOT NULL,
    "sousCategorie" TEXT,
    "numeroSerie" TEXT,
    "dateAcquisition" TIMESTAMP(3) NOT NULL,
    "dateMiseEnService" TIMESTAMP(3),
    "fournisseurId" TEXT,
    "factureReference" TEXT,
    "coutAcquisition" INTEGER NOT NULL,
    "valeurBrute" INTEGER NOT NULL,
    "valeurResiduelle" INTEGER NOT NULL DEFAULT 0,
    "dureeMois" INTEGER NOT NULL DEFAULT 60,
    "modeAmortissement" TEXT NOT NULL DEFAULT 'lineaire',
    "amortissable" BOOLEAN NOT NULL DEFAULT true,
    "modeAcquisition" TEXT NOT NULL DEFAULT 'achat',
    "compteImmo" TEXT NOT NULL,
    "compteAmort" TEXT,
    "garantieFournisseur" TEXT,
    "garantieEcheance" TIMESTAMP(3),
    "localisation" TEXT,
    "responsableId" TEXT,
    "responsableNom" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'acquisition',
    "motifSortie" TEXT,
    "typeSortie" TEXT,
    "dateSortie" TIMESTAMP(3),
    "valeurCession" INTEGER,
    "sortieParId" TEXT,
    "sortieParNom" TEXT,
    "origineArticleId" TEXT,
    "origineMouvementId" TEXT,
    "creeParId" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "immobilisations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "immobilisations_etablissementId_statut_idx" ON "immobilisations"("etablissementId", "statut");
CREATE INDEX "immobilisations_categorie_idx" ON "immobilisations"("categorie");
-- RM-1200 : identifiant patrimonial unique parmi les fiches actives.
CREATE UNIQUE INDEX "immobilisations_code_actif_key" ON "immobilisations"("etablissementId", "code") WHERE "annuleLe" IS NULL;
ALTER TABLE "immobilisations" ADD CONSTRAINT "immobilisations_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "immobilisations" ADD CONSTRAINT "immobilisations_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "immobilisations" ADD CONSTRAINT "immobilisations_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Dotations aux amortissements comptabilisées (RM-1202) ──
CREATE TABLE "dotations_amortissement" (
    "id" TEXT NOT NULL,
    "immobilisationId" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "cumulApres" INTEGER NOT NULL,
    "vncApres" INTEGER NOT NULL,
    "dateComptabilisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comptabiliseParId" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dotations_amortissement_pkey" PRIMARY KEY ("id")
);
-- Une dotation par exercice et par actif (idempotence de la comptabilisation).
CREATE UNIQUE INDEX "dotations_amortissement_immobilisationId_periode_key" ON "dotations_amortissement"("immobilisationId", "periode");
CREATE INDEX "dotations_amortissement_etablissementId_idx" ON "dotations_amortissement"("etablissementId");
ALTER TABLE "dotations_amortissement" ADD CONSTRAINT "dotations_amortissement_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "immobilisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. Maintenance ──
CREATE TABLE "maintenances_immobilisation" (
    "id" TEXT NOT NULL,
    "immobilisationId" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prestataire" TEXT,
    "datePrevue" TIMESTAMP(3),
    "dateRealisee" TIMESTAMP(3),
    "coutPrevu" INTEGER,
    "coutReel" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'planifiee',
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenances_immobilisation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "maintenances_immobilisation_immobilisationId_idx" ON "maintenances_immobilisation"("immobilisationId");
CREATE INDEX "maintenances_immobilisation_etablissementId_statut_idx" ON "maintenances_immobilisation"("etablissementId", "statut");
ALTER TABLE "maintenances_immobilisation" ADD CONSTRAINT "maintenances_immobilisation_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "immobilisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. Timeline du passeport ──
CREATE TABLE "evenements_immobilisation" (
    "id" TEXT NOT NULL,
    "immobilisationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "montant" INTEGER,
    "parId" TEXT,
    "parNom" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evenements_immobilisation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "evenements_immobilisation_immobilisationId_idx" ON "evenements_immobilisation"("immobilisationId");
ALTER TABLE "evenements_immobilisation" ADD CONSTRAINT "evenements_immobilisation_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "immobilisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
