-- Modules de formation des élèves-maîtres (CAFOP), évalués dans les bulletins.
CREATE TABLE "modules_cafop" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_cafop_pkey" PRIMARY KEY ("id")
);
