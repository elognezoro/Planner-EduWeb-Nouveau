import { getUtilisateurCourant } from "@/lib/auth/session";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";
import { paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import { completerEntete, echapperHtmlRapport as esc } from "@/lib/inspection/rapport-commun";
import {
  dateIsoEnFrancais,
  estTypeRapportAntenne,
  lireFenetre,
  lirePeriode,
  titresNiveau1,
  type ContenuRapportAntenne,
  type NiveauTitre,
  type SectionPlan,
  type TableauSection,
} from "@/lib/inspection/rapport-antenne";
import {
  apfcAutorisee,
  chargerModeleAntenne,
  chargerRapportAntenne,
  enteteParDefautAntenne,
  peutAvoirModeleRapport,
  preparerBlocsAuto,
} from "../rapport-serveur";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugFichier(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Texte multi-lignes → HTML échappé avec retours à la ligne Word. */
function multiligne(s: string): string {
  return esc(s).replaceAll("\n", "<br/>");
}

/** STYLES DE TITRES HIÉRARCHIQUES du plan (niveau 1 grand/centré, 2 moyen, 3 normal gras). */
function titreHierarchique(niveau: NiveauTitre, texte: string): string {
  if (niveau === 1) {
    return `<h1 style="color:#14532d;font-size:13.5pt;font-weight:bold;text-transform:uppercase;text-align:center;text-decoration:underline;margin:16pt 0 6pt">${esc(texte)}</h1>`;
  }
  if (niveau === 2) {
    return `<h2 style="color:#14532d;font-size:12pt;font-weight:bold;margin:12pt 0 4pt">${esc(texte)}</h2>`;
  }
  return `<h3 style="color:#1a1a1a;font-size:10.5pt;font-weight:bold;margin:9pt 0 3pt">${esc(texte)}</h3>`;
}

/** Tableau d'une section (auto ou manuel) : titre gras + tableau à bordures. */
function tableauWord(t: TableauSection): string {
  const entetes = t.colonnes.map((c) => `<th style="background:#eaf3ec;text-align:left">${esc(c)}</th>`).join("");
  const corps = t.lignes.length
    ? t.lignes
        .map((l) => `<tr>${l.map((c) => `<td style="vertical-align:top">${multiligne(c)}</td>`).join("")}</tr>`)
        .join("")
    : `<tr><td colspan="${t.colonnes.length}" style="color:#777;font-style:italic">Aucune ligne</td></tr>`;
  return `${t.titre.trim() ? `<p style="font-size:10.5pt;font-weight:bold;margin:8pt 0 3pt">${esc(t.titre)}</p>` : ""}
    <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:9pt">
      <thead><tr>${entetes}</tr></thead><tbody>${corps}</tbody></table>`;
}

/** « PLAN DE PRÉSENTATION » : liste ordonnée des titres de niveau 1 (générée). */
function planPresentation(sections: SectionPlan[]): string {
  const titres = titresNiveau1(sections);
  if (titres.length === 0) return "";
  return `<ol style="font-size:10.5pt;margin:4pt 0 4pt 18pt">${titres.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>`;
}

const POINTILLES = `<div style="color:#555;font-size:8pt">--------------------------------</div>`;

/**
 * Téléchargement WORD d'un rapport d'ANTENNE v2 « plan hiérarchique » — même patron que les
 * exports Word existants (HTML servi en `application/msword`, ajustable par l'autorité
 * utilisatrice). Document RÉGÉNÉRÉ CÔTÉ SERVEUR depuis la base : ?type=&apfc=&periode=
 * (+ ?debut=&fin= pour la fenêtre des blocs auto d'un rapport non enregistré) revalidés avec
 * les MÊMES gardes de lecture que la page (`apfcAutorisee`, fail-closed). Sections rendues
 * dans l'ordre du plan avec des STYLES DE TITRES HIÉRARCHIQUES, « PLAN DE PRÉSENTATION »
 * généré, tous les tableaux (auto et manuels) à bordures, période des données rappelée,
 * signature « Le Chef d'Antenne ». PAS de graphiques dans le Word.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const typeBrut = url.searchParams.get("type") ?? "";
  const apfcParam = url.searchParams.get("apfc") ?? "";

  const u = await getUtilisateurCourant();
  if (!u) return new Response("Session expirée.", { status: 401 });
  if (!apfcParam || !estTypeRapportAntenne(typeBrut)) return new Response("Paramètres invalides.", { status: 400 });
  const periode = lirePeriode(typeBrut, url.searchParams.get("periode"));
  if (!periode) return new Response("Paramètres invalides.", { status: 400 });
  const fenetre = lireFenetre(periode, url.searchParams.get("debut"), url.searchParams.get("fin"));

  const apfc = await apfcAutorisee(u, apfcParam);
  if (!apfc) return new Response("Antenne hors de votre périmètre.", { status: 404 });

  // Même contenu que la page : rapport enregistré servi tel quel ; sinon pré-remplissage
  // (blocs auto de la fenêtre) + modèle personnel du téléchargeur.
  const ctx = await preparerBlocsAuto(apfc, typeBrut, periode, fenetre);
  const modele = peutAvoirModeleRapport(u) ? await chargerModeleAntenne(u.id, typeBrut) : null;
  const rapport = await chargerRapportAntenne(apfc, typeBrut, periode, fenetre, ctx, modele, false);
  const c: ContenuRapportAntenne = rapport.contenu;

  const pays = await paysEffectifApfc(apfc.region?.pays ?? null);
  const infoPays = trouverPays(pays);
  const armoiries = infoPays ? armoiriesUrl(infoPays.code) : null;
  const entete = completerEntete(c.entete, await enteteParDefautAntenne(apfc));
  const dateDuJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(),
  );
  const faitA = apfc.localite?.trim() || apfc.region?.nom || "………………………";
  const titre = (rapport.titre || `Rapport d'activités — ${apfc.nom}`).toUpperCase();
  const plage =
    c.periode.debut && c.periode.fin
      ? `du ${dateIsoEnFrancais(c.periode.debut)} au ${dateIsoEnFrancais(c.periode.fin)}`
      : `du ${dateIsoEnFrancais(fenetre.debutIso)} au ${dateIsoEnFrancais(fenetre.finIso)}`;

  // Sections dans l'ORDRE DU PLAN, avec leurs styles de titres hiérarchiques.
  const blocs: string[] = [];
  for (const section of c.sections) {
    if (!section.titre.trim() && !section.texte.trim() && section.tableaux.length === 0 && !section.planAuto) continue;
    if (section.titre.trim()) blocs.push(titreHierarchique(section.niveau, section.titre));
    if (section.planAuto) {
      blocs.push(planPresentation(c.sections));
      continue;
    }
    if (section.texte.trim()) blocs.push(`<p style="text-align:justify">${multiligne(section.texte)}</p>`);
    for (const tableau of section.tableaux) blocs.push(tableauWord(tableau));
  }

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Rapport d'antenne</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a;font-size:10.5pt">
    <!-- En-tête officiel 2 colonnes (mentions configurables à gauche, État/armoiries/devise à droite). -->
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="width:55%;vertical-align:top;font-size:9.5pt;font-weight:bold;text-transform:uppercase">
        <div>${esc(entete.ministere)}</div>
        ${POINTILLES}
        ${entete.directionRegionale ? `<div>${esc(entete.directionRegionale)}</div>${POINTILLES}` : ""}
        <div>${esc(entete.antenne)}</div>
        ${entete.coordination ? `${POINTILLES}<div>${esc(entete.coordination)}</div>` : ""}
      </td>
      <td style="width:45%;vertical-align:top;text-align:center;font-size:9.5pt">
        <div style="font-weight:bold">${esc(entete.republique)}</div>
        ${armoiries ? `<img src="${esc(armoiries)}" alt="Armoiries" width="86" style="margin:4pt 0"/>` : ""}
        ${entete.devise ? `<div style="font-style:italic">« ${esc(entete.devise)} »</div>` : ""}
      </td>
    </tr></table>

    <!-- Bloc TITRE violet (titre saisi, reproduit à l'identique) + période des données. -->
    <table style="width:100%;border-collapse:collapse;margin:16pt 0 4pt"><tr>
      <td style="background:#7c6a9c;border:2.5pt solid #3f3358;padding:12pt;text-align:center;font-size:14pt;font-weight:bold;color:#000">${esc(titre)}</td>
    </tr></table>
    <p style="text-align:center;font-size:9.5pt;color:#555;margin:0 0 12pt">Données de la période : ${esc(plage)}</p>

    ${blocs.join("\n")}

    <br/>
    <table style="width:100%;font-size:10.5pt"><tr>
      <td style="width:50%"></td>
      <td style="width:50%;text-align:center">
        Fait à ${esc(faitA)}, le ${esc(dateDuJour)}<br/><br/>
        <b>Le Chef d'Antenne</b><br/><br/><br/>
        ${c.signataire ? `<b>${esc(c.signataire)}</b>` : "____________________"}
      </td>
    </tr></table>
  </body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-${slugFichier(typeBrut)}-${slugFichier(apfc.nom)}.doc"`,
    },
  });
}
