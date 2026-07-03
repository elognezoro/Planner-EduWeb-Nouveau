-- Pays de l'utilisateur : détecté à l'inscription (géolocalisation de la requête),
-- modifiable à tout moment dans Mon Profil. Sert au drapeau/indicatif du téléphone
-- et au rapprochement d'établissement par pays lors de la validation du compte.
ALTER TABLE "utilisateurs" ADD COLUMN "pays" TEXT;
