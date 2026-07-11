-- CreateTable
CREATE TABLE "devoirs" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "consigne" TEXT,
    "accepteTexte" BOOLEAN NOT NULL DEFAULT true,
    "accepteFichier" BOOLEAN NOT NULL DEFAULT true,
    "noteSur" INTEGER NOT NULL DEFAULT 20,
    "dateLimite" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoirs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soumissions_devoir" (
    "id" TEXT NOT NULL,
    "devoirId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "texte" TEXT,
    "fichierUrl" TEXT,
    "fichierNom" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'soumis',
    "note" INTEGER,
    "appreciation" TEXT,
    "correcteurId" TEXT,
    "dateSoumission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCorrection" TIMESTAMP(3),

    CONSTRAINT "soumissions_devoir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuteurs_cours" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuteurs_cours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devoirs_moduleId_key" ON "devoirs"("moduleId");

-- CreateIndex
CREATE INDEX "soumissions_devoir_devoirId_idx" ON "soumissions_devoir"("devoirId");

-- CreateIndex
CREATE INDEX "soumissions_devoir_utilisateurId_idx" ON "soumissions_devoir"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "soumissions_devoir_devoirId_utilisateurId_key" ON "soumissions_devoir"("devoirId", "utilisateurId");

-- CreateIndex
CREATE INDEX "tuteurs_cours_utilisateurId_idx" ON "tuteurs_cours"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "tuteurs_cours_coursId_utilisateurId_key" ON "tuteurs_cours"("coursId", "utilisateurId");

-- AddForeignKey
ALTER TABLE "devoirs" ADD CONSTRAINT "devoirs_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules_cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soumissions_devoir" ADD CONSTRAINT "soumissions_devoir_devoirId_fkey" FOREIGN KEY ("devoirId") REFERENCES "devoirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soumissions_devoir" ADD CONSTRAINT "soumissions_devoir_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soumissions_devoir" ADD CONSTRAINT "soumissions_devoir_correcteurId_fkey" FOREIGN KEY ("correcteurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuteurs_cours" ADD CONSTRAINT "tuteurs_cours_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuteurs_cours" ADD CONSTRAINT "tuteurs_cours_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

