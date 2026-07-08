-- Documents officiels du CAFOP (Vercel Blob) + année de formation des élèves-maîtres.
ALTER TABLE "cafops" ADD COLUMN "emblemeUrl" TEXT;
ALTER TABLE "cafops" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "cafops" ADD COLUMN "cachetUrl" TEXT;
ALTER TABLE "cafops" ADD COLUMN "signatureUrl" TEXT;

ALTER TABLE "apprenants" ADD COLUMN "annee" INTEGER;
