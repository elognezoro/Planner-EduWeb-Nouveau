-- AlterTable
ALTER TABLE "quiz" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'formatif',
ADD COLUMN     "revelationSolutions" TEXT NOT NULL DEFAULT 'apres_tentative';

-- AlterTable
ALTER TABLE "questions_quiz" ADD COLUMN     "explication" TEXT;

