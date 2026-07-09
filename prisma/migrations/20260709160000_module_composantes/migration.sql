-- Structure pédagogique des modules CAFOP : composantes → thèmes (cascade Module → Composante → Thème),
-- définie dans « Gestion des modules » et utilisée par la « Nouvelle séance » du cahier de texte.
ALTER TABLE "modules_cafop" ADD COLUMN "composantes" JSONB;
ALTER TABLE "seances_cafop" ADD COLUMN "composante" TEXT;
