-- Stages pratiques CAFOP : rôle « Maître d'application », attribution des stagiaires,
-- suivi (dialogues, visites, grilles d'évaluation) et gouvernance des modifications de
-- notes (motif + autorisation du Directeur de CAFOP ou de l'ADC, avec traçabilité).

-- Rôle « Maître d'application » (attribué par le Directeur de CAFOP / l'ADC).
INSERT INTO "roles" ("id", "nomTechnique", "libelle", "description", "rang") VALUES
  ('role_maitre_application', 'maitre_application', 'Maître d''application',
   'Encadre les élèves-maîtres en stage pratique : fiche de présence et régularité, dialogue avec l''administration du CAFOP et grille d''évaluation — uniquement pour les stagiaires qui lui sont attribués.', 45)
ON CONFLICT ("nomTechnique") DO NOTHING;

-- Un module peut désormais être un STAGE PRATIQUE (plusieurs stages possibles par année).
ALTER TABLE "modules_cafop" ADD COLUMN "estStage" BOOLEAN NOT NULL DEFAULT false;

-- Cahier de texte et registre d'appel CAFOP : sélection MULTIPLE de composantes/thèmes (habiletés).
ALTER TABLE "seances_cafop" ADD COLUMN "composantes" JSONB;
ALTER TABLE "seances_cafop" ADD COLUMN "themes" JSONB;
ALTER TABLE "presences_cafop" ADD COLUMN "composantes" JSONB;
ALTER TABLE "presences_cafop" ADD COLUMN "themes" JSONB;

-- Traçabilité de la saisie des notes CAFOP.
ALTER TABLE "notes_cafop" ADD COLUMN "saisiParId" TEXT;

-- Attribution d'un stagiaire à un maître d'application (registre par année de formation).
CREATE TABLE "attributions_stagiaire" (
    "id" TEXT NOT NULL,
    "cafopId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL DEFAULT 1,
    "maitreId" TEXT NOT NULL,
    "apprenantId" TEXT NOT NULL,
    "moduleId" TEXT,
    "attribueParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attributions_stagiaire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attributions_stagiaire_maitreId_apprenantId_key" ON "attributions_stagiaire"("maitreId", "apprenantId");
CREATE INDEX "attributions_stagiaire_cafopId_annee_idx" ON "attributions_stagiaire"("cafopId", "annee");
CREATE INDEX "attributions_stagiaire_maitreId_idx" ON "attributions_stagiaire"("maitreId");
CREATE INDEX "attributions_stagiaire_apprenantId_idx" ON "attributions_stagiaire"("apprenantId");
ALTER TABLE "attributions_stagiaire" ADD CONSTRAINT "attributions_stagiaire_apprenantId_fkey" FOREIGN KEY ("apprenantId") REFERENCES "apprenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attributions_stagiaire" ADD CONSTRAINT "attributions_stagiaire_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules_cafop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Boîte de dialogues administration du CAFOP ↔ maître d'application (fil par stagiaire).
CREATE TABLE "dialogues_stage" (
    "id" TEXT NOT NULL,
    "cafopId" TEXT NOT NULL,
    "apprenantId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "auteurNom" TEXT,
    "duMaitre" BOOLEAN NOT NULL DEFAULT false,
    "contenu" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dialogues_stage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "dialogues_stage_apprenantId_idx" ON "dialogues_stage"("apprenantId");
CREATE INDEX "dialogues_stage_cafopId_idx" ON "dialogues_stage"("cafopId");
ALTER TABLE "dialogues_stage" ADD CONSTRAINT "dialogues_stage_apprenantId_fkey" FOREIGN KEY ("apprenantId") REFERENCES "apprenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Visites de classe des professeurs de CAFOP aux stagiaires.
CREATE TABLE "visites_stagiaire" (
    "id" TEXT NOT NULL,
    "cafopId" TEXT NOT NULL,
    "apprenantId" TEXT NOT NULL,
    "professeur" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ecole" TEXT,
    "objet" TEXT,
    "observations" TEXT,
    "recommandations" TEXT,
    "noteGlobale" DOUBLE PRECISION,
    "saisiParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visites_stagiaire_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "visites_stagiaire_apprenantId_idx" ON "visites_stagiaire"("apprenantId");
CREATE INDEX "visites_stagiaire_cafopId_date_idx" ON "visites_stagiaire"("cafopId", "date");
ALTER TABLE "visites_stagiaire" ADD CONSTRAINT "visites_stagiaire_apprenantId_fkey" FOREIGN KEY ("apprenantId") REFERENCES "apprenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grille d'évaluation du stagiaire : une par évaluateur (prof de CAFOP / maître d'application).
CREATE TABLE "evaluations_stage" (
    "id" TEXT NOT NULL,
    "cafopId" TEXT NOT NULL,
    "apprenantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "evaluateurType" TEXT NOT NULL,
    "evaluateurNom" TEXT,
    "criteres" JSONB NOT NULL,
    "noteGlobale" DOUBLE PRECISION NOT NULL,
    "sur" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "appreciation" TEXT,
    "saisiParId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_stage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evaluations_stage_apprenantId_moduleId_evaluateurType_key" ON "evaluations_stage"("apprenantId", "moduleId", "evaluateurType");
CREATE INDEX "evaluations_stage_cafopId_idx" ON "evaluations_stage"("cafopId");
CREATE INDEX "evaluations_stage_apprenantId_idx" ON "evaluations_stage"("apprenantId");
ALTER TABLE "evaluations_stage" ADD CONSTRAINT "evaluations_stage_apprenantId_fkey" FOREIGN KEY ("apprenantId") REFERENCES "apprenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluations_stage" ADD CONSTRAINT "evaluations_stage_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules_cafop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Demandes de modification de note (stage comme formation théorique) : motif obligatoire,
-- décision du Directeur/ADC, valeurs avant/proposée conservées (traçabilité).
CREATE TABLE "demandes_modification_cafop" (
    "id" TEXT NOT NULL,
    "cafopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cibleId" TEXT NOT NULL,
    "cibleLibelle" TEXT,
    "demandeurId" TEXT NOT NULL,
    "demandeurNom" TEXT,
    "motif" TEXT NOT NULL,
    "valeurAvant" JSONB,
    "valeurProposee" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "decideParId" TEXT,
    "decideParNom" TEXT,
    "decideLe" TIMESTAMP(3),
    "motifDecision" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demandes_modification_cafop_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "demandes_modification_cafop_cafopId_statut_idx" ON "demandes_modification_cafop"("cafopId", "statut");
CREATE INDEX "demandes_modification_cafop_cibleId_idx" ON "demandes_modification_cafop"("cibleId");
