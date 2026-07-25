-- Rôles financiers & permissions (docs/finance/04-Profils P-004→P-008/P-016/P-017 +
-- 97-RBAC RM-2600→2605) : famille FINANCE de rôles à portée établissement (hiérarchie sous le
-- Chef d'établissement, l'Économe existant garde ses droits et rejoint la famille) + table des
-- DÉLÉGATIONS de permissions temporaires (fin obligatoire, expiration évaluée à la
-- vérification, révocation = annulation logique, auditée via journal_audit_finance).
-- Le registre des permissions et la matrice rôle → permissions vivent EN CODE
-- (src/lib/finances/commun/permissions.ts), conformément au 97 (« référentiel maintenu avec
-- le code source ») et au RBAC existant.

-- ── 1. Famille FINANCE : nouveaux rôles (pattern du rôle econome, 20260718010000) ──
INSERT INTO "roles" ("id", "nomTechnique", "libelle", "description", "rang") VALUES
  ('role_gestionnaire_financier', 'gestionnaire_financier', 'Gestionnaire Financier',
   'Responsable administratif et financier de l''établissement : frais scolaires, budgets, trésorerie, supervision des caisses, approbation de dépenses, clôtures d''exercice.', 57),
  ('role_comptable', 'comptable', 'Comptable',
   'Comptabilité de l''établissement : consultation des écritures, journaux, balance et états financiers, rapprochements bancaires, écritures d''ajustement autorisées et exports comptables.', 54),
  ('role_caissier', 'caissier', 'Caissier',
   'Caisse de l''établissement : encaissement des paiements de scolarité avec reçus numérotés, avances et acomptes, paiement des remboursements autorisés. Ne modifie ni les frais, ni les budgets.', 53),
  ('role_magasinier', 'magasinier', 'Magasinier',
   'Stocks de l''économat : entrées, sorties et inventaires, consultation des articles. Ne modifie pas les prix et ne supprime aucun mouvement.', 52),
  ('role_auditeur', 'auditeur', 'Auditeur',
   'Audit financier : consultation en LECTURE SEULE de toutes les données financières de l''établissement, exports de rapports, journaux et historiques. Ne modifie jamais une donnée.', 51),
  ('role_commissaire_comptes', 'commissaire_comptes', 'Commissaire aux Comptes',
   'Contrôle légal des comptes : mêmes droits de LECTURE SEULE que l''auditeur, accès temporaire possible (période d''essai ou délégation datée). Ne modifie jamais une donnée.', 51)
ON CONFLICT ("nomTechnique") DO NOTHING;

-- ── 2. Délégations de permissions Finance (97 : RM-2604 — permissions temporaires) ──
CREATE TABLE "delegations_finance" (
    "id" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "beneficiaireId" TEXT NOT NULL,
    "accordeParId" TEXT,
    "permissions" JSONB NOT NULL,
    "motif" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delegations_finance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "delegations_finance_etablissementId_fin_idx" ON "delegations_finance"("etablissementId", "fin");
CREATE INDEX "delegations_finance_beneficiaireId_fin_idx" ON "delegations_finance"("beneficiaireId", "fin");
ALTER TABLE "delegations_finance" ADD CONSTRAINT "delegations_finance_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delegations_finance" ADD CONSTRAINT "delegations_finance_beneficiaireId_fkey" FOREIGN KEY ("beneficiaireId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delegations_finance" ADD CONSTRAINT "delegations_finance_accordeParId_fkey" FOREIGN KEY ("accordeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delegations_finance" ADD CONSTRAINT "delegations_finance_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
