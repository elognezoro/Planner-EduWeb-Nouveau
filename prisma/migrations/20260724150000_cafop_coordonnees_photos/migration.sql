-- Bulletins des élèves-maîtres (CAFOP) : coordonnées du centre en en-tête gauche
-- (adresse postale, téléphone, e-mail — le logo réutilise la colonne existante "logoUrl")
-- + photo d'identité de l'élève-maître (Vercel Blob, recadrée 3:4 côté serveur).
-- Toutes les colonnes sont NULLABLES : aucune valeur requise en base.
ALTER TABLE "cafops" ADD COLUMN "adresse" TEXT;
ALTER TABLE "cafops" ADD COLUMN "telephone" TEXT;
ALTER TABLE "cafops" ADD COLUMN "email" TEXT;
ALTER TABLE "apprenants" ADD COLUMN "photoUrl" TEXT;
