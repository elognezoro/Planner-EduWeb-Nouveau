-- Rang de la classe dans sa salle partagee (double vacation) : 0 = 1re/matin, 1 = 2e/apres-midi.
-- Fixe explicitement le creneau choisi par le chef, independamment du numero pedagogique
-- (2e classe = apres-midi meme si les deux numeros sont impairs).
-- Additive et idempotente (base = PRODUCTION). Null = donnees anterieures (repli tri numerique code).
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "rangSalle" INTEGER;
