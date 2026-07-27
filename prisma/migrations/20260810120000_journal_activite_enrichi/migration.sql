-- Traçabilité unifiée : enrichissement du journal d'activité pour couvrir TOUTES les activités.
-- Écrite à la main (base = PRODUCTION) ; appliquée par `prisma migrate deploy` dans vercel-build.
-- Uniquement des AJOUTS de colonnes nullables / à défaut sûr : aucune donnée existante modifiée,
-- les 9 écrivains historiques du journal continuent de fonctionner à l'identique.

ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "acteurRole" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "etablissementId" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "operation" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "entite" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "entiteId" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "ancienneValeur" JSONB;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "nouvelleValeur" JSONB;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "navigateur" TEXT;
ALTER TABLE "journal_activite" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'metier';

CREATE INDEX IF NOT EXISTS "journal_activite_etablissementId_idx" ON "journal_activite" ("etablissementId");
CREATE INDEX IF NOT EXISTS "journal_activite_entite_idx" ON "journal_activite" ("entite");
