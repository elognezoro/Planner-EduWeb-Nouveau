-- Nom d'affichage des NIVEAUX propre à chaque établissement (« renommer 6ème en 6e »).
--
-- Même raison que la colonne `ordre` (migration 20260812140000) : la table `niveaux` est PARTAGÉE
-- par tous les établissements (nom canonique unique au niveau national). Renommer là toucherait
-- TOUTES les écoles. Le libellé local vit donc sur la table de liaison par établissement.
--
-- Nullable À DESSEIN : nul = aucun nom local, on affiche le nom canonique `niveaux.nom`. Aucune
-- ligne existante modifiée ; l'affichage actuel est conservé tant qu'un établissement ne renomme pas.
--
-- Base = PRODUCTION : écrite à la main, appliquée par `prisma migrate deploy`.

ALTER TABLE "niveaux_etablissement" ADD COLUMN IF NOT EXISTS "nomAffiche" TEXT;
