/**
 * Modèle CSV d'import des utilisateurs d'un établissement.
 * Colonnes : prenoms ; nom ; email ; role ; disciplines ; niveaux
 *  - role : enseignant (défaut), educateur, chef_etablissement, parent, eleve
 *  - disciplines : nom de la discipline ; plusieurs disciplines séparées par « | »
 *    (ex : Mathématiques|Physique-Chimie)
 *  - niveaux : « 1er cycle » ou « 2nd cycle ». Un enseignant du 2nd cycle peut
 *    enseigner dans les DEUX cycles ; un enseignant du 1er cycle uniquement au 1er.
 */
export function GET() {
  const contenu =
    // BOM UTF-8 : sans lui, Excel interprète le fichier en Windows-1252 (accents cassés).
    "﻿" +
    "prenoms;nom;email;role;disciplines;niveaux\n" +
    "Aya;Kouassi;aya.kouassi@exemple.ci;enseignant;Mathématiques|Physique-Chimie;2nd cycle\n" +
    "Koffi;Yao;koffi.yao@exemple.ci;enseignant;Français;1er cycle\n" +
    "Awa;Traoré;awa.traore@exemple.ci;enseignant;SVT|LV2;2nd cycle\n" +
    "Marc;Diabaté;marc.diabate@exemple.ci;educateur;;\n";
  return new Response(contenu, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modele-utilisateurs.csv"',
    },
  });
}
