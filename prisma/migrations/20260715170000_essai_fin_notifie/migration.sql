-- AlterTable : horodatage de l'e-mail automatique de fin de période d'essai (anti-doublon).
ALTER TABLE "utilisateurs" ADD COLUMN "essaiFinNotifieLe" TIMESTAMP(3);
