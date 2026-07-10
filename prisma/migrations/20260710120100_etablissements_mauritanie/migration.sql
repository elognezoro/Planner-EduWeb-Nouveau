-- Répertoire Mauritanie : 15 wilayas officielles + 28 établissements d'enseignement
-- technique et professionnel (annuaire INAP-FTP 2024-2025). Les 14 établissements de
-- Nouakchott sont regroupés provisoirement sous « Nouakchott Ouest » (la source ne
-- précise pas le sous-wilaya) et pourront être répartis Nord/Ouest/Sud ultérieurement.
-- Idempotent : ON CONFLICT DO NOTHING sur les clés uniques (regions.pays_nom, etablissements.code).

-- ── 15 wilayas de Mauritanie ──
INSERT INTO regions (id, nom, pays) VALUES
  (gen_random_uuid()::text, 'Adrar', 'Mauritanie'),
  (gen_random_uuid()::text, 'Assaba', 'Mauritanie'),
  (gen_random_uuid()::text, 'Brakna', 'Mauritanie'),
  (gen_random_uuid()::text, 'Dakhlet Nouadhibou', 'Mauritanie'),
  (gen_random_uuid()::text, 'Gorgol', 'Mauritanie'),
  (gen_random_uuid()::text, 'Guidimakha', 'Mauritanie'),
  (gen_random_uuid()::text, 'Hodh Charghi', 'Mauritanie'),
  (gen_random_uuid()::text, 'Hodh Elgharbi', 'Mauritanie'),
  (gen_random_uuid()::text, 'Inchiri', 'Mauritanie'),
  (gen_random_uuid()::text, 'Nouakchott Nord', 'Mauritanie'),
  (gen_random_uuid()::text, 'Nouakchott Ouest', 'Mauritanie'),
  (gen_random_uuid()::text, 'Nouakchott Sud', 'Mauritanie'),
  (gen_random_uuid()::text, 'Tagant', 'Mauritanie'),
  (gen_random_uuid()::text, 'Tiris Zemmour', 'Mauritanie'),
  (gen_random_uuid()::text, 'Trarza', 'Mauritanie')
ON CONFLICT (pays, nom) DO NOTHING;

-- ── 28 établissements FTP (22 publics, 6 privés), rattachés à leur wilaya ──
INSERT INTO etablissements (id, nom, code, type, statut, ville, pays, "regionId", "misAJourLe") VALUES
  (gen_random_uuid()::text, 'EETFP-KIFFA (Assaba)', 'MR-FTP-001', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Assaba'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP-BOGHE(Brakna)', 'MR-FTP-002', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Brakna'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP-SEILIBABY(Guidimagha)', 'MR-FTP-003', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Guidimakha'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFPI-NKTT (Nouakchott)', 'MR-FTP-004', 'technique_professionnel', 'public', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'IGHRAA NKTT(Nouakchott)', 'MR-FTP-005', 'technique_professionnel', 'public', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP-ATAR(Adrar)', 'MR-FTP-006', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Adrar'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTP-Rosso(Trarza)', 'MR-FTP-007', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Trarza'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTP-TIDJIKJA(Tagant)', 'MR-FTP-008', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Tagant'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP BTP-NKTT(Nouakchott)', 'MR-FTP-009', 'technique_professionnel', 'public', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP-NEMA (Hodh Echarghi)', 'MR-FTP-010', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Hodh Charghi'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTP-NDB (Nouadhibou)', 'MR-FTP-011', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Dakhlet Nouadhibou'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP-AÏOUN (Hodh El Gharbi)', 'MR-FTP-012', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Hodh Elgharbi'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CSET (Nouakchott)', 'MR-FTP-013', 'technique_professionnel', 'public', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP-KAEDI (Gorgol)', 'MR-FTP-014', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Gorgol'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTPC-NKTT (Nouakchott)', 'MR-FTP-015', 'technique_professionnel', 'public', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTP-ALEG (Brakna)', 'MR-FTP-016', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Brakna'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTP-ZOUERATT (Tiris Zemmour)', 'MR-FTP-017', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Tiris Zemmour'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTP-TIC (Nouakchott)', 'MR-FTP-018', 'technique_professionnel', 'public', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP-MPG NKTT (Nouakchott)', 'MR-FTP-019', 'technique_professionnel', 'public', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTP-TIC-NDB (Nouadhibou)', 'MR-FTP-020', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Dakhlet Nouadhibou'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EETFP – BTP-RIADH (Nouakchott)', 'MR-FTP-021', 'technique_professionnel', 'public', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EEFTP AKJOUJET (Inchiri)', 'MR-FTP-022', 'technique_professionnel', 'public', NULL, 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Inchiri'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'IETC NKTT (Nouakchott)', 'MR-FTP-023', 'technique_professionnel', 'prive', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ISI-KUM (Nouakchott)', 'MR-FTP-024', 'technique_professionnel', 'prive', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MIFITT (Nouakchott)', 'MR-FTP-025', 'technique_professionnel', 'prive', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ESTIM (Nouakchott)', 'MR-FTP-026', 'technique_professionnel', 'prive', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'IICM (Nouakchott)', 'MR-FTP-027', 'technique_professionnel', 'prive', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'VADAA (Nouakchott)', 'MR-FTP-028', 'technique_professionnel', 'prive', 'Nouakchott', 'Mauritanie', (SELECT id FROM regions WHERE pays = 'Mauritanie' AND nom = 'Nouakchott Ouest'), CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;
