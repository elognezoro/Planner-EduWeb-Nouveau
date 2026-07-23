-- Formulaire « Nouvelle APFC » (maquette client) : coordonnées de l'antenne — code, localité,
-- adresse, téléphone, e-mail — + contact du responsable d'antenne. Le nom/prénoms du responsable
-- réutilisent les colonnes existantes "chefAntenneNom" / "chefAntennePrenoms" (pas de doublon).
-- Toutes les colonnes sont NULLABLES : aucune valeur requise en base.
ALTER TABLE "apfc" ADD COLUMN "code" TEXT;
ALTER TABLE "apfc" ADD COLUMN "localite" TEXT;
ALTER TABLE "apfc" ADD COLUMN "adresse" TEXT;
ALTER TABLE "apfc" ADD COLUMN "telephone" TEXT;
ALTER TABLE "apfc" ADD COLUMN "email" TEXT;
ALTER TABLE "apfc" ADD COLUMN "chefAntenneContact" TEXT;
