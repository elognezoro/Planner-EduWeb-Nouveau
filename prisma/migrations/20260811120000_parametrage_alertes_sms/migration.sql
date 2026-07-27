-- Alertes & SMS enrichi : paramétrage par établissement (seuils, canaux, modèles de message).
-- Écrite à la main (base = PROD), appliquée par vercel-build. Additive, non destructive.

CREATE TABLE IF NOT EXISTS "parametrages_alertes_sms" (
  "etablissementId" TEXT NOT NULL,
  "seuilAbsences" INTEGER NOT NULL DEFAULT 3,
  "seuilRetards" INTEGER NOT NULL DEFAULT 5,
  "seuilNote" INTEGER NOT NULL DEFAULT 0,
  "canalSms" BOOLEAN NOT NULL DEFAULT true,
  "canalEmail" BOOLEAN NOT NULL DEFAULT false,
  "canalInApp" BOOLEAN NOT NULL DEFAULT false,
  "canalWhatsApp" BOOLEAN NOT NULL DEFAULT false,
  "modeleAbsence" TEXT NOT NULL DEFAULT 'EduWeb Planner — {CLASSE} : votre enfant {PRENOM} totalise {NB} absence(s) non justifiée(s). Merci de régulariser auprès de l''établissement.',
  "modeleRetard" TEXT NOT NULL DEFAULT 'EduWeb Planner — {CLASSE} : {PRENOM} cumule {NB} retard(s) non justifié(s). Merci d''y veiller.',
  "modeleNotes" TEXT NOT NULL DEFAULT 'EduWeb Planner — {CLASSE} : la moyenne de {PRENOM} est de {NB}/20. Un accompagnement est conseillé.',
  "telEtablissement" TEXT,
  "majLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "parametrages_alertes_sms_pkey" PRIMARY KEY ("etablissementId")
);
