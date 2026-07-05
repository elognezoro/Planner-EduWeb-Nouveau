-- Paramètres d'emploi du temps de l'établissement :
-- 1) plages sans cours dans tout l'établissement (jour ou demi-journée) ;
-- 2) parité des indices de classes ayant cours le matin en double vacation.
ALTER TABLE "etablissements"
  ADD COLUMN "plagesSansCours" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "doubleVacationMatin" TEXT NOT NULL DEFAULT 'impairs';
