-- Contraintes supplémentaires de génération d'emploi du temps (bloc « Contraintes
-- supplémentaires » de la configuration d'établissement). Migration additive idempotente.
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "interdireMemeDisciplineConsecutive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "interdireLitterairesConsecutifs" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "interdireScientifiquesConsecutifs" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "eviterSeanceIsoleeEnseignant" BOOLEAN NOT NULL DEFAULT false;
