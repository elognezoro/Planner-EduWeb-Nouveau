-- PARRAINAGE — lien unique par utilisateur + grand livre des commissions (10 % récurrent).
--
-- Base = PRODUCTION : écrite à la main, appliquée par prisma migrate deploy. 100 % ADDITIVE —
-- colonnes nullables et table nouvelle, aucune donnée existante modifiée.

-- 1) Rattachement parrain → filleul sur le compte (nullable : les comptes existants n'ont pas de
--    parrain ; auto-parrainage et réécriture empêchés côté code).
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "codeParrainage" TEXT;
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "parrainId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "utilisateurs_codeParrainage_key" ON "utilisateurs" ("codeParrainage");
CREATE INDEX IF NOT EXISTS "utilisateurs_parrainId_idx" ON "utilisateurs" ("parrainId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'utilisateurs_parrainId_fkey') THEN
    ALTER TABLE "utilisateurs"
      ADD CONSTRAINT "utilisateurs_parrainId_fkey"
      FOREIGN KEY ("parrainId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Grand livre des commissions.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatutCommission') THEN
    CREATE TYPE "StatutCommission" AS ENUM ('acquise', 'versee', 'creditee', 'annulee');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "commissions_parrainage" (
  "id"            TEXT NOT NULL,
  "parrainId"     TEXT NOT NULL,
  "filleulId"     TEXT NOT NULL,
  "abonnementId"  TEXT NOT NULL,
  "montantBase"   INTEGER NOT NULL,
  "taux"          INTEGER NOT NULL DEFAULT 10,
  "montant"       INTEGER NOT NULL,
  "statut"        "StatutCommission" NOT NULL DEFAULT 'acquise',
  "regleLe"       TIMESTAMP(3),
  "regleParEmail" TEXT,
  "reference"     TEXT,
  "creeLe"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commissions_parrainage_pkey" PRIMARY KEY ("id")
);

-- Une seule commission par abonnement (idempotence du rejeu de souscription).
CREATE UNIQUE INDEX IF NOT EXISTS "commissions_parrainage_abonnementId_key" ON "commissions_parrainage" ("abonnementId");
CREATE INDEX IF NOT EXISTS "commissions_parrainage_parrainId_statut_idx" ON "commissions_parrainage" ("parrainId", "statut");
CREATE INDEX IF NOT EXISTS "commissions_parrainage_filleulId_idx" ON "commissions_parrainage" ("filleulId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_parrainage_parrainId_fkey') THEN
    ALTER TABLE "commissions_parrainage" ADD CONSTRAINT "commissions_parrainage_parrainId_fkey"
      FOREIGN KEY ("parrainId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_parrainage_filleulId_fkey') THEN
    ALTER TABLE "commissions_parrainage" ADD CONSTRAINT "commissions_parrainage_filleulId_fkey"
      FOREIGN KEY ("filleulId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commissions_parrainage_abonnementId_fkey') THEN
    ALTER TABLE "commissions_parrainage" ADD CONSTRAINT "commissions_parrainage_abonnementId_fkey"
      FOREIGN KEY ("abonnementId") REFERENCES "abonnements_premium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
