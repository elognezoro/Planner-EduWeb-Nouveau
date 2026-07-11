-- CreateTable
CREATE TABLE "categories_formation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "icone" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cours" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categorieId" TEXT,
    "imageUrl" TEXT,
    "niveau" TEXT,
    "publicCible" TEXT[],
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "dureeMinutes" INTEGER,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules_cours" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'texte',
    "contenu" TEXT,
    "fichierUrl" TEXT,
    "fichierNom" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "dureeMinutes" INTEGER,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions_cours" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "progressionPct" INTEGER NOT NULL DEFAULT 0,
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "derniereActivite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscriptions_cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progressions_module" (
    "id" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "termine" BOOLEAN NOT NULL DEFAULT false,
    "dateCompletion" TIMESTAMP(3),

    CONSTRAINT "progressions_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions_formation" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "coursId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'webinaire',
    "animateur" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER,
    "lienVisio" TEXT,
    "lieu" TEXT,
    "placesMax" INTEGER,
    "publicCible" TEXT[],
    "pays" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'planifiee',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions_session" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'inscrit',
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscriptions_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cours_slug_key" ON "cours"("slug");

-- CreateIndex
CREATE INDEX "cours_categorieId_idx" ON "cours"("categorieId");

-- CreateIndex
CREATE INDEX "cours_statut_idx" ON "cours"("statut");

-- CreateIndex
CREATE INDEX "modules_cours_coursId_idx" ON "modules_cours"("coursId");

-- CreateIndex
CREATE INDEX "inscriptions_cours_coursId_idx" ON "inscriptions_cours"("coursId");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_cours_utilisateurId_coursId_key" ON "inscriptions_cours"("utilisateurId", "coursId");

-- CreateIndex
CREATE INDEX "progressions_module_moduleId_idx" ON "progressions_module"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "progressions_module_inscriptionId_moduleId_key" ON "progressions_module"("inscriptionId", "moduleId");

-- CreateIndex
CREATE INDEX "sessions_formation_coursId_idx" ON "sessions_formation"("coursId");

-- CreateIndex
CREATE INDEX "sessions_formation_dateDebut_idx" ON "sessions_formation"("dateDebut");

-- CreateIndex
CREATE INDEX "inscriptions_session_sessionId_idx" ON "inscriptions_session"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_session_utilisateurId_sessionId_key" ON "inscriptions_session"("utilisateurId", "sessionId");

-- AddForeignKey
ALTER TABLE "cours" ADD CONSTRAINT "cours_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories_formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules_cours" ADD CONSTRAINT "modules_cours_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions_cours" ADD CONSTRAINT "inscriptions_cours_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions_cours" ADD CONSTRAINT "inscriptions_cours_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progressions_module" ADD CONSTRAINT "progressions_module_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "inscriptions_cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progressions_module" ADD CONSTRAINT "progressions_module_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules_cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_formation" ADD CONSTRAINT "sessions_formation_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "cours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions_session" ADD CONSTRAINT "inscriptions_session_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions_session" ADD CONSTRAINT "inscriptions_session_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions_formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
