-- Le rôle « Directeur des Études » devient un ALIAS RBAC du Chef d'établissement : le compte
-- garde son rôle technique "directeur_etudes" (et son libellé d'affichage), mais hérite
-- AUTOMATIQUEMENT de toutes les habilitations du Chef d'établissement (cf. roleEffectifRBAC,
-- src/lib/rbac/roles.ts, appliqué au point unique src/lib/auth/session.ts). Rang (56) et
-- portée ("etablissement") restent inchangés ; seule la description change pour refléter cette
-- équivalence — la migration précédente (20260718040000) l'avait insérée avec une description
-- de rôle pédagogique à périmètre réduit, désormais obsolète.
UPDATE "roles"
SET "description" = 'Direction des études d''un établissement privé : mêmes habilitations que le Chef d''établissement.'
WHERE "nomTechnique" = 'directeur_etudes';
