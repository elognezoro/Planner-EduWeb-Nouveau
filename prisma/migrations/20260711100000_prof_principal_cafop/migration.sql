-- Professeur principal par groupe-classe d'un CAFOP (renseigne le bulletin de notes).
CREATE TABLE "prof_principaux_cafop" (
    "id" TEXT NOT NULL,
    "cafopId" TEXT NOT NULL,
    "groupe" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prof_principaux_cafop_pkey" PRIMARY KEY ("id")
);

-- Un seul professeur principal par groupe-classe au sein d'un centre.
CREATE UNIQUE INDEX "prof_principaux_cafop_cafopId_groupe_key" ON "prof_principaux_cafop"("cafopId", "groupe");
CREATE INDEX "prof_principaux_cafop_cafopId_idx" ON "prof_principaux_cafop"("cafopId");
CREATE INDEX "prof_principaux_cafop_enseignantId_idx" ON "prof_principaux_cafop"("enseignantId");

ALTER TABLE "prof_principaux_cafop" ADD CONSTRAINT "prof_principaux_cafop_cafopId_fkey" FOREIGN KEY ("cafopId") REFERENCES "cafops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prof_principaux_cafop" ADD CONSTRAINT "prof_principaux_cafop_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "enseignants_cafop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
