-- Lien d'inscription directe à un cours (généré par tuteur/admin). Additif et idempotent.
CREATE TABLE IF NOT EXISTS "invitations_cours" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "coursId" TEXT NOT NULL,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "expiration" TIMESTAMP(3),
  "placesMax" INTEGER,
  "creeParId" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invitations_cours_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_cours_token_key" ON "invitations_cours"("token");
CREATE INDEX IF NOT EXISTS "invitations_cours_coursId_idx" ON "invitations_cours"("coursId");
DO $$ BEGIN
  ALTER TABLE "invitations_cours" ADD CONSTRAINT "invitations_cours_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invitations_cours" ADD CONSTRAINT "invitations_cours_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
