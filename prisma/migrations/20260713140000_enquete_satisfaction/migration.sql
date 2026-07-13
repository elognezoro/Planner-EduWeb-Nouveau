-- CreateTable
CREATE TABLE "enquetes_satisfaction" (
    "id" TEXT NOT NULL,
    "seminaire" TEXT NOT NULL DEFAULT 'magnifica-humanitas',
    "appreciationGlobale" INTEGER,
    "contenuClair" INTEGER,
    "contenuPertinent" INTEGER,
    "activitesUtiles" INTEGER,
    "rythmeAdapte" INTEGER,
    "navigationAisee" INTEGER,
    "applicationConcrete" INTEGER,
    "usageResponsable" INTEGER,
    "recommandation" INTEGER,
    "pointsForts" TEXT,
    "pointsAmeliorer" TEXT,
    "suggestions" TEXT,
    "role" TEXT,
    "pays" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquetes_satisfaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquetes_satisfaction_seminaire_creeLe_idx" ON "enquetes_satisfaction"("seminaire", "creeLe");
