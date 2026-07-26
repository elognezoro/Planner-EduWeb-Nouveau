-- Sous-module FOURNISSEURS (docs/finance/13-Fournisseurs + 05B) : le référentiel MINIMUM du
-- 12 devient le RÉFÉRENTIEL UNIQUE — enrichissement par AJOUT STRICT (aucune colonne
-- existante supprimée ni renommée : les BC/factures/paiements/retours du 12 pointent déjà
-- sur « fournisseurs »). Identité juridique complète, catégorisation, conditions
-- commerciales, workflow de QUALIFICATION (prospect → approbation second acteur → actif,
-- SupplierApproved du 92), plus 6 tables satellites : contacts, comptes bancaires,
-- documents administratifs (RM-1003 : expirations dérivées), contrats, évaluations
-- (RM-1004 : score global dérivé), litiges. RM-1001 : doublons RCCM/NIF contrôlés côté
-- serveur (règle « si activée » : bloquante seulement quand le numéro est renseigné).

-- ── 1. Enrichissement de la table fournisseurs (ALTER — jamais destructif) ──
ALTER TABLE "fournisseurs" ADD COLUMN "formeJuridique" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "numeroCnps" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "numeroTva" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "siteWeb" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "region" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "secteurActivite" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "categoriesProduits" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "niveauStrategique" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "fournisseurs" ADD COLUMN "niveauRisque" TEXT NOT NULL DEFAULT 'faible';
ALTER TABLE "fournisseurs" ADD COLUMN "delaiPaiementJours" INTEGER;
ALTER TABLE "fournisseurs" ADD COLUMN "remisePourcent" INTEGER;
ALTER TABLE "fournisseurs" ADD COLUMN "minimumCommande" INTEGER;
ALTER TABLE "fournisseurs" ADD COLUMN "plafondCredit" INTEGER;
ALTER TABLE "fournisseurs" ADD COLUMN "creeParId" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "approuveParId" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "approuveParNom" TEXT;
ALTER TABLE "fournisseurs" ADD COLUMN "dateApprobation" TIMESTAMP(3);

-- ── 2. Contacts ──
CREATE TABLE "contacts_fournisseur" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "fonction" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contacts_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contacts_fournisseur_fournisseurId_idx" ON "contacts_fournisseur"("fournisseurId");
ALTER TABLE "contacts_fournisseur" ADD CONSTRAINT "contacts_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts_fournisseur" ADD CONSTRAINT "contacts_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Comptes bancaires ──
CREATE TABLE "comptes_bancaires_fournisseur" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "banque" TEXT NOT NULL,
    "agence" TEXT,
    "numeroCompte" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "mobileMoney" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comptes_bancaires_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comptes_bancaires_fournisseur_fournisseurId_idx" ON "comptes_bancaires_fournisseur"("fournisseurId");
ALTER TABLE "comptes_bancaires_fournisseur" ADD CONSTRAINT "comptes_bancaires_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comptes_bancaires_fournisseur" ADD CONSTRAINT "comptes_bancaires_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Documents administratifs ──
CREATE TABLE "documents_fournisseur" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "dateEmission" TIMESTAMP(3),
    "dateExpiration" TIMESTAMP(3),
    "numeroVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "documents_fournisseur_fournisseurId_idx" ON "documents_fournisseur"("fournisseurId");
ALTER TABLE "documents_fournisseur" ADD CONSTRAINT "documents_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents_fournisseur" ADD CONSTRAINT "documents_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5. Contrats ──
CREATE TABLE "contrats_fournisseur" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "montant" INTEGER,
    "conditionsPaiement" TEXT,
    "penalites" TEXT,
    "renouvellement" TEXT NOT NULL DEFAULT 'aucun',
    "documentReference" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contrats_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contrats_fournisseur_fournisseurId_idx" ON "contrats_fournisseur"("fournisseurId");
ALTER TABLE "contrats_fournisseur" ADD CONSTRAINT "contrats_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contrats_fournisseur" ADD CONSTRAINT "contrats_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6. Évaluations (RM-1004) ──
CREATE TABLE "evaluations_fournisseur" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "scoreQualite" INTEGER NOT NULL,
    "scoreDelais" INTEGER NOT NULL,
    "scorePrix" INTEGER NOT NULL,
    "scoreService" INTEGER NOT NULL,
    "scoreConformite" INTEGER NOT NULL,
    "commentaire" TEXT,
    "evalueParId" TEXT,
    "evalueParNom" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluations_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "evaluations_fournisseur_fournisseurId_idx" ON "evaluations_fournisseur"("fournisseurId");
ALTER TABLE "evaluations_fournisseur" ADD CONSTRAINT "evaluations_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluations_fournisseur" ADD CONSTRAINT "evaluations_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 7. Litiges ──
CREATE TABLE "litiges_fournisseur" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "gravite" TEXT NOT NULL DEFAULT 'moyenne',
    "responsable" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "solution" TEXT,
    "dateCloture" TIMESTAMP(3),
    "ouvertParId" TEXT,
    "ouvertParNom" TEXT,
    "cloParId" TEXT,
    "cloParNom" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "litiges_fournisseur_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "litiges_fournisseur_fournisseurId_statut_idx" ON "litiges_fournisseur"("fournisseurId", "statut");
ALTER TABLE "litiges_fournisseur" ADD CONSTRAINT "litiges_fournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "litiges_fournisseur" ADD CONSTRAINT "litiges_fournisseur_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
