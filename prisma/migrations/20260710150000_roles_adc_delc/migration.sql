-- Deux rôles CAFOP en LECTURE SEULE :
--  · delc : Directeur Central en charge des établissements scolaires — consultation (sans modifier)
--           de TOUTES les pages des CAFOP de son pays (périmètre « pays ») ;
--  · adc  : Adjoint au Directeur de CAFOP — consultation (sans modifier) du cahier de texte, du
--           registre d'appel et des notes & bulletins de SON centre (périmètre « cafop »).
-- L'interdiction d'écriture est garantie côté serveur : peutGererCafop / cafopAutorise
-- n'autorisent que admin + cafop_admin. Ces rôles ne sont ajoutés à aucune garde d'écriture.
-- Insertion idempotente (le déploiement Vercel n'exécute pas le seed).
INSERT INTO "roles" ("id", "nomTechnique", "libelle", "description", "rang") VALUES
  ('role_delc', 'delc', 'Directeur Central (DELC)',
   'Directeur Central en charge des établissements scolaires : consultation en LECTURE SEULE de toutes les pages des CAFOP de son pays.', 83),
  ('role_adc', 'adc', 'Adjoint au Directeur de CAFOP (ADC)',
   'Seconde le directeur du CAFOP : consultation en LECTURE SEULE du cahier de texte, du registre d''appel et des notes & bulletins de son centre.', 72)
ON CONFLICT ("nomTechnique") DO NOTHING;
