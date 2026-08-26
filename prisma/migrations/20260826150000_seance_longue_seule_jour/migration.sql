-- Une seance LONGUE (>=2h) d'une discipline est SEULE dans sa journee pour une classe :
-- ce jour-la, aucune autre seance de la meme discipline (ex. Francais : bloc de 2h seul,
-- deux seances d'1h peuvent partager un jour si non consecutives). Reglage opt-in, defaut false.
-- Additive et idempotente (base = PRODUCTION).
ALTER TABLE "etablissements" ADD COLUMN IF NOT EXISTS "seanceLongueSeuleParJour" BOOLEAN NOT NULL DEFAULT false;
