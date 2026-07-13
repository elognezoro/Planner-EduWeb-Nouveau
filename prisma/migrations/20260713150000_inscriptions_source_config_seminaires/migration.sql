-- AlterTable : source d'inscription à un cours (auto / nominative / session)
ALTER TABLE "inscriptions_cours" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'auto';

-- CreateTable : paramétrage administrateur d'un séminaire (couverture + certificat)
CREATE TABLE "config_seminaires" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "couvertureUrl" TEXT,
    "organisation" TEXT,
    "logoUrl" TEXT,
    "formateur" TEXT,
    "directeur" TEXT,
    "directeurFonction" TEXT,
    "signatureUrl" TEXT,
    "cachetUrl" TEXT,
    "qrImageUrl" TEXT,
    "dateSignature" TEXT,
    "certificatModele" TEXT,
    "lieu" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_seminaires_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_seminaires_slug_key" ON "config_seminaires"("slug");
