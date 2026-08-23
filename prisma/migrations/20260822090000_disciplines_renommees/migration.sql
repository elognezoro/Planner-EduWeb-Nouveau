-- Renommage LOCAL (« expression ») des disciplines du référentiel NATIONAL, par établissement :
-- { disciplineId: libellé local }. Le référentiel partagé n'est jamais modifié — seul l'affichage
-- de CET établissement change (crayon du bloc « Effectifs des enseignants par cycle et spécialité »).
-- Migration additive idempotente.
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "disciplinesRenommees" JSONB;
