-- Trois nouveaux rôles de pilotage transnational :
--  · superviseur_international : global (tous pays) — Établissements + CAFOP + APFC ;
--  · superviseur_national      : un pays — Établissements du pays ;
--  · representant_pays         : un pays — Établissements + CAFOP + APFC du pays.
-- Insertion idempotente dans la table des rôles (le déploiement Vercel n'exécute pas le seed).
INSERT INTO "roles" ("id", "nomTechnique", "libelle", "description", "rang") VALUES
  ('role_superviseur_international', 'superviseur_international', 'Superviseur International',
   'Accès à tous les Établissements, CAFOP et APFC de tous les pays, pour leur administration et le coaching des représentants-pays.', 90),
  ('role_superviseur_national', 'superviseur_national', 'Superviseur National',
   'Accès à tous les Établissements d''un pays donné, pour leur administration et le coaching des représentants-pays.', 84),
  ('role_representant_pays', 'representant_pays', 'Représentant-Pays',
   'Accès à tous les Établissements, CAFOP et APFC de son pays, pour leur administration et le coaching de ses collaborateurs.', 82)
ON CONFLICT ("nomTechnique") DO NOTHING;
