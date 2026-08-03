-- Effectif souhaité PAR CLASSE propre à un niveau (indicatif, second rang derrière la valeur
-- globale Etablissement.effectifSouhaiteParClasse). Additive et idempotente.
ALTER TABLE "niveaux_etablissement" ADD COLUMN IF NOT EXISTS "effectifSouhaiteClasse" INTEGER;
