-- CreateTable
CREATE TABLE "pages_wiki" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL DEFAULT '',
    "creeParId" TEXT,
    "misAJourParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_wiki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisions_wiki" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "auteurId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisions_wiki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations_wiki" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "evaluateurId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" INTEGER,
    "commentaire" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_wiki_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pages_wiki_coursId_idx" ON "pages_wiki"("coursId");

-- CreateIndex
CREATE INDEX "revisions_wiki_pageId_idx" ON "revisions_wiki"("pageId");

-- CreateIndex
CREATE INDEX "evaluations_wiki_pageId_idx" ON "evaluations_wiki"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_wiki_pageId_evaluateurId_key" ON "evaluations_wiki"("pageId", "evaluateurId");

-- AddForeignKey
ALTER TABLE "pages_wiki" ADD CONSTRAINT "pages_wiki_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages_wiki" ADD CONSTRAINT "pages_wiki_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages_wiki" ADD CONSTRAINT "pages_wiki_misAJourParId_fkey" FOREIGN KEY ("misAJourParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions_wiki" ADD CONSTRAINT "revisions_wiki_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages_wiki"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions_wiki" ADD CONSTRAINT "revisions_wiki_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_wiki" ADD CONSTRAINT "evaluations_wiki_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages_wiki"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_wiki" ADD CONSTRAINT "evaluations_wiki_evaluateurId_fkey" FOREIGN KEY ("evaluateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

