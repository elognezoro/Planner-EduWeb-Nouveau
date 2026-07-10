-- Scission du « Nom et prénoms » du chef d'établissement : nomChef (NOM en majuscules)
-- et prenomsChef (Prénoms en casse titre). L'ancien nomChef combiné reste tel quel
-- jusqu'à la prochaine sauvegarde (scission d'affichage assurée côté page serveur).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "prenomsChef" TEXT;
