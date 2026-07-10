-- Nouveau type d'établissement : « Enseignement technique et professionnel »
-- (établissements EETFP/EEFTP — annuaire FTP). Ajouté dans une migration séparée
-- de l'insertion des données : PostgreSQL interdit d'utiliser une valeur d'enum
-- fraîchement ajoutée dans la même transaction que celle qui l'a créée.
ALTER TYPE "TypeEtablissement" ADD VALUE IF NOT EXISTS 'technique_professionnel' AFTER 'lycee';
