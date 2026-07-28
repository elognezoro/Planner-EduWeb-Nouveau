-- CLOISONNEMENT DES DISCIPLINES PAR ÉTABLISSEMENT (règle client : ce qui se fait dans la page de
-- configuration d'un établissement lui est propre).
--
-- STRATÉGIE « propriétaire optionnel » (option A validée) : on N'ISOLE PAS les lignes existantes.
--   * etablissementId NULL  = discipline du référentiel NATIONAL, commune à tous. Ce sont TOUTES
--     les lignes actuelles : aucune d'elles n'est modifiée, aucune référence n'est déplacée.
--     Les grilles, affectations, notes et cahiers de texte existants restent donc intacts.
--   * etablissementId NON NULL = discipline créée PAR et POUR un établissement, invisible aux
--     autres écoles.
-- Migration ADDITIVE et RÉVERSIBLE : sans code applicatif l'utilisant, le comportement est
-- rigoureusement inchangé.
--
-- Base = PRODUCTION : écrite à la main, appliquée par `prisma migrate deploy` (vercel-build).

ALTER TABLE "disciplines" ADD COLUMN IF NOT EXISTS "etablissementId" TEXT;

-- Suppression d'une discipline propre à un établissement supprimé : elle n'a plus d'objet.
-- Le référentiel national (etablissementId NULL) n'est jamais concerné par cette cascade.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'disciplines_etablissementId_fkey'
  ) THEN
    ALTER TABLE "disciplines"
      ADD CONSTRAINT "disciplines_etablissementId_fkey"
      FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "disciplines_etablissementId_idx" ON "disciplines" ("etablissementId");

-- L'unicité du NOM devient relative au périmètre : deux écoles peuvent nommer une discipline
-- « Informatique » sans se gêner. On retire donc l'unicité globale héritée de l'init.
DROP INDEX IF EXISTS "disciplines_nom_key";

-- Unicité par établissement. ⚠️ PostgreSQL considère deux NULL comme DISTINCTS : cet index seul
-- n'empêcherait donc PAS deux disciplines nationales homonymes — d'où l'index partiel ci-dessous,
-- qui restaure l'unicité du référentiel national. Les deux sont nécessaires.
CREATE UNIQUE INDEX IF NOT EXISTS "disciplines_etablissementId_nom_key"
  ON "disciplines" ("etablissementId", "nom");

CREATE UNIQUE INDEX IF NOT EXISTS "disciplines_nom_national_key"
  ON "disciplines" ("nom") WHERE "etablissementId" IS NULL;
