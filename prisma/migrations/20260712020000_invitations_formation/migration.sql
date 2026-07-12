-- CreateTable
CREATE TABLE "invitations_formation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "code" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "expiration" TIMESTAMP(3),
    "placesMax" INTEGER,
    "creeParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_formation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_formation_token_key" ON "invitations_formation"("token");

-- CreateIndex
CREATE INDEX "invitations_formation_sessionId_idx" ON "invitations_formation"("sessionId");

-- AddForeignKey
ALTER TABLE "invitations_formation" ADD CONSTRAINT "invitations_formation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions_formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations_formation" ADD CONSTRAINT "invitations_formation_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
