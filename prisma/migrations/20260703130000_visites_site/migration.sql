-- Trafic du site : compteur de visites et journal des connexions,
-- alimente le widget « temps réel » de la page d'accueil.
CREATE TYPE "TypeTraficSite" AS ENUM ('visite', 'connexion');

CREATE TABLE "visites_site" (
    "id" TEXT NOT NULL,
    "type" "TypeTraficSite" NOT NULL,
    "chemin" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visites_site_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visites_site_creeLe_idx" ON "visites_site"("creeLe");
CREATE INDEX "visites_site_type_idx" ON "visites_site"("type");
