-- Période d'essai d'un utilisateur, fixée par l'admin système lors de l'affectation à un
-- établissement. Pendant l'essai (essaiFinLe > maintenant) : seul l'espace Emplois du temps
-- est éditable ; le reste de la plateforme est accessible en lecture seule.
ALTER TABLE "utilisateurs" ADD COLUMN "essaiDebutLe" TIMESTAMP(3);
ALTER TABLE "utilisateurs" ADD COLUMN "essaiFinLe" TIMESTAMP(3);
