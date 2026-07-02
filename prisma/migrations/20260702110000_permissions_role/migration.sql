-- Matrice des droits éditable : surcharges de permission par item de navigation et par rôle
CREATE TABLE "permissions_role" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "accorde" BOOLEAN NOT NULL,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_role_itemId_role_key" ON "permissions_role"("itemId", "role");
