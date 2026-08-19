-- CLOISONNEMENT DES NIVEAUX PAR ÉTABLISSEMENT — correctif de l'audit de cloisonnement :
-- ajouterNiveau / supprimerNiveau écrivaient dans le référentiel NATIONAL partagé depuis la
-- console d'une école (création visible par tous ; suppression détruisant les classes et
-- grilles de TOUS les établissements en cascade).
--
-- Même stratégie « propriétaire optionnel » que les disciplines (migration 20260813090000) :
--   * etablissementId NULL  = niveau du référentiel NATIONAL commun. Ce sont TOUTES les lignes
--     actuelles : aucune n'est modifiée, aucune référence n'est déplacée.
--   * etablissementId NON NULL = niveau créé PAR et POUR un établissement, invisible aux autres.
-- + masquage LOCAL des niveaux nationaux (pattern disciplinesMasquees) : « supprimer » un niveau
-- national depuis une école le retire de SA configuration sans toucher le référentiel.
--
-- Base = PRODUCTION : migration additive écrite à la main, appliquée par vercel-build.

ALTER TABLE "niveaux" ADD COLUMN IF NOT EXISTS "etablissementId" TEXT;

-- Suppression d'un niveau propre à un établissement supprimé : il n'a plus d'objet.
-- Le référentiel national (etablissementId NULL) n'est jamais concerné par cette cascade.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'niveaux_etablissementId_fkey'
  ) THEN
    ALTER TABLE "niveaux"
      ADD CONSTRAINT "niveaux_etablissementId_fkey"
      FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "niveaux_etablissementId_idx" ON "niveaux" ("etablissementId");

-- L'unicité du NOM devient relative au périmètre : deux écoles peuvent créer un niveau
-- « Prépa concours » sans se gêner. ⚠️ Deux NULL étant distincts pour PostgreSQL, l'index
-- composite seul n'unifierait pas le national — d'où l'index partiel (cf. disciplines).
DROP INDEX IF EXISTS "niveaux_nom_key";
CREATE UNIQUE INDEX IF NOT EXISTS "niveaux_etablissementId_nom_key" ON "niveaux" ("etablissementId", "nom");
CREATE UNIQUE INDEX IF NOT EXISTS "niveaux_nom_national_key" ON "niveaux" ("nom") WHERE "etablissementId" IS NULL;

-- Masquage LOCAL des niveaux nationaux (« supprimer » = retirer de SA configuration).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "niveauxMasques" TEXT[] NOT NULL DEFAULT '{}';
