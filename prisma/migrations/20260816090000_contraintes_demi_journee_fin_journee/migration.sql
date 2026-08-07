-- Contraintes supplémentaires (suite) : une discipline par demi-journée (dure) et
-- fins de journée non répétées (optimisation). Migration additive idempotente.
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "limiterDisciplineParDemiJournee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "eviterMemeDisciplineFinJournee" BOOLEAN NOT NULL DEFAULT false;
