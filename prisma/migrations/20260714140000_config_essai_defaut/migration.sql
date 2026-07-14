-- Période d'essai par défaut (singleton configuration) : durée = valeur × unité (jour/mois/année),
-- heure de fin optionnelle. Appliquée à l'approbation d'un rôle et aux affectations « Période d'essai ».
ALTER TABLE "configuration" ADD COLUMN "essaiDureeValeur" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "configuration" ADD COLUMN "essaiDureeUnite" TEXT NOT NULL DEFAULT 'jour';
ALTER TABLE "configuration" ADD COLUMN "essaiHeureFin" TEXT;
