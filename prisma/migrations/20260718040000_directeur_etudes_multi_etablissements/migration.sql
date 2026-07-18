-- Rôle « Directeur des Études » (périmètre établissement) + rattachements MULTI-ÉTABLISSEMENTS
-- (groupes scolaires) : table des affectations SECONDAIRES d'un utilisateur à des établissements,
-- donnant le même accès que l'établissement principal (Utilisateur.etablissementId).

-- Rôle « Directeur des Études » — responsable pédagogique de l'établissement.
INSERT INTO "roles" ("id", "nomTechnique", "libelle", "description", "rang") VALUES
  ('role_directeur_etudes', 'directeur_etudes', 'Directeur des Études',
   'Responsable pédagogique de l''établissement : emplois du temps, cahiers de texte, notes & bulletins et suivi des enseignants.', 56)
ON CONFLICT ("nomTechnique") DO NOTHING;

-- Rattachements secondaires (groupes scolaires) — même accès que l'établissement principal.
CREATE TABLE "affectations_etablissement" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "etablissementId" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affectations_etablissement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "affectations_etablissement_utilisateurId_etablissementId_key" ON "affectations_etablissement"("utilisateurId", "etablissementId");
CREATE INDEX "affectations_etablissement_etablissementId_idx" ON "affectations_etablissement"("etablissementId");
ALTER TABLE "affectations_etablissement" ADD CONSTRAINT "affectations_etablissement_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affectations_etablissement" ADD CONSTRAINT "affectations_etablissement_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "etablissements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
