-- Sous-module DÉPENSES (docs/finance/17-Depenses + 05B) : sorties financières HORS achats —
-- demandes de dépense (workflow demande → validation à SEUILS → engagement budgétaire →
-- décaissement caisse 09 / banque 10 → écriture de charge 11), notes de frais, avances sur
-- frais régularisées, dépenses récurrentes. Une dépense APPROUVÉE engage le budget ; PAYÉE,
-- son OperationFinanciere alimente le consommé (intégration au 16 sans double comptage — les
-- opérations liées aux dépenses/avances sont exclues du consommé « direct » et remplacées par
-- le suivi de la demande). Les dépenses sur achats restent au cycle P2P du 12.

-- ── 1. Demandes de dépense ──
CREATE TABLE "demandes_depense" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "numero" TEXT,
    "type" TEXT NOT NULL DEFAULT 'fonctionnement',
    "objet" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT NOT NULL,
    "centreCoutId" TEXT,
    "service" TEXT,
    "projet" TEXT,
    "beneficiaire" TEXT,
    "montantEstime" INTEGER NOT NULL,
    "montantValide" INTEGER,
    "urgence" TEXT NOT NULL DEFAULT 'normale',
    "pieceJustificative" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "demandeurId" TEXT,
    "demandeurNom" TEXT NOT NULL,
    "decideParId" TEXT,
    "decideParNom" TEXT,
    "dateDecision" TIMESTAMP(3),
    "motifRefus" TEXT,
    "mode" TEXT,
    "reference" TEXT,
    "datePaiement" TIMESTAMP(3),
    "operationId" TEXT,
    "sessionCaisseId" TEXT,
    "payeParId" TEXT,
    "payeParNom" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demandes_depense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "demandes_depense_etablissementId_statut_idx" ON "demandes_depense"("etablissementId", "statut");
CREATE INDEX "demandes_depense_etablissementId_exercice_idx" ON "demandes_depense"("etablissementId", "exercice");
CREATE UNIQUE INDEX "demandes_depense_numero_actif_key" ON "demandes_depense"("etablissementId", "numero") WHERE "annuleLe" IS NULL AND "numero" IS NOT NULL;
ALTER TABLE "demandes_depense" ADD CONSTRAINT "demandes_depense_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demandes_depense" ADD CONSTRAINT "demandes_depense_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Avances sur frais ──
CREATE TABLE "avances_frais" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exercice" TEXT NOT NULL,
    "numero" TEXT,
    "beneficiaireId" TEXT,
    "beneficiaireNom" TEXT NOT NULL,
    "motif" TEXT NOT NULL DEFAULT 'mission',
    "objet" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'especes',
    "reference" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'decaissee',
    "montantJustifie" INTEGER,
    "soldeType" TEXT,
    "operationId" TEXT,
    "operationRegulId" TEXT,
    "sessionCaisseId" TEXT,
    "decaisseParId" TEXT,
    "decaisseParNom" TEXT,
    "dateRegularisation" TIMESTAMP(3),
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "dateComptable" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "avances_frais_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "avances_frais_etablissementId_statut_idx" ON "avances_frais"("etablissementId", "statut");
CREATE UNIQUE INDEX "avances_frais_numero_actif_key" ON "avances_frais"("etablissementId", "numero") WHERE "annuleLe" IS NULL AND "numero" IS NOT NULL;
ALTER TABLE "avances_frais" ADD CONSTRAINT "avances_frais_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "avances_frais" ADD CONSTRAINT "avances_frais_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Dépenses récurrentes ──
CREATE TABLE "depenses_recurrentes" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "centreCoutId" TEXT,
    "montant" INTEGER NOT NULL,
    "periodicite" TEXT NOT NULL DEFAULT 'mensuelle',
    "prochaineEcheance" TIMESTAMP(3) NOT NULL,
    "beneficiaire" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniereGeneration" TIMESTAMP(3),
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "depenses_recurrentes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "depenses_recurrentes_etablissementId_actif_idx" ON "depenses_recurrentes"("etablissementId", "actif");
ALTER TABLE "depenses_recurrentes" ADD CONSTRAINT "depenses_recurrentes_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "depenses_recurrentes" ADD CONSTRAINT "depenses_recurrentes_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
