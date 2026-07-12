-- AlterTable : distingue les « Guides d'utilisation » (page Guides) des formations (page Formations)
ALTER TABLE "cours" ADD COLUMN "estGuide" BOOLEAN NOT NULL DEFAULT false;
