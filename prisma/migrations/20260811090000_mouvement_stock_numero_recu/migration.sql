-- Reçu numéroté des ventes au comptoir de l'économat : référence de reçu sur MouvementStock.
-- Écrite à la main (base = PRODUCTION), appliquée par `prisma migrate deploy` (vercel-build).
-- Additive et non destructive : un simple ajout de colonne nullable + un index de recherche.

ALTER TABLE "mouvements_stock" ADD COLUMN IF NOT EXISTS "numeroRecu" TEXT;

CREATE INDEX IF NOT EXISTS "mouvements_stock_etablissementId_numeroRecu_idx"
  ON "mouvements_stock" ("etablissementId", "numeroRecu");
