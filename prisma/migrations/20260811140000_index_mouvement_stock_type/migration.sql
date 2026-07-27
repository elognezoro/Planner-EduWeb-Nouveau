-- Scalabilité Finances : les KPI du tableau de bord agrègent les VENTES d'économat
-- (mouvementStock.groupBy/aggregate avec where type='vente') sur une table qui contient
-- AUSSI tous les autres mouvements (entrées, ajustements, sorties, réservations). Sans index
-- sur `type`, ces agrégats scannent l'ensemble des mouvements de l'établissement.
-- Écrite à la main (base = PROD), appliquée par vercel-build. Additive, non destructive.
CREATE INDEX IF NOT EXISTS "mouvements_stock_etablissementId_type_idx" ON "mouvements_stock" ("etablissementId", "type");
