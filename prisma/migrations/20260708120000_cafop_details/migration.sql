-- Fiche détaillée des centres CAFOP (tableau de bord « Gestion des CAFOP »).
ALTER TABLE "cafops" ADD COLUMN "code" TEXT;
ALTER TABLE "cafops" ADD COLUMN "pays" TEXT NOT NULL DEFAULT 'Côte d''Ivoire';
ALTER TABLE "cafops" ADD COLUMN "drena" TEXT;
ALTER TABLE "cafops" ADD COLUMN "localite" TEXT;
ALTER TABLE "cafops" ADD COLUMN "directeur" TEXT;
ALTER TABLE "cafops" ADD COLUMN "directeurTel" TEXT;
ALTER TABLE "cafops" ADD COLUMN "effectif" INTEGER NOT NULL DEFAULT 0;

-- Vue « Promotions » : groupes, effectif et avancement par promotion.
ALTER TABLE "cohortes" ADD COLUMN "nbCohortes" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cohortes" ADD COLUMN "effectif" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cohortes" ADD COLUMN "progression" INTEGER NOT NULL DEFAULT 0;
