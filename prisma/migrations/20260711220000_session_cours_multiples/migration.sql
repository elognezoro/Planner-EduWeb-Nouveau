-- Cours associés (pluriel) : remplace la relation simple coursId par un tableau d'identifiants.
ALTER TABLE "sessions_formation" ADD COLUMN "coursIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Préserve l'association simple existante.
UPDATE "sessions_formation" SET "coursIds" = ARRAY["coursId"] WHERE "coursId" IS NOT NULL;

-- Retire l'ancienne association simple (contrainte, index, colonne).
ALTER TABLE "sessions_formation" DROP CONSTRAINT IF EXISTS "sessions_formation_coursId_fkey";
DROP INDEX IF EXISTS "sessions_formation_coursId_idx";
ALTER TABLE "sessions_formation" DROP COLUMN "coursId";
