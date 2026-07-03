-- Registre d'appel v3 — actions par élève :
--  - événements de vie scolaire liés à l'appel (encouragement / observation / infirmerie),
--    qui impactent la note de conduite ;
--  - date de naissance de l'élève (fiche des modales d'action).
CREATE TYPE "TypeEvenementAppel" AS ENUM ('encouragement', 'observation', 'infirmerie');

CREATE TABLE "evenements_appel" (
    "id" TEXT NOT NULL,
    "type" "TypeEvenementAppel" NOT NULL,
    "eleveId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heureSeance" TEXT,
    "description" TEXT NOT NULL,
    "accompagnateur" TEXT,
    "saisiParId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evenements_appel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evenements_appel_eleveId_idx" ON "evenements_appel"("eleveId");
CREATE INDEX "evenements_appel_classeId_idx" ON "evenements_appel"("classeId");

ALTER TABLE "evenements_appel" ADD CONSTRAINT "evenements_appel_eleveId_fkey"
    FOREIGN KEY ("eleveId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evenements_appel" ADD CONSTRAINT "evenements_appel_classeId_fkey"
    FOREIGN KEY ("classeId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evenements_appel" ADD CONSTRAINT "evenements_appel_saisiParId_fkey"
    FOREIGN KEY ("saisiParId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "utilisateurs" ADD COLUMN "dateNaissance" TIMESTAMP(3);
