-- Nouveau statut de compte « archive » (action Archiver de la gestion des comptes).
-- Un compte archivé, comme un compte suspendu, ne peut plus se connecter
-- (la connexion exige statutCompte = 'actif').
ALTER TYPE "StatutCompte" ADD VALUE IF NOT EXISTS 'archive';
