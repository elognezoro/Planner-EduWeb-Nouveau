-- Catégorie pédagogique de l'établissement (préscolaire/primaire/secondaire/supérieur) :
-- pilote l'adaptation de toute la console de configuration (pas de distinction 1er/2nd
-- cycle au préscolaire/primaire — maîtres polyvalents).

-- AlterTable
ALTER TABLE "etablissements" ADD COLUMN "categoriePedagogique" TEXT;

-- Rétro-remplissage depuis le type existant : prescolaire/primaire conservés tels quels,
-- tout le reste (college, lycee, technique, formation_professionnelle,
-- technique_professionnel, groupe_scolaire, autre) devient "secondaire" par défaut.
-- « superieur » n'est jamais dérivé automatiquement : sélectionnable seulement à la main.
UPDATE "etablissements" SET "categoriePedagogique" = CASE
  WHEN "type" = 'prescolaire' THEN 'prescolaire'
  WHEN "type" = 'primaire' THEN 'primaire'
  ELSE 'secondaire'
END
WHERE "categoriePedagogique" IS NULL;
