-- Fondation TRANSVERSE du module Finance (docs/finance/03-Regles-Metier + 05B) :
-- RM-003/011/017 journal d'audit financier inviolable (append-only, IP/navigateur, anciennes/nouvelles valeurs),
-- RM-004 annulations logiques (annuleLe/annuleParId) sur tous les modèles financiers,
-- RM-007 devise par opération + taux de change historisés,
-- RM-008 dates comptables (dateComptable, dateValidation),
-- RM-014 séquences de numérotation configurables (équivalent numbering_sequences),
-- RM-019 verrouillage optimiste (colonne version).

-- ── 1. Journal d'audit financier inviolable (append-only : jamais d'UPDATE/DELETE applicatif) ──
CREATE TABLE "journal_audit_finance" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exerciceId" TEXT,
    "utilisateurId" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "ancienneValeur" JSONB,
    "nouvelleValeur" JSONB,
    "ip" TEXT,
    "navigateur" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_audit_finance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "journal_audit_finance_etablissementId_creeLe_idx" ON "journal_audit_finance"("etablissementId", "creeLe");
CREATE INDEX "journal_audit_finance_entite_entiteId_idx" ON "journal_audit_finance"("entite", "entiteId");
CREATE INDEX "journal_audit_finance_utilisateurId_idx" ON "journal_audit_finance"("utilisateurId");
-- RESTRICT : l'audit ne disparaît JAMAIS (aucune cascade ne peut le détruire).
ALTER TABLE "journal_audit_finance" ADD CONSTRAINT "journal_audit_finance_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_audit_finance" ADD CONSTRAINT "journal_audit_finance_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Taux de change historisés (RM-007) ──
CREATE TABLE "taux_change" (
    "id" TEXT NOT NULL,
    "deviseSource" TEXT NOT NULL,
    "deviseCible" TEXT NOT NULL,
    "taux" DECIMAL(18,8) NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    "creeParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "taux_change_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "taux_change_deviseSource_deviseCible_dateEffet_idx" ON "taux_change"("deviseSource", "deviseCible", "dateEffet");
ALTER TABLE "taux_change" ADD CONSTRAINT "taux_change_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. Séquences de numérotation configurables (RM-014) ──
CREATE TABLE "sequences_numerotation" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "exerciceId" TEXT,
    "type" TEXT NOT NULL,
    "prefixe" TEXT NOT NULL,
    "prochainNumero" INTEGER NOT NULL DEFAULT 1,
    "largeur" INTEGER NOT NULL DEFAULT 6,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sequences_numerotation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sequences_numerotation_etablissementId_exerciceId_type_key" ON "sequences_numerotation"("etablissementId", "exerciceId", "type");
-- Les NULL étant distincts dans un index unique PostgreSQL, un index PARTIEL garantit aussi
-- l'unicité des séquences SANS exercice (exerciceId NULL) par établissement et type.
CREATE UNIQUE INDEX "sequences_numerotation_sans_exercice_key" ON "sequences_numerotation"("etablissementId", "type") WHERE "exerciceId" IS NULL;
ALTER TABLE "sequences_numerotation" ADD CONSTRAINT "sequences_numerotation_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. Colonnes transverses sur les modèles financiers existants ──
-- (toutes nullables ou avec défaut : les données de production restent valides telles quelles)

-- Barème des frais
ALTER TABLE "frais_scolarite" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "frais_scolarite" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "frais_scolarite" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "frais_scolarite" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "frais_scolarite" ADD CONSTRAINT "frais_scolarite_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remises & bourses
ALTER TABLE "remises_eleve" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "remises_eleve" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "remises_eleve" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "remises_eleve" ADD CONSTRAINT "remises_eleve_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Paiements de scolarité (reçus numérotés)
ALTER TABLE "paiements_scolarite" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "paiements_scolarite" ADD COLUMN "dateComptable" TIMESTAMP(3);
ALTER TABLE "paiements_scolarite" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "paiements_scolarite" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "paiements_scolarite" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "paiements_scolarite" ADD CONSTRAINT "paiements_scolarite_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Journal de caisse & banque
ALTER TABLE "operations_financieres" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "operations_financieres" ADD COLUMN "dateComptable" TIMESTAMP(3);
ALTER TABLE "operations_financieres" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "operations_financieres" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "operations_financieres" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "operations_financieres" ADD CONSTRAINT "operations_financieres_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Économat : articles
ALTER TABLE "articles_economat" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "articles_economat" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "articles_economat" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "articles_economat" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "articles_economat" ADD CONSTRAINT "articles_economat_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Économat : mouvements de stock
ALTER TABLE "mouvements_stock" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "mouvements_stock" ADD COLUMN "dateComptable" TIMESTAMP(3);
ALTER TABLE "mouvements_stock" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "mouvements_stock" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Relevés bancaires (rapprochement)
ALTER TABLE "releves_bancaires" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "releves_bancaires" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "releves_bancaires" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "releves_bancaires" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "releves_bancaires" ADD CONSTRAINT "releves_bancaires_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Budget prévisionnel
ALTER TABLE "budget_lignes" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "budget_lignes" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "budget_lignes" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "budget_lignes" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "budget_lignes" ADD CONSTRAINT "budget_lignes_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Clôtures d'exercice : la réouverture devient une ANNULATION logique (plus de suppression
-- physique) ; l'unicité (etablissementId, exercice) ne doit donc porter que sur les clôtures
-- ACTIVES pour permettre de re-clôturer un exercice rouvert sous le même libellé.
ALTER TABLE "clotures_exercice" ADD COLUMN "devise" TEXT NOT NULL DEFAULT 'XOF';
ALTER TABLE "clotures_exercice" ADD COLUMN "dateValidation" TIMESTAMP(3);
ALTER TABLE "clotures_exercice" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clotures_exercice" ADD COLUMN "annuleLe" TIMESTAMP(3);
ALTER TABLE "clotures_exercice" ADD COLUMN "annuleParId" TEXT;
ALTER TABLE "clotures_exercice" ADD CONSTRAINT "clotures_exercice_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX "clotures_exercice_etablissementId_exercice_key";
CREATE INDEX "clotures_exercice_etablissementId_exercice_idx" ON "clotures_exercice"("etablissementId", "exercice");
CREATE UNIQUE INDEX "clotures_exercice_active_par_exercice_key" ON "clotures_exercice"("etablissementId", "exercice") WHERE "annuleLe" IS NULL;
