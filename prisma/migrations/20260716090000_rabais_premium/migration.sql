-- AlterTable : demandes de rabais Premium — taux souhaité par le demandeur, taux accordé.
ALTER TABLE "demandes_code_promo" ADD COLUMN "tauxDemande" INTEGER;
ALTER TABLE "demandes_code_promo" ADD COLUMN "tauxAccorde" INTEGER;

-- AlterTable : utilisateurs habilités (e-mails) à instruire les rabais, en plus de l'admin.
ALTER TABLE "configuration" ADD COLUMN "emailsHabilitesRabais" TEXT;
