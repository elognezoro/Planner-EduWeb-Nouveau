-- Cahier de texte (séances) et registre d'appel (présences) des CAFOP.
CREATE TABLE "seances_cafop" (
    "id" TEXT NOT NULL,
    "cafopId" TEXT NOT NULL,
    "moduleId" TEXT,
    "groupe" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seances_cafop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seances_cafop_cafopId_idx" ON "seances_cafop"("cafopId");

ALTER TABLE "seances_cafop" ADD CONSTRAINT "seances_cafop_cafopId_fkey" FOREIGN KEY ("cafopId") REFERENCES "cafops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seances_cafop" ADD CONSTRAINT "seances_cafop_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules_cafop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "presences_cafop" (
    "id" TEXT NOT NULL,
    "apprenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'present',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presences_cafop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "presences_cafop_apprenantId_date_key" ON "presences_cafop"("apprenantId", "date");
CREATE INDEX "presences_cafop_apprenantId_idx" ON "presences_cafop"("apprenantId");

ALTER TABLE "presences_cafop" ADD CONSTRAINT "presences_cafop_apprenantId_fkey" FOREIGN KEY ("apprenantId") REFERENCES "apprenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
