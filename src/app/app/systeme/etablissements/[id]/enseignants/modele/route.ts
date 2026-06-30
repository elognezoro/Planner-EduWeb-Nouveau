/**
 * Modèle CSV d'import des utilisateurs d'un établissement.
 * Colonnes : prenoms ; nom ; email ; role ; disciplines ; niveaux
 *  - role : enseignant (défaut), educateur, chef_etablissement, parent, eleve
 *  - disciplines / niveaux : séparés par « | » (utiles pour les enseignants)
 */
export function GET() {
  const contenu =
    "prenoms;nom;email;role;disciplines;niveaux\n" +
    "Aya;Kouassi;aya.kouassi@exemple.ci;enseignant;Mathématiques|Physique-Chimie;6ème|5ème|4ème\n" +
    "Koffi;Yao;koffi.yao@exemple.ci;enseignant;Français;6ème|5ème\n" +
    "Awa;Traoré;awa.traore@exemple.ci;enseignant;SVT;3ème|Seconde\n" +
    "Marc;Diabaté;marc.diabate@exemple.ci;educateur;;\n";
  return new Response(contenu, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modele-utilisateurs.csv"',
    },
  });
}
