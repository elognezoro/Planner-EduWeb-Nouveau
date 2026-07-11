-- CreateTable
CREATE TABLE "quiz" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "consigne" TEXT,
    "seuilReussite" INTEGER NOT NULL DEFAULT 70,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions_quiz" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "enonce" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'choix_unique',
    "points" INTEGER NOT NULL DEFAULT 1,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choix_question" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "choix_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentatives_quiz" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "scoreMax" INTEGER NOT NULL,
    "pourcentage" INTEGER NOT NULL,
    "reussi" BOOLEAN NOT NULL,
    "reponses" JSONB,
    "dateTentative" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentatives_quiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quiz_moduleId_key" ON "quiz"("moduleId");

-- CreateIndex
CREATE INDEX "questions_quiz_quizId_idx" ON "questions_quiz"("quizId");

-- CreateIndex
CREATE INDEX "choix_question_questionId_idx" ON "choix_question"("questionId");

-- CreateIndex
CREATE INDEX "tentatives_quiz_quizId_idx" ON "tentatives_quiz"("quizId");

-- CreateIndex
CREATE INDEX "tentatives_quiz_utilisateurId_idx" ON "tentatives_quiz"("utilisateurId");

-- AddForeignKey
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules_cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_quiz" ADD CONSTRAINT "questions_quiz_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_question" ADD CONSTRAINT "choix_question_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions_quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_quiz" ADD CONSTRAINT "tentatives_quiz_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_quiz" ADD CONSTRAINT "tentatives_quiz_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

