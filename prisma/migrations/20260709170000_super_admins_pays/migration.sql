-- Remplacement du « Superviseur national » par trois Super Admin spécialisés par structure,
-- tous à périmètre « pays » (droit d'éditer/configurer, dans un pays donné) :
--   super_admin_cafop · super_admin_etablissements · super_admin_apfc.
INSERT INTO "roles" ("id", "nomTechnique", "libelle", "description", "rang") VALUES
  ('role_super_admin_cafop', 'super_admin_cafop', 'Super Admin CAFOP',
   'Accès à tous les CAFOP d''un pays donné, avec le droit de les éditer et de les configurer.', 84),
  ('role_super_admin_etablissements', 'super_admin_etablissements', 'Super Admin Établissements',
   'Accès à tous les établissements d''un pays donné, avec le droit de les éditer et de les configurer.', 84),
  ('role_super_admin_apfc', 'super_admin_apfc', 'Super Admin APFC',
   'Accès à toutes les APFC d''un pays donné, avec le droit de les éditer et de les configurer.', 84)
ON CONFLICT ("nomTechnique") DO NOTHING;

-- Retrait de l'ancien rôle « Superviseur national », uniquement s'il n'est référencé
-- par aucun compte ni aucune demande de rôle (sécurité : jamais de suppression en cascade).
DELETE FROM "roles"
WHERE "nomTechnique" = 'superviseur_national'
  AND NOT EXISTS (SELECT 1 FROM "utilisateurs" u WHERE u."roleActifId" = "roles"."id")
  AND NOT EXISTS (SELECT 1 FROM "demandes_role" d WHERE d."roleDemandeId" = "roles"."id");
