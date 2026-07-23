import { getUtilisateurCourant } from "@/lib/auth/session";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";
import { paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import {
  COLONNES_ACTIVITES,
  COLONNES_ACTIVITES_COMPLEMENT,
  COLONNES_PROGRAMMES_CAFOP,
  COLONNES_PROGRAMMES_SECONDAIRE,
  completerEntete,
  echapperHtmlRapport as esc,
  type ContenuRapport,
  type IdSectionOfficielle,
  type ZoneSupplementaire,
} from "@/lib/inspection/rapport-disciplinaire";
import {
  apfcAutorisee,
  chargerModelePersonnel,
  chargerRapport,
  enteteParDefaut,
  nettoyerDiscipline,
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
 * Téléchargement WORD du rapport bilan CRD — même patron que les exports Word existants
 * (HTML servi en `application/msword`, ouvrable et ajustable dans Word). Le document est
 * RÉGÉNÉRÉ CÔTÉ SERVEUR depuis la base (rapport enregistré, sinon contenu pré-rempli par
 * les données) : aucun contenu ne transite par l'URL, et les paramètres ?apfc=&discipline=
 * sont revalidés avec les MÊMES gardes de lecture que la page (`apfcAutorisee`, fail-closed).
 * Configuration libre respectée : sections officielles RETIRÉES absentes du document, zones
 * supplémentaires rendues dans leur section, sections LIBRES rendues après les officielles
 * (même style de titre). En-tête 2 colonnes CONFIGURABLE (mentions enregistrées complétées
 * par les défauts pays/antenne) ; armoiries du pays par URL absolue. PAS de graphiques.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const apfcParam = url.searchParams.get("apfc") ?? "";
  const discipline = nettoyerDiscipline(url.searchParams.get("discipline"));

  const u = await getUtilisateurCourant();
  if (!u) return new Response("Session expirée.", { status: 401 });
  if (!apfcParam || !discipline) return new Response("Paramètres invalides.", { status: 400 });

  const apfc = await apfcAutorisee(u, apfcParam);
  if (!apfc) return new Response("Antenne hors de votre périmètre.", { status: 404 });

  // Même contenu que la page pour ce téléchargeur : un rapport NON enregistré est pré-rempli
  // puis reçoit la structure de SON modèle personnel ; un rapport enregistré est servi tel quel.
  const modele = peutAvoirModeleRapport(u) ? await chargerModelePersonnel(u.id) : null;
  const rapport = await chargerRapport(apfc, discipline, modele);
  const c: ContenuRapport = rapport.contenu;

  // En-tête officiel CONFIGURABLE : mentions enregistrées complétées par les défauts
  // (pays effectif de l'antenne — même règle que la fiche APFC) ; armoiries du pays.
  const pays = await paysEffectifApfc(apfc.region?.pays ?? null);
  const infoPays = trouverPays(pays);
  const armoiries = infoPays ? armoiriesUrl(infoPays.code) : null;
  const entete = completerEntete(c.entete, await enteteParDefaut(apfc, discipline));
  const dateDuJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(),
  );
  const faitA = apfc.localite?.trim() || apfc.region?.nom || "………………………";
  const titre = (rapport.titre || `Rapport bilan des activités — ${discipline}`).toUpperCase();

  const lignesMembres = c.membres
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Sections officielles RETIRÉES : absentes du document (leurs données restent en base).
  const visible = (id: IdSectionOfficielle) => !c.sectionsMasquees.includes(id);
  const zones = (id: IdSectionOfficielle) => zonesWord(c.zonesSupplementaires[id]);

  const blocs: string[] = [];

  if (visible("membres")) {
    blocs.push(
      titreSection("Membres de la Coordination Régionale Disciplinaire"),
      lignesMembres.length
        ? `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:10pt"><tbody>${lignesMembres
            .map((m, i) => `<tr><td style="width:8%;text-align:center">${i + 1}</td><td>${esc(m)}</td></tr>`)
            .join("")}</tbody></table>`
        : `<p style="color:#777;font-style:italic;font-size:10pt">Aucun membre renseigné.</p>`,
      zones("membres"),
    );
  }

  if (visible("introduction")) {
    blocs.push(
      titreSection("Introduction"),
      `<p style="text-align:justify">${multiligne(c.introduction)}</p>`,
      zones("introduction"),
    );
  }

  if (visible("bilan")) {
    blocs.push(
      titreSection("I – Bilan des activités menées"),
      sousTitre("I-1. PRIMAIRE/CAFOP"),
      tableauWord(COLONNES_ACTIVITES, c.activitesPrimaire),
      sousTitre("I-2. SECONDAIRE"),
      tableauWord(COLONNES_ACTIVITES, c.activitesSecondaire),
      sousTitre("Autres activités (objet, prévisions et réalisations)"),
      tableauWord(COLONNES_ACTIVITES_COMPLEMENT, c.activitesComplement),
      zones("bilan"),
    );
  }

  if (visible("programmes")) {
    blocs.push(
      titreSection("II – Etat d'exécution des programmes"),
      sousTitre("CAFOP"),
      tableauWord(COLONNES_PROGRAMMES_CAFOP, c.programmesCafop),
      sousTitre("Secondaire (premier cycle)"),
      tableauWord(COLONNES_PROGRAMMES_SECONDAIRE, c.programmesPremierCycle),
      sousTitre("Secondaire (Second cycle)"),
      tableauWord(COLONNES_PROGRAMMES_SECONDAIRE, c.programmesSecondCycle),
      zones("programmes"),
    );
  }

  if (visible("analyse")) {
    blocs.push(
      titreSection("III – Analyse des activités menées"),
      `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:9.5pt">
        <thead><tr>
          <th style="background:#eaf3ec;width:33%">POINTS DE SATISFACTION</th>
          <th style="background:#eaf3ec;width:33%">INSUFFISANCES RELEVEES</th>
          <th style="background:#eaf3ec;width:34%">SOLUTIONS PROPOSEES</th>
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
      titreSection("Conclusion"),
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

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Rapport bilan CRD</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a;font-size:10.5pt">
    <!-- En-tête officiel 2 colonnes du modèle (mentions à gauche, État/armoiries/devise à droite). -->
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="width:55%;vertical-align:top;font-size:9.5pt;font-weight:bold;text-transform:uppercase">
        <div>${esc(entete.ministere)}</div>
        ${POINTILLES}
        ${entete.directionRegionale ? `<div>${esc(entete.directionRegionale)}</div>${POINTILLES}` : ""}
        <div>${esc(entete.antenne)}</div>
        ${POINTILLES}
        <div>${esc(entete.coordination)}</div>
      </td>
      <td style="width:45%;vertical-align:top;text-align:center;font-size:9.5pt">
        <div style="font-weight:bold">${esc(entete.republique)}</div>
        ${armoiries ? `<img src="${esc(armoiries)}" alt="Armoiries" width="86" style="margin:4pt 0"/>` : ""}
        ${entete.devise ? `<div style="font-style:italic">« ${esc(entete.devise)} »</div>` : ""}
      </td>
    </tr></table>

    <!-- Bloc TITRE violet du modèle (titre saisi par l'utilisateur, reproduit à l'identique). -->
    <table style="width:100%;border-collapse:collapse;margin:16pt 0 14pt"><tr>
      <td style="background:#7c6a9c;border:2.5pt solid #3f3358;padding:12pt;text-align:center;font-size:14pt;font-weight:bold;color:#000">${esc(titre)}</td>
    </tr></table>

    ${blocs.join("\n")}

    <br/>
    <table style="width:100%;font-size:10.5pt"><tr>
      <td style="width:50%"></td>
      <td style="width:50%;text-align:center">
        Fait à ${esc(faitA)}, le ${esc(dateDuJour)}<br/><br/>
        <b>Le Coordinateur Régional Disciplinaire</b><br/><br/><br/>
        ${c.coordinateur ? `<b>${esc(c.coordinateur)}</b>` : "____________________"}
      </td>
    </tr></table>
  </body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-crd-${slugFichier(discipline)}-${slugFichier(apfc.nom)}.doc"`,
    },
  });
}
