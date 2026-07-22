-- Planification des visites d'inspection — enrichissements (consigne client 2026-07-22) :
-- 1. Spécialité(s) d'encadrement pédagogique de l'inspecteur / du conseiller pédagogique :
--    tableau JSON de noms de disciplines SIMPLES (saisi au bloc « Ma spécialité » de Mon Profil).
ALTER TABLE "utilisateurs" ADD COLUMN "specialites" JSONB;

-- 2. Visite : classe pédagogique objet de la visite (types classe/suivi). Pas de contrainte de
--    clé étrangère : les classes sont recréées à chaque année scolaire — on stocke l'id (jointure
--    possible) ET le nom dénormalisé pour un affichage robuste même si la classe disparaît.
ALTER TABLE "visites" ADD COLUMN "classeId" TEXT;
ALTER TABLE "visites" ADD COLUMN "classeNom" TEXT;

-- 3. Visite : créneau de la séance visitée (ex. « 07h30 - 08h25 », choisi sur l'EDT de
--    l'enseignant) et modalité — « programmee » (annoncée, direction + enseignant notifiés)
--    ou « inopinee » (non annoncée : aucune notification à l'établissement).
ALTER TABLE "visites" ADD COLUMN "heureSeance" TEXT;
ALTER TABLE "visites" ADD COLUMN "modalite" TEXT NOT NULL DEFAULT 'programmee';
