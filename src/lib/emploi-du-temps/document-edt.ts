import "server-only";

/**
 * Document HTML AUTONOME et IMPRIMABLE (A4 paysage) d'un emploi du temps — contenu des
 * fichiers des archives ZIP (un fichier par classe ou par enseignant). S'ouvre dans
 * n'importe quel navigateur ; « Imprimer » y produit directement un PDF propre.
 */

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function gabaritEdtDocument({
  titre,
  sousTitre,
  etablissementNom,
  anneeScolaire,
  tableau,
}: {
  titre: string;
  sousTitre: string | null;
  etablissementNom: string;
  anneeScolaire: string | null;
  tableau: string;
}): string {
  const annee = anneeScolaire ? ` — Année scolaire ${anneeScolaire}` : "";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(titre)} — ${echapper(etablissementNom)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1e2a25; margin: 24px; background: #ffffff; }
  h1 { font-size: 20px; color: #0f3527; margin: 0 0 4px; }
  p.sous { margin: 0 0 2px; font-size: 14px; color: #2b3a33; }
  footer { margin-top: 16px; font-size: 11px; color: #6b7d73; }
  @page { size: A4 landscape; margin: 8mm; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>${echapper(titre)}</h1>
<p class="sous"><strong>${echapper(etablissementNom)}</strong>${echapper(annee)}</p>
${sousTitre ? `<p class="sous">${echapper(sousTitre)}</p>` : ""}
${tableau}
<footer>Généré par EduWeb Planner — plateforme de gestion et de planification scolaire.</footer>
</body>
</html>`;
}
