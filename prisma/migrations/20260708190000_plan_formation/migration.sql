-- Plan de formation (Formation Initiale des Maîtres) : document national par pays et année scolaire.
CREATE TABLE "plans_formation" (
    "id" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "titre" TEXT NOT NULL DEFAULT 'Plan de formation — Formation Initiale des Maîtres',
    "intro" TEXT,
    "signataire" TEXT,
    "signataireFonction" TEXT,
    "publie" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_formation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_formation_pays_anneeScolaire_key" ON "plans_formation"("pays", "anneeScolaire");

CREATE TABLE "sections_plan_formation" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "niveau" INTEGER,
    "titre" TEXT NOT NULL,
    "intro" TEXT,
    "note" TEXT,
    "colonnes" JSONB NOT NULL,

    CONSTRAINT "sections_plan_formation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sections_plan_formation_planId_idx" ON "sections_plan_formation"("planId");

CREATE TABLE "lignes_plan_formation" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'donnee',
    "cellules" JSONB NOT NULL,
    "texte" TEXT,
    "ton" TEXT,

    CONSTRAINT "lignes_plan_formation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lignes_plan_formation_sectionId_idx" ON "lignes_plan_formation"("sectionId");

ALTER TABLE "sections_plan_formation" ADD CONSTRAINT "sections_plan_formation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans_formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lignes_plan_formation" ADD CONSTRAINT "lignes_plan_formation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections_plan_formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
