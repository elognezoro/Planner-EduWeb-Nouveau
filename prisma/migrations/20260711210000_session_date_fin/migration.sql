-- AlterTable : date & heure de fin de session (additif, facultatif)
ALTER TABLE "sessions_formation" ADD COLUMN "dateFin" TIMESTAMP(3);
