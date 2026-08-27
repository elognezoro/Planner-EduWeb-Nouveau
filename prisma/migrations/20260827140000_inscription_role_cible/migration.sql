-- Gestion des inscriptions PAR ROLE (Aide et Formation) : le lien direct et l'inscription
-- portent le role vise (identifiant RoleId). Additif, idempotent, nullable.
ALTER TABLE "invitations_cours" ADD COLUMN IF NOT EXISTS "roleCible" TEXT;
ALTER TABLE "inscriptions_cours" ADD COLUMN IF NOT EXISTS "roleCible" TEXT;
