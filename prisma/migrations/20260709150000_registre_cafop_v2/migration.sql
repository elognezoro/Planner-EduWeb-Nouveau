-- Registre d'appel CAFOP enrichi : profil élève-maître (sexe, naissance, téléphone),
-- présence détaillée (motif, justification, heure de séance, module) et événements de conduite
-- (encouragement / observation / infirmerie) — mêmes fonctions que le registre établissement.

ALTER TABLE "apprenants"
  ADD COLUMN "sexe" TEXT,
  ADD COLUMN "dateNaissance" TIMESTAMP(3),
  ADD COLUMN "telephone" TEXT;

ALTER TABLE "presences_cafop"
  ADD COLUMN "motif" TEXT,
  ADD COLUMN "justifie" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "heureSeance" TEXT,
  ADD COLUMN "moduleId" TEXT;

CREATE INDEX "presences_cafop_moduleId_idx" ON "presences_cafop"("moduleId");

ALTER TABLE "presences_cafop"
  ADD CONSTRAINT "presences_cafop_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules_cafop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unicité par SÉANCE (jour + créneau), et non plus seulement par jour :
-- plusieurs séances (créneaux) peuvent être appelées le même jour sans s'écraser.
DROP INDEX "presences_cafop_apprenantId_date_key";
CREATE UNIQUE INDEX "presences_cafop_apprenantId_date_heureSeance_key" ON "presences_cafop"("apprenantId", "date", "heureSeance");

CREATE TABLE "evenements_presence_cafop" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "apprenantId" TEXT NOT NULL,
  "groupe" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "heureSeance" TEXT,
  "description" TEXT NOT NULL,
  "accompagnateur" TEXT,
  "saisiParId" TEXT,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evenements_presence_cafop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evenements_presence_cafop_apprenantId_idx" ON "evenements_presence_cafop"("apprenantId");

ALTER TABLE "evenements_presence_cafop"
  ADD CONSTRAINT "evenements_presence_cafop_apprenantId_fkey" FOREIGN KEY ("apprenantId") REFERENCES "apprenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
