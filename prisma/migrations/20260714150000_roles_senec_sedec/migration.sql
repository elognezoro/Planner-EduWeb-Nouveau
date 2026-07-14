-- Périmètre « diocèse » (rôle SEDEC) : sur les établissements catholiques et sur l'utilisateur.
ALTER TABLE "etablissements" ADD COLUMN "diocese" TEXT;
ALTER TABLE "utilisateurs" ADD COLUMN "diocese" TEXT;

-- Deux nouveaux rôles en LECTURE SEULE — enseignement catholique :
--   SENEC (national)  : tous les établissements catholiques (réseau SEDEC) du pays ;
--   SEDEC (diocésain) : les établissements catholiques (réseau SEDEC) d'un diocèse du pays.
INSERT INTO "roles" ("id", "nomTechnique", "libelle", "description", "rang") VALUES
  ('role_senec', 'senec', 'SENEC — Enseignement Catholique National', 'Secrétariat National de l''Enseignement Catholique : consultation en LECTURE SEULE de tous les établissements catholiques (réseau SEDEC) de son pays.', 84),
  ('role_sedec', 'sedec', 'SEDEC — Enseignement Catholique Diocésain', 'Secrétariat Diocésain de l''Enseignement Catholique : consultation en LECTURE SEULE des établissements catholiques (réseau SEDEC) de son diocèse.', 74)
ON CONFLICT ("nomTechnique") DO NOTHING;
