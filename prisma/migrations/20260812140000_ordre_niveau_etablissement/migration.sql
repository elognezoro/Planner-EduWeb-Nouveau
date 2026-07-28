-- Ordre d'affichage des NIVEAUX propre à chaque établissement (« faire remonter 6ème en tête »).
--
-- Pourquoi ici et pas sur `niveaux` : la table `Niveau` est PARTAGÉE par tous les établissements
-- (nom unique au niveau national). Y toucher réordonnerait les onglets de TOUTES les écoles —
-- effet de bord inacceptable. La colonne vit donc sur la table de liaison par établissement.
--
-- Nullable À DESSEIN : nul = aucun choix local exprimé, on retombe sur l'ordre global
-- `niveaux.ordre`. Aucune ligne existante n'est donc modifiée, et l'affichage actuel est conservé
-- tant qu'un établissement ne réordonne pas lui-même.
--
-- Base = PRODUCTION : migration écrite à la main, appliquée par `prisma migrate deploy`.

ALTER TABLE "niveaux_etablissement" ADD COLUMN IF NOT EXISTS "ordre" INTEGER;
