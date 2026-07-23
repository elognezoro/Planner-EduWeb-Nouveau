import { getUtilisateurCourant } from "@/lib/auth/session";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";
import { paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import {
  completerEntete,
  echapperHtmlRapport as esc,
  type ZoneSupplementaire,
} from "@/lib/inspection/rapport-commun";
import {
  COLONNES_ACTIVITES_ANTENNE,
  COLONNES_AUTRES_ACTIVITES_ANTENNE,
  COLONNES_PROGRAMMES_CYCLE,
  SOUS_COLONNES_CAFOP,
  SOUS_COLONNES_SECONDAIRE,
  TABLEAUX_ACTIVITES_ANTENNE,
  estTypeRapportAntenne,
  lirePeriode,
  titreSectionAntenne,
  type ContenuRapportAntenne,
  type IdSectionAntenne,
  type MatriceProgrammes,
} from "@/lib/inspection/rapport-antenne";
import {
  apfcAutorisee,
  chargerModeleAntenne,
  chargerRapportAntenne,
  enteteParDefautAntenne,
  peutAvoirModeleRapport,
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

/** Tableau officiel à bordures (en-têtes + lignes de cellules texte). */
function tableauWord(colonnes: readonly string[], lignes: string[][]): string {
  const entetes = colonnes.map((c) => `<th style="background:#eaf3ec;text-align:left">${esc(c)}</th>`).join("");
  const corps = lignes.length
    ? lignes
        .map((l) => `<tr>${l.map((c) => `<td style="vertical-align:top">${multiligne(c)}</td>`).join("")}</tr>`)
        .join("")
    : `<tr><td colspan="${colonnes.length}" style="color:#777;font-style:italic">Aucune ligne</td></tr>`;
  return `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:9pt">
    <thead><tr>${entetes}</tr></thead><tbody>${corps}</tbody></table>`;
}

/** Matrice « disciplines × niveaux » (II-2 / II-3) : en-tête à deux rangées avec fusions. */
function matriceWord(sousColonnes: readonly string[], matrice: MatriceProgrammes): string {
  const rangee1 =
    `<th rowspan="2" style="background:#eaf3ec;text-align:left">Niveaux</th>` +
    matrice.disciplines
      .map((d) => `<th colspan="${sousColonnes.length}" style="background:#eaf3ec;text-align:center">${esc(d || "—")}</th>`)
      .join("");
  const rangee2 = matrice.disciplines
    .map(() => sousColonnes.map((sc) => `<th style="background:#f4f9f5;text-align:left">${esc(sc)}</th>`).join(""))
    .join("");
  const corps = matrice.lignes.length
    ? matrice.lignes
        .map(
          (l) =>
            `<tr><td style="font-weight:bold">${esc(l.niveau)}</td>${l.valeurs
              .map((sous) => sous.map((c) => `<td style="vertical-align:top">${multiligne(c)}</td>`).join(""))
              .join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${1 + matrice.disciplines.length * sousColonnes.length}" style="color:#777;font-style:italic">Aucune ligne</td></tr>`;
  return `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:8.5pt">
    <thead><tr>${rangee1}</tr><tr>${rangee2}</tr></thead><tbody>${corps}</tbody></table>`;
}

function titreSection(texte: string): string {
  return `<h2 style="color:#14532d;font-size:12.5pt;margin:14pt 0 5pt;text-transform:uppercase">${esc(texte)}</h2>`;
}

function sousTitre(texte: string): string {
  return `<p style="font-size:11pt;font-weight:bold;margin:9pt 0 3pt">${esc(texte)}</p>`;
}

/** Zones de saisie supplémentaires d'une section : sous-titre gras + paragraphes. */
function zonesWord(zones: ZoneSupplementaire[] | undefined): string {
  return (zones ?? [])
    .filter((z) => z.titre.trim() || z.texte.trim())
    .map(
      (z) =>
        `${z.titre.trim() ? sousTitre(z.titre) : ""}${
          z.texte.trim() ? `<p style="text-align:justify">${multiligne(z.texte)}</p>` : ""
        }`,
    )
    .join("");
}

const POINTILLES = `<div style="color:#555;font-size:8pt">--------------------------------</div>`;

/**
 * Téléchargement WORD d'un rapport d'ANTENNE (trimestriel / annuel) — même patron que les
 * exports Word existants (HTML servi en `application/msword`). Document RÉGÉNÉRÉ CÔTÉ SERVEUR
 * depuis la base : ?type=&apfc=&periode= revalidés avec les MÊMES gardes de lecture que la
 * page (`apfcAutorisee`, fail-closed) ; un rapport NON enregistré est pré-rempli (agrégations
 * CRD/trimestriels + visites) puis reçoit le modèle personnel du téléchargeur — parité exacte
 * avec la page. Configuration libre respectée (sections retirées absentes, zones rendues,
 * sections libres après les officielles). PAS de graphiques dans le Word.
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

  const apfc = await apfcAutorisee(u, apfcParam);
  if (!apfc) return new Response("Antenne hors de votre périmètre.", { status: 404 });

  const modele = peutAvoirModeleRapport(u) ? await chargerModeleAntenne(u.id, typeBrut) : null;
  const rapport = await chargerRapportAntenne(apfc, typeBrut, periode, modele);
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

  const visible = (id: IdSectionAntenne) => !c.sectionsMasquees.includes(id);
  const zones = (id: IdSectionAntenne) => zonesWord(c.zonesSupplementaires[id]);

  const blocs: string[] = [];

  if (visible("introduction")) {
    blocs.push(
      titreSection(titreSectionAntenne("introduction", typeBrut)),
      `<p style="text-align:justify">${multiligne(c.introduction)}</p>`,
      zones("introduction"),
    );
  }

  if (visible("activites")) {
    blocs.push(titreSection(titreSectionAntenne("activites", typeBrut)));
    for (const t of TABLEAUX_ACTIVITES_ANTENNE) {
      blocs.push(
        sousTitre(t.titre),
        tableauWord(t.cle === "actAutres" ? COLONNES_AUTRES_ACTIVITES_ANTENNE : COLONNES_ACTIVITES_ANTENNE, c[t.cle]),
      );
    }
    blocs.push(zones("activites"));
  }

  if (visible("programmes")) {
    blocs.push(
      titreSection(titreSectionAntenne("programmes", typeBrut)),
      sousTitre("II-1. PRÉSCOLAIRE"),
      tableauWord(COLONNES_PROGRAMMES_CYCLE, c.programmesPrescolaire),
      sousTitre("II-1. PRIMAIRE"),
      tableauWord(COLONNES_PROGRAMMES_CYCLE, c.programmesPrimaire),
      sousTitre("II-2. CAFOP"),
      matriceWord(SOUS_COLONNES_CAFOP, c.programmesCafop),
      sousTitre("II-3. SECONDAIRE GÉNÉRAL"),
      matriceWord(SOUS_COLONNES_SECONDAIRE, c.programmesSecondaire),
      zones("programmes"),
    );
  }

  if (visible("analyse")) {
    blocs.push(
      titreSection(titreSectionAntenne("analyse", typeBrut)),
      `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:9.5pt">
        <thead><tr>
          <th style="background:#eaf3ec;width:33%">POINTS DE SATISFACTION</th>
          <th style="background:#eaf3ec;width:33%">INSUFFISANCES RELEVÉES</th>
          <th style="background:#eaf3ec;width:34%">SOLUTIONS PROPOSÉES</th>
        </tr></thead>
        <tbody><tr>
          <td style="vertical-align:top">${multiligne(c.analyse.satisfactions)}</td>
          <td style="vertical-align:top">${multiligne(c.analyse.insuffisances)}</td>
          <td style="vertical-align:top">${multiligne(c.analyse.solutions)}</td>
        </tr></tbody>
      </table>`,
      zones("analyse"),
    );
  }

  if (visible("conclusion")) {
    blocs.push(
      titreSection(titreSectionAntenne("conclusion", typeBrut)),
      `<p style="text-align:justify">${multiligne(c.conclusion)}</p>`,
      zones("conclusion"),
    );
  }

  // Sections LIBRES : après les sections officielles, même style de titre.
  for (const section of c.sectionsLibres) {
    const contenuSection = zonesWord(section.zones);
    if (!section.titre.trim() && !contenuSection) continue;
    blocs.push(titreSection(section.titre.trim() || "Section complémentaire"), contenuSection);
  }

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Rapport d'antenne</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a;font-size:10.5pt">
    <!-- En-tête officiel 2 colonnes (mentions à gauche, État/armoiries/devise à droite). -->
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

    <!-- Bloc TITRE violet du modèle (titre saisi, reproduit à l'identique). -->
    <table style="width:100%;border-collapse:collapse;margin:16pt 0 14pt"><tr>
      <td style="background:#7c6a9c;border:2.5pt solid #3f3358;padding:12pt;text-align:center;font-size:14pt;font-weight:bold;color:#000">${esc(titre)}</td>
    </tr></table>

    ${blocs.join("\n")}

    <br/>
    <table style="width:100%;font-size:10.5pt"><tr>
      <td style="width:50%"></td>
      <td style="width:50%;text-align:center">
        Fait à ${esc(faitA)}, le ${esc(dateDuJour)}<br/><br/>
        <b>Le Chef de l'Antenne</b><br/><br/><br/>
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
