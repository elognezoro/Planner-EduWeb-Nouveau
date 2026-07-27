-- Anti-force-brute du login : compteur d'échecs par e-mail (fenêtre glissante + blocage temporisé).
-- Écrite à la main (base = PROD), appliquée par vercel-build. Additive, non destructive.

CREATE TABLE IF NOT EXISTS "tentatives_connexion" (
  "email" TEXT NOT NULL,
  "echecs" INTEGER NOT NULL DEFAULT 0,
  "fenetreDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bloqueJusqua" TIMESTAMP(3),
  "majLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tentatives_connexion_pkey" PRIMARY KEY ("email")
);
