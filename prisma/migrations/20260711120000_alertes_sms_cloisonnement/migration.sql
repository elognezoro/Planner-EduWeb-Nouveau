-- Cloisonnement de l'historique des alertes SMS par établissement et par pays.
-- Auparavant, la page « Alertes & SMS » lisait TOUTES les lignes sans filtre de périmètre
-- (fuite inter-établissement / inter-pays). On rattache désormais chaque alerte à son
-- établissement émetteur (FK) et à son pays.

-- 1. Nouvelles colonnes (nullables : CAFOP sans établissement, anciennes lignes).
ALTER TABLE "alertes_sms" ADD COLUMN "etablissementId" TEXT;
ALTER TABLE "alertes_sms" ADD COLUMN "pays" TEXT;

-- 2. Backfill best-effort : rattacher les alertes existantes à l'établissement dont le nom
--    correspond ET est UNIQUE (les homonymes inter-pays restent non rattachés, donc invisibles
--    dans les vues cloisonnées — comportement volontairement conservateur pour un correctif de fuite).
UPDATE "alertes_sms" a
SET "etablissementId" = e."id",
    "pays"            = e."pays"
FROM "etablissements" e
WHERE a."etablissementNom" = e."nom"
  AND e."nom" IN (
    SELECT "nom" FROM "etablissements" GROUP BY "nom" HAVING COUNT(*) = 1
  );

-- 3. Renseigner le pays des alertes CAFOP (nom de centre unique), sans FK établissement.
UPDATE "alertes_sms" a
SET "pays" = c."pays"
FROM "cafops" c
WHERE a."pays" IS NULL
  AND a."etablissementId" IS NULL
  AND a."etablissementNom" = c."nom"
  AND c."nom" IN (
    SELECT "nom" FROM "cafops" GROUP BY "nom" HAVING COUNT(*) = 1
  );

-- 4. Index de filtrage.
CREATE INDEX "alertes_sms_etablissementId_idx" ON "alertes_sms"("etablissementId");
CREATE INDEX "alertes_sms_pays_idx" ON "alertes_sms"("pays");

-- 5. Contrainte de clé étrangère (SET NULL : la suppression d'un établissement ne détruit pas l'historique).
ALTER TABLE "alertes_sms"
  ADD CONSTRAINT "alertes_sms_etablissementId_fkey"
  FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
