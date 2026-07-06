-- Le slogan national officiel n'est plus figé sur la Côte d'Ivoire : il est déduit
-- automatiquement de la devise du pays de l'établissement (sloganOfficiel()). On retire
-- donc la valeur par défaut « Union – Discipline – Travail » au niveau du schéma pour
-- ne plus stocker une devise erronée sur les établissements d'autres pays.
-- (Aucune donnée existante n'est modifiée : l'affichage privilégie déjà la devise du pays.)
ALTER TABLE "etablissements"
  ALTER COLUMN "sloganBulletin" DROP DEFAULT;
