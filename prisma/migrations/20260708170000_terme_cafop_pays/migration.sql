-- Terme local désignant les CAFOP, réglable par pays (ex. « CAFOP », « IFM », « CRFPE »).
CREATE TABLE "parametres_cafop_pays" (
    "pays" TEXT NOT NULL,
    "terme" TEXT NOT NULL DEFAULT 'CAFOP',
    "majLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametres_cafop_pays_pkey" PRIMARY KEY ("pays")
);
