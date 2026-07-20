-- Terme local désignant les APFC, réglable par pays (même mécanisme que le terme CAFOP existant
-- sur "parametres_cafop_pays" : un champ de plus sur la même table, pas de nouveau modèle).
ALTER TABLE "parametres_cafop_pays" ADD COLUMN "termeApfc" TEXT NOT NULL DEFAULT 'APFC';
