-- Forum de discussion par cours (fils + messages + synthèses IA). Additif et idempotent.
CREATE TABLE IF NOT EXISTS "sujets_forum" (
  "id" TEXT NOT NULL,
  "coursId" TEXT NOT NULL,
  "titre" TEXT NOT NULL,
  "description" TEXT,
  "creeParId" TEXT,
  "epingle" BOOLEAN NOT NULL DEFAULT false,
  "ferme" BOOLEAN NOT NULL DEFAULT false,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "misAJourLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sujets_forum_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sujets_forum_coursId_idx" ON "sujets_forum"("coursId");

CREATE TABLE IF NOT EXISTS "messages_forum" (
  "id" TEXT NOT NULL,
  "sujetId" TEXT NOT NULL,
  "auteurId" TEXT,
  "contenu" TEXT NOT NULL,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "misAJourLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_forum_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "messages_forum_sujetId_idx" ON "messages_forum"("sujetId");

CREATE TABLE IF NOT EXISTS "syntheses_forum" (
  "id" TEXT NOT NULL,
  "sujetId" TEXT NOT NULL,
  "contenu" TEXT NOT NULL,
  "nbMessages" INTEGER NOT NULL DEFAULT 0,
  "genereeParId" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "syntheses_forum_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "syntheses_forum_sujetId_idx" ON "syntheses_forum"("sujetId");

DO $$ BEGIN
  ALTER TABLE "sujets_forum" ADD CONSTRAINT "sujets_forum_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sujets_forum" ADD CONSTRAINT "sujets_forum_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "messages_forum" ADD CONSTRAINT "messages_forum_sujetId_fkey" FOREIGN KEY ("sujetId") REFERENCES "sujets_forum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "messages_forum" ADD CONSTRAINT "messages_forum_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "syntheses_forum" ADD CONSTRAINT "syntheses_forum_sujetId_fkey" FOREIGN KEY ("sujetId") REFERENCES "sujets_forum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
