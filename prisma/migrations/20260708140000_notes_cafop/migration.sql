-- Groupe-classe des élèves-maîtres + coefficient des modules + notes des bulletins CAFOP.
ALTER TABLE "apprenants" ADD COLUMN "groupe" TEXT;
ALTER TABLE "modules_cafop" ADD COLUMN "coefficient" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "notes_cafop" (
    "id" TEXT NOT NULL,
    "apprenantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valeur" DOUBLE PRECISION NOT NULL,
    "bareme" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "semestre" INTEGER NOT NULL DEFAULT 1,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_cafop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notes_cafop_apprenantId_idx" ON "notes_cafop"("apprenantId");
CREATE INDEX "notes_cafop_moduleId_idx" ON "notes_cafop"("moduleId");

ALTER TABLE "notes_cafop" ADD CONSTRAINT "notes_cafop_apprenantId_fkey" FOREIGN KEY ("apprenantId") REFERENCES "apprenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notes_cafop" ADD CONSTRAINT "notes_cafop_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules_cafop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
