-- Départements de l'organisation (page d'accueil « Nos départements » + gestion admin).
CREATE TABLE "departements" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT NOT NULL DEFAULT 'general',
    "icone" TEXT,
    "couleur" TEXT NOT NULL DEFAULT 'forest',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "departements_actif_ordre_idx" ON "departements"("actif", "ordre");

-- Départements par défaut (modifiables/supprimables depuis Système › Départements).
INSERT INTO "departements" ("id", "nom", "description", "categorie", "icone", "couleur", "ordre", "actif", "creeLe", "majLe") VALUES
  (gen_random_uuid()::text, 'Direction Produit', 'Vision, feuille de route et cohérence de la plateforme au service des établissements.', 'produit', 'Compass', 'gold', 10, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Ingénierie Plateforme', 'Architecture, performance et sécurité de l''application (Next.js, Prisma, RBAC).', 'produit', 'Cpu', 'forest', 20, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Solveur & Optimisation', 'Génération automatique des emplois du temps par solveur de contraintes.', 'produit', 'CalendarClock', 'forest', 30, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Sécurité & Données', 'Cloisonnement par périmètre, confidentialité et protection des données scolaires.', 'produit', 'ShieldCheck', 'gold', 40, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Ingénierie Pédagogique', 'Conception des parcours de formation (CAFOP, APFC) et du centre de formation en ligne.', 'pedagogie', 'GraduationCap', 'forest', 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Conformité & Programmes', 'Alignement sur les programmes officiels et les référentiels du système éducatif.', 'pedagogie', 'BookMarked', 'gold', 60, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Support & Déploiement', 'Accompagnement des établissements dans la mise en route et l''usage quotidien.', 'support', 'LifeBuoy', 'forest', 70, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'Formation des utilisateurs', 'Guides, sessions et assistance pour la prise en main par chaque rôle.', 'support', 'Presentation', 'gold', 80, true, NOW(), NOW());
