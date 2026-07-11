-- AlterTable : progression séquentielle (module verrouillé tant que le précédent n'est pas validé)
ALTER TABLE "cours" ADD COLUMN "progressionSequentielle" BOOLEAN NOT NULL DEFAULT false;
