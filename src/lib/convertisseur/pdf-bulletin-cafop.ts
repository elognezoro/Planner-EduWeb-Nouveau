// Construction du document HTML d'un bulletin individuel d'élève-maître (CAFOP), imprimable via
// le navigateur (« Enregistrer au format PDF »). Fonction pure, sans dépendance au DOM.
//
// Format officiel ivoirien (bulletin de notes) : en-tête à deux panneaux (identité de l'État et
// du centre à gauche, année/semestre/identité de l'élève-maître à droite), tableau des modules
// (moyenne, coefficient, rang, appréciation, émargement du professeur), puis les synthèses
// (conduite, note de stage, total général, moyenne, rang), absences & résultats annuels,
// distinctions, décision du conseil, sanctions et visa du directeur.

import { appliquerTerme } from "@/lib/cafop-terme";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";

export interface LigneBulletin {
  module: string;
  coef: number;
  moyenne: number | null; // /20
  /** Rang de l'élève-maître dans le module (au sein du groupe-classe). */
  rang?: number | null;
  /** Nom du professeur du module (colonne « émargement ») — sinon cellule vierge à signer. */
  prof?: string | null;
}

export interface BulletinCafop {
  cafop: string;
  drena?: string | null;
  pays: string;
  /** Nom complet (repli pour le titre du document). */
  eleve: string;
  /** NOM (en majuscules) — panneau d'identité. */
  nom?: string | null;
  /** Prénoms — panneau d'identité. */
  prenoms?: string | null;
  matricule?: string | null;
  dateNaissance?: string | null;
  promotion: string;
  groupe?: string | null;
  profPrincipal?: string | null;
  directeur?: string | null;
  /** Logo du CAFOP (déposé en configuration) — affiché sous le nom du centre. */
  logoUrl?: string | null;
  semestre: number;
  annee: string;
  lignes: LigneBulletin[];
  moyenneGenerale: number | null;
  rang: number;
  effectif: number;
  /** Note de stage pratique (/20) si distincte des modules. */
  noteStage?: number | null;
  /** Appréciation de conduite (issue du registre d'appel) — sinon cellule à renseigner. */
  conduite?: string | null;
  absencesJustifiees?: number | null;
  absencesNonJustifiees?: number | null;
  /** Résultats annuels (renseignés au 2e semestre) — sinon cellules à compléter. */
  moyenneAnnuelle?: number | null;
  rangAnnuel?: number | null;
  /** Coordonnées du centre (panneau de gauche) — affichées si fournies. */
  bp?: string | null;
  tel?: string | null;
  email?: string | null;
  date: string;
  /** Terme usuel du pays pour « CAFOP » (défaut : CAFOP). */
  terme?: string;
}

const eh = (v: string | null | undefined): string =>
  (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (v: number | null | undefined): string => (v === null || v === undefined ? "—" : v.toFixed(2).replace(".", ","));
/** Rang formaté en français (1er, 2e, 3e…), « — » si inconnu. */
export const rangFr = (n: number | null | undefined): string => (n == null || n <= 0 ? "—" : n === 1 ? "1er" : `${n}e`);
export const ordinalSemestre = (n: number): string =>
  n === 1 ? "PREMIER SEMESTRE" : n === 2 ? "DEUXIÈME SEMESTRE" : n === 3 ? "TROISIÈME SEMESTRE" : `SEMESTRE ${n}`;

/** Appréciation automatique d'après la moyenne générale (/20). */
export function appreciationCafop(moy: number | null): string {
  if (moy === null) return "Non évalué";
  if (moy >= 16) return "Très bien — félicitations du conseil";
  if (moy >= 14) return "Bien — travail satisfaisant";
  if (moy >= 12) return "Assez bien — encouragements";
  if (moy >= 10) return "Passable — peut mieux faire";
  return "Insuffisant — doit se ressaisir";
}

/** Appréciation compacte par module (colonne « APPRÉCIATION »). */
export function mentionCourte(moy: number | null | undefined): string {
  if (moy === null || moy === undefined) return "—";
  if (moy >= 16) return "Très bien";
  if (moy >= 14) return "Bien";
  if (moy >= 12) return "Assez bien";
  if (moy >= 10) return "Passable";
  if (moy >= 8) return "Insuffisant";
  return "Très insuffisant";
}

/** Distinction proposée d'après la moyenne générale (paliers exclusifs). */
export function distinctionsBulletin(moy: number | null): { honneur: boolean; encouragements: boolean; felicitations: boolean } {
  if (moy === null) return { honneur: false, encouragements: false, felicitations: false };
  return {
    felicitations: moy >= 16,
    encouragements: moy >= 14 && moy < 16,
    honneur: moy >= 12 && moy < 14,
  };
}

/** Case à cocher (rendu fiable à l'impression, indépendant des polices). */
const caseCoche = (on: boolean): string => `<span class="case${on ? " on" : ""}"></span>`;
/** Ligne d'un panneau d'identité (libellé : valeur). */
const infoLigne = (label: string, valeur: string): string =>
  `<tr><td class="k">${eh(label)}</td><td class="v">${valeur || "&nbsp;"}</td></tr>`;

export function construireHtmlBulletinCafop(b: BulletinCafop, opts: { autoImpression?: boolean } = {}): string {
  const T = (s: string) => appliquerTerme(s, b.terme ?? "CAFOP");
  const infoPays = trouverPays(b.pays);
  const intituleEtat = (infoPays?.intitule ?? `République de ${b.pays}`).toUpperCase();
  const devise = infoPays?.devise ?? "";
  const ministere = infoPays?.ministere ?? "Ministère de l'Éducation Nationale";
  const armoiries = infoPays ? armoiriesUrl(infoPays.code) : null;

  const nomAffiche = b.nom ?? b.eleve;
  const dist = distinctionsBulletin(b.moyenneGenerale);

  const totalCoef = b.lignes.reduce((s, l) => s + l.coef, 0);
  const totalPondere = b.lignes.reduce((s, l) => s + (l.moyenne === null ? 0 : l.moyenne * l.coef), 0);

  const corps = b.lignes
    .map(
      (l) => `<tr>
      <td class="mod">${eh(l.module)}</td>
      <td class="c fort">${fmt(l.moyenne)}</td>
      <td class="c">${l.coef}</td>
      <td class="c">${rangFr(l.rang)}</td>
      <td class="c app">${eh(mentionCourte(l.moyenne))}</td>
      <td class="emarg">${l.prof ? eh(l.prof) : ""}</td>
    </tr>`,
    )
    .join("");

  // Coordonnées du centre (affichées seulement si renseignées).
  const coord = [b.bp && `BP : ${eh(b.bp)}`, b.tel && `Tél : ${eh(b.tel)}`, b.email && `Email : ${eh(b.email)}`]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  const scriptImpression = opts.autoImpression
    ? `<script>(function(){function p(){window.focus();window.print();}if(document.readyState==="complete"){p();}else{window.addEventListener("load",p);}})();<\/script>`
    : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bulletin — ${eh(b.eleve)}</title>
<style>
  @page { size: A4 portrait; margin: 11mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #16241b; margin: 0; font-size: 11px; line-height: 1.35; }
  .doc { border: 1.5px solid #1f4d36; padding: 0; }

  /* En-tête : deux panneaux côte à côte. */
  .entete { width: 100%; border-collapse: collapse; }
  .entete > tbody > tr > td { vertical-align: top; padding: 8px 10px; border-bottom: 1.5px solid #1f4d36; }
  .pane-g { width: 52%; border-right: 1.5px solid #1f4d36; }
  .pane-d { width: 48%; }
  .etat { font-weight: 700; font-size: 11.5px; color: #1f4d36; text-transform: uppercase; letter-spacing: .02em; }
  .devise { font-style: italic; font-size: 10.5px; margin-top: 1px; }
  .sep { border: 0; border-top: 1px solid #cfe0d4; margin: 6px 0; }
  .min { font-weight: 600; }
  .centre { font-weight: 700; color: #1f4d36; text-transform: uppercase; margin-top: 2px; }
  .coord { font-size: 9.5px; color: #555; margin-top: 3px; }
  .blason { margin: 4px 0; }
  .blason img { height: 44px; width: auto; object-fit: contain; }
  .logo { margin-top: 6px; }
  .logo img { height: 42px; width: auto; object-fit: contain; }

  .annee { font-size: 10.5px; }
  .titre-doc { text-align: center; border: 1.5px solid #1f4d36; padding: 5px; margin: 5px 0 3px; }
  .titre-doc .t1 { font-weight: 800; font-size: 14px; color: #1f4d36; letter-spacing: .06em; }
  .titre-doc .t2 { font-weight: 700; font-size: 11px; margin-top: 2px; }
  table.ident { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.ident td { padding: 2px 4px; font-size: 10.5px; }
  table.ident td.k { color: #555; font-weight: 600; white-space: nowrap; width: 42%; }
  table.ident td.v { font-weight: 700; color: #16241b; border-bottom: 1px dotted #b9cdbf; }

  /* Tableau des modules. */
  table.modules { width: 100%; border-collapse: collapse; }
  table.modules th, table.modules td { border: 1px solid #b9cdbf; padding: 4px 6px; }
  table.modules thead th { background: #1f4d36; color: #fff; font-size: 9.5px; text-transform: uppercase; letter-spacing: .02em; text-align: center; }
  table.modules th.l { text-align: left; }
  table.modules td.mod { text-align: left; font-weight: 600; }
  table.modules td.c { text-align: center; }
  table.modules td.fort { font-weight: 700; color: #1f4d36; }
  table.modules td.app { font-size: 10px; }
  table.modules td.emarg { }
  table.modules tfoot td { border: 1px solid #b9cdbf; padding: 5px 6px; font-weight: 700; background: #eef4ef; }

  /* Grilles de synthèse. */
  table.grille { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.grille td { border: 1px solid #b9cdbf; padding: 5px 7px; vertical-align: top; }
  table.grille td .lab { font-size: 8.8px; text-transform: uppercase; letter-spacing: .03em; color: #1f4d36; font-weight: 700; }
  table.grille td .val { font-size: 12px; font-weight: 700; margin-top: 2px; }
  table.grille td .val.sm { font-size: 10.5px; font-weight: 600; }
  table.grille td .note { font-size: 9px; color: #666; margin-top: 2px; }
  .abs { font-size: 10.5px; }
  .abs span { display: inline-block; margin-right: 12px; }

  .case { display: inline-block; width: 10px; height: 10px; border: 1.3px solid #1f4d36; vertical-align: -1px; margin-right: 6px; }
  .case.on { background: #1f4d36; }
  .choix { display: block; margin: 2px 0; font-size: 10.5px; }

  .visa { min-height: 46px; }
  .visa .nom { margin-top: 20px; font-weight: 700; }
  footer { display: flex; justify-content: space-between; font-size: 9.5px; color: #666; padding: 6px 10px; }
</style></head><body>
  <div class="doc">
    <table class="entete"><tbody><tr>
      <td class="pane-g">
        <div class="etat">${eh(intituleEtat)}</div>
        ${armoiries ? `<div class="blason"><img src="${armoiries}" alt="Armoiries — ${eh(b.pays)}"></div>` : ""}
        ${devise ? `<div class="devise">${eh(devise)}</div>` : ""}
        <hr class="sep">
        <div class="min">${eh(ministere)}</div>
        ${b.drena ? `<div>DRENA ${eh(b.drena)}</div>` : ""}
        <div class="centre">${eh(b.cafop)}</div>
        ${b.logoUrl ? `<div class="logo"><img src="${eh(b.logoUrl)}" alt="Logo ${eh(b.cafop)}"></div>` : ""}
        ${coord ? `<div class="coord">${coord}</div>` : ""}
      </td>
      <td class="pane-d">
        <div class="annee"><b>ANNÉE SCOLAIRE :</b> ${eh(b.annee)}</div>
        <div class="titre-doc">
          <div class="t1">BULLETIN DE NOTES</div>
          <div class="t2">${eh(ordinalSemestre(b.semestre))}</div>
        </div>
        <table class="ident"><tbody>
          ${infoLigne("NOM", eh(nomAffiche).toUpperCase())}
          ${infoLigne("PRÉNOMS", eh(b.prenoms ?? ""))}
          ${infoLigne("MATRICULE", eh(b.matricule ?? ""))}
          ${infoLigne("DATE DE NAISSANCE", eh(b.dateNaissance ?? ""))}
          ${infoLigne("GROUPE-CLASSE", eh(b.groupe ?? ""))}
          ${infoLigne("EFFECTIF", String(b.effectif))}
          ${infoLigne("PROMOTION", eh(b.promotion))}
          ${infoLigne("PROF. PRINCIPAL", eh(b.profPrincipal ?? ""))}
        </tbody></table>
      </td>
    </tr></tbody></table>

    <div style="padding: 6px 10px 10px;">
      <table class="modules">
        <thead><tr>
          <th class="l">MODULES</th><th>MOY/20</th><th>COEF</th><th>RANG</th><th>APPRÉCIATION</th><th>NOM ET ÉMARGEMENT DES PROFESSEURS</th>
        </tr></thead>
        <tbody>${corps}</tbody>
        <tfoot><tr>
          <td>TOTAUX</td>
          <td class="c">—</td>
          <td class="c" style="text-align:center">${totalCoef}</td>
          <td colspan="3">Total des points : <b>${fmt(totalPondere)}</b></td>
        </tr></tfoot>
      </table>

      <table class="grille"><tbody><tr>
        <td style="width:26%">
          <div class="lab">Conduite</div>
          <div class="val sm">${b.conduite ? eh(b.conduite) : "&nbsp;"}</div>
        </td>
        <td style="width:18%">
          <div class="lab">Note de stage</div>
          <div class="val">${fmt(b.noteStage)}</div>
        </td>
        <td style="width:18%">
          <div class="lab">Total général</div>
          <div class="val">${fmt(totalPondere)}</div>
        </td>
        <td style="width:19%">
          <div class="lab">Moyenne</div>
          <div class="val">${fmt(b.moyenneGenerale)}<span style="font-size:9px;font-weight:600">/20</span></div>
        </td>
        <td style="width:19%">
          <div class="lab">Rang</div>
          <div class="val">${rangFr(b.rang)} / ${b.effectif}</div>
        </td>
      </tr></tbody></table>

      <table class="grille"><tbody><tr>
        <td style="width:33%">
          <div class="lab">Absences</div>
          <div class="abs val sm">
            <span>Justifiées : <b>${b.absencesJustifiees != null ? b.absencesJustifiees : "—"}</b></span>
            <span>Non justifiées : <b>${b.absencesNonJustifiees != null ? b.absencesNonJustifiees : "—"}</b></span>
          </div>
        </td>
        <td style="width:17%">
          <div class="lab">Moyenne annuelle</div>
          <div class="val">${fmt(b.moyenneAnnuelle)}</div>
        </td>
        <td style="width:17%">
          <div class="lab">Rang annuel</div>
          <div class="val">${rangFr(b.rangAnnuel)}</div>
        </td>
        <td style="width:33%">
          <div class="lab">Appréciation du professeur principal</div>
          <div class="val sm">${eh(appreciationCafop(b.moyenneGenerale))}</div>
        </td>
      </tr></tbody></table>

      <table class="grille"><tbody><tr>
        <td style="width:50%">
          <div class="lab">Distinctions</div>
          <span class="choix">${caseCoche(dist.honneur)}Tableau d'honneur</span>
          <span class="choix">${caseCoche(dist.encouragements)}Encouragements</span>
          <span class="choix">${caseCoche(dist.felicitations)}Félicitations</span>
        </td>
        <td style="width:50%">
          <div class="lab">Décision du conseil de classe</div>
          <div class="val sm">Se référer à la décision de la DECO</div>
        </td>
      </tr><tr>
        <td>
          <div class="lab">Sanctions</div>
          <span class="choix">${caseCoche(false)}Avertissement</span>
          <span class="choix">${caseCoche(false)}Blâme</span>
        </td>
        <td class="visa">
          <div class="lab">${eh(T("Le Directeur du CAFOP"))}</div>
          <div class="nom">${eh(b.directeur ?? "")}</div>
        </td>
      </tr></tbody></table>
    </div>

    <footer><span>Édité le ${eh(b.date)}</span><span>Bulletin auto-renseigné — EduWeb Planner</span></footer>
  </div>
  ${scriptImpression}
</body></html>`;
}
