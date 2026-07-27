-- Scalabilité : index sur les colonnes de date filtrées par les compteurs d'activité et le viewer
-- d'audit (rapports/activité comptent par creeLe, aujourd'hui sans index → scans séquentiels).
-- Écrite à la main (base = PROD), appliquée par vercel-build. Additive et non destructive.
-- (Index posés maintenant, tant que les tables sont encore modestes.)

CREATE INDEX IF NOT EXISTS "inscriptions_creeLe_idx" ON "inscriptions" ("creeLe");
CREATE INDEX IF NOT EXISTS "appels_classeId_date_idx" ON "appels" ("classeId", "date");
CREATE INDEX IF NOT EXISTS "appels_creeLe_idx" ON "appels" ("creeLe");
CREATE INDEX IF NOT EXISTS "notes_creeLe_idx" ON "notes" ("creeLe");
CREATE INDEX IF NOT EXISTS "cahier_texte_creeLe_idx" ON "cahier_texte" ("creeLe");
CREATE INDEX IF NOT EXISTS "messages_creeLe_idx" ON "messages" ("creeLe");
CREATE INDEX IF NOT EXISTS "journal_activite_etablissementId_creeLe_idx" ON "journal_activite" ("etablissementId", "creeLe");
