-- Salle attitrée par classe pédagogique (désignation personnalisée + affectation manuelle).
-- En double vacation, deux classes (matin + après-midi) peuvent partager la même salle.
-- Additive et idempotente (base = production).
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "salleAttribueeId" TEXT;
CREATE INDEX IF NOT EXISTS "classes_salleAttribueeId_idx" ON "classes"("salleAttribueeId");
DO $$ BEGIN
  ALTER TABLE "classes" ADD CONSTRAINT "classes_salleAttribueeId_fkey"
    FOREIGN KEY ("salleAttribueeId") REFERENCES "salles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
