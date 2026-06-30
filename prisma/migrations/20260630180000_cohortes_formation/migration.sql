-- CreateEnum
CREATE TYPE "TypeCohorte" AS ENUM ('cafop_promotion', 'apfc_session');

-- CreateEnum
CREATE TYPE "StatutCohorte" AS ENUM ('active', 'cloturee');

-- CreateTable
CREATE TABLE "cohortes" (
    "id" TEXT NOT NULL,
    "type" "TypeCohorte" NOT NULL,
    "cafopId" TEXT,
    "apfcId" TEXT,
    "libelle" TEXT NOT NULL,
    "anneeDebut" INTEGER,
    "anneeFin" INTEGER,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "lieu" TEXT,
    "statut" "StatutCohorte" NOT NULL DEFAULT 'active',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohortes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apprenants" (
    "id" TEXT NOT NULL,
    "cohorteId" TEXT NOT NULL,
    "matricule" TEXT,
    "nom" TEXT NOT NULL,
    "prenoms" TEXT,
    "email" TEXT,
    "etablissementOrigine" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apprenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cohortes_cafopId_idx" ON "cohortes"("cafopId");

-- CreateIndex
CREATE INDEX "cohortes_apfcId_idx" ON "cohortes"("apfcId");

-- CreateIndex
CREATE INDEX "apprenants_cohorteId_idx" ON "apprenants"("cohorteId");

-- AddForeignKey
ALTER TABLE "cohortes" ADD CONSTRAINT "cohortes_cafopId_fkey" FOREIGN KEY ("cafopId") REFERENCES "cafops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohortes" ADD CONSTRAINT "cohortes_apfcId_fkey" FOREIGN KEY ("apfcId") REFERENCES "apfc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apprenants" ADD CONSTRAINT "apprenants_cohorteId_fkey" FOREIGN KEY ("cohorteId") REFERENCES "cohortes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
