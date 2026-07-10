-- Filtres du répertoire :
--  1) Distinction enseignement technique / formation professionnelle (2 nouvelles valeurs
--     d'enum). Insérées relativement à « lycee » (valeur pré-existante, committée) et en
--     ordre inverse pour que l'ordre final corresponde au schéma :
--     …, lycee, technique, formation_professionnelle, technique_professionnel, …
--  2) Réseau confessionnel de rattachement (SEDEC, Méthodiste, Protestants, Islamique…).
--
-- Les valeurs d'enum ne sont PAS utilisées dans cette migration (aucun INSERT/UPDATE les
-- référençant) : sûr même dans une seule transaction.
ALTER TYPE "TypeEtablissement" ADD VALUE IF NOT EXISTS 'formation_professionnelle' AFTER 'lycee';
ALTER TYPE "TypeEtablissement" ADD VALUE IF NOT EXISTS 'technique' AFTER 'lycee';

ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "reseauConfessionnel" TEXT;
