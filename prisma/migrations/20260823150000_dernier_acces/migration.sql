-- Présence (« Utilisateurs connectés ») : dernier accès authentifié, rafraîchi ~1 fois/min
-- par la résolution de session. Additive et idempotente (base = production).
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "dernierAccesLe" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "utilisateurs_dernierAccesLe_idx" ON "utilisateurs"("dernierAccesLe");

-- Pages touchées (balise de navigation) : une ligne par changement de page, purgée à 13 mois.
CREATE TABLE IF NOT EXISTS "acces_pages" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "chemin" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acces_pages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "acces_pages_utilisateurId_date_idx" ON "acces_pages"("utilisateurId", "date");
CREATE INDEX IF NOT EXISTS "acces_pages_date_idx" ON "acces_pages"("date");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acces_pages_utilisateurId_fkey') THEN
    ALTER TABLE "acces_pages"
      ADD CONSTRAINT "acces_pages_utilisateurId_fkey"
      FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
