-- MODE ASSISTANCE (« Voir comme » avec écriture) : trace de l'administrateur RÉEL qui agit en
-- lieu et place d'un utilisateur. Sans ces colonnes, une écriture d'assistance serait imputée au
-- CLIENT : l'objet de session étant remplacé par la cible, `utilisateurId` désigne la cible.
-- Un `operateurId` NON NUL identifie donc une action d'assistance.
--
-- Base = PRODUCTION : migration écrite à la main, appliquée par `prisma migrate deploy`
-- (vercel-build). 100 % ADDITIVE — colonnes nullables, index conditionnels : aucune ligne
-- existante n'est modifiée, aucun écrivain actuel du journal n'est cassé.

ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "operateurId" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "operateurEmail" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "operateurRole" TEXT;

-- Le journal d'audit FINANCE fait foi pour les opérations d'argent : l'opérateur y est
-- indispensable (il est écrit DANS la transaction métier, cf. journaliserFinance).
ALTER TABLE "journal_audit_finance" ADD COLUMN IF NOT EXISTS "operateurId" TEXT;
ALTER TABLE "journal_audit_finance" ADD COLUMN IF NOT EXISTS "operateurEmail" TEXT;

-- Consultation « toutes les actions d'assistance d'un opérateur, du plus récent au plus ancien ».
CREATE INDEX IF NOT EXISTS "journal_activite_operateurId_creeLe_idx" ON "journal_activite" ("operateurId", "creeLe");
CREATE INDEX IF NOT EXISTS "journal_audit_finance_operateurId_idx" ON "journal_audit_finance" ("operateurId");
