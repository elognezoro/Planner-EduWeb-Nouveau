-- Jours de recherche (repos) par enseignant : { "<enseignantId>": nombre } — absent => 1 jour
-- quand reposEnseignant est actif. Additive, idempotente, valeur par defaut vide.
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "joursReposParEnseignant" JSONB NOT NULL DEFAULT '{}';
