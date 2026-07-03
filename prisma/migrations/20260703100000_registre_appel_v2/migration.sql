-- Registre d'appel v2 (capture de référence) :
--  - heure de la séance sur l'appel (filtre + heatmap par créneau) ;
--  - motif et justification sur chaque présence ;
--  - état civil élève (sexe, matricule) affiché dans le registre.
ALTER TABLE "appels" ADD COLUMN "heureSeance" TEXT;

ALTER TABLE "presences" ADD COLUMN "motif" TEXT;
ALTER TABLE "presences" ADD COLUMN "justifie" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "utilisateurs" ADD COLUMN "sexe" TEXT;
ALTER TABLE "utilisateurs" ADD COLUMN "matricule" TEXT;
