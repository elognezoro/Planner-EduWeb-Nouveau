-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "icone" TEXT,
    "couleur" TEXT NOT NULL DEFAULT 'gold',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcours" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "niveau" TEXT,
    "publicCible" TEXT[],
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "badgeId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapes_parcours" (
    "id" TEXT NOT NULL,
    "parcoursId" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "etapes_parcours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions_parcours" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "parcoursId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "progressionPct" INTEGER NOT NULL DEFAULT 0,
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "derniereActivite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscriptions_parcours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges_obtenus" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "dateObtention" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_obtenus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parcours_slug_key" ON "parcours"("slug");

-- CreateIndex
CREATE INDEX "parcours_statut_idx" ON "parcours"("statut");

-- CreateIndex
CREATE INDEX "etapes_parcours_parcoursId_idx" ON "etapes_parcours"("parcoursId");

-- CreateIndex
CREATE INDEX "etapes_parcours_coursId_idx" ON "etapes_parcours"("coursId");

-- CreateIndex
CREATE UNIQUE INDEX "etapes_parcours_parcoursId_coursId_key" ON "etapes_parcours"("parcoursId", "coursId");

-- CreateIndex
CREATE INDEX "inscriptions_parcours_parcoursId_idx" ON "inscriptions_parcours"("parcoursId");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_parcours_utilisateurId_parcoursId_key" ON "inscriptions_parcours"("utilisateurId", "parcoursId");

-- CreateIndex
CREATE INDEX "badges_obtenus_badgeId_idx" ON "badges_obtenus"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "badges_obtenus_utilisateurId_badgeId_key" ON "badges_obtenus"("utilisateurId", "badgeId");

-- AddForeignKey
ALTER TABLE "parcours" ADD CONSTRAINT "parcours_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapes_parcours" ADD CONSTRAINT "etapes_parcours_parcoursId_fkey" FOREIGN KEY ("parcoursId") REFERENCES "parcours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapes_parcours" ADD CONSTRAINT "etapes_parcours_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions_parcours" ADD CONSTRAINT "inscriptions_parcours_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions_parcours" ADD CONSTRAINT "inscriptions_parcours_parcoursId_fkey" FOREIGN KEY ("parcoursId") REFERENCES "parcours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges_obtenus" ADD CONSTRAINT "badges_obtenus_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badges_obtenus" ADD CONSTRAINT "badges_obtenus_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

