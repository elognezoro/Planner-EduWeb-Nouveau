// Construction du document HTML d'un bulletin individuel d'élève-maître (CAFOP), imprimable via
// le navigateur (« Enregistrer au format PDF »). Fonction pure, sans dépendance au DOM.

export interface LigneBulletin {
  module: string;
  coef: number;
  moyenne: number | null; // /20
}

export interface BulletinCafop {
  cafop: string;
  drena?: string | null;
  pays: string;
  eleve: string;
  matricule?: string | null;
  promotion: string;
  groupe?: string | null;
  semestre: number;
  annee: string;
  lignes: LigneBulletin[];
  moyenneGenerale: number | null;
  rang: number;
  effectif: number;
  date: string;
}

const eh = (v: string): string => (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (v: number | null): string => (v === null ? "—" : v.toFixed(2).replace(".", ","));

/** Appréciation automatique d'après la moyenne générale (/20). */
export function appreciationCafop(moy: number | null): string {
  if (moy === null) return "Non évalué";
  if (moy >= 16) return "Très bien — félicitations du conseil";
  if (moy >= 14) return "Bien — travail satisfaisant";
  if (moy >= 12) return "Assez bien — encouragements";
  if (moy >= 10) return "Passable — peut mieux faire";
  return "Insuffisant — doit se ressaisir";
}

export function construireHtmlBulletinCafop(b: BulletinCafop, opts: { autoImpression?: boolean } = {}): string {
  const sousTitre = [b.drena && `DRENA ${b.drena}`, b.pays].filter(Boolean).join(" — ");
  const corps = b.lignes
    .map(
      (l) =>
        `<tr><td>${eh(l.module)}</td><td class="c">${l.coef}</td><td class="c">${fmt(l.moyenne)}</td><td class="c">${
          l.moyenne === null ? "—" : fmt(l.moyenne * l.coef)
        }</td></tr>`,
    )
    .join("");
  const totalCoef = b.lignes.reduce((s, l) => s + l.coef, 0);
  const totalPondere = b.lignes.reduce((s, l) => s + (l.moyenne === null ? 0 : l.moyenne * l.coef), 0);
  const scriptImpression = opts.autoImpression
    ? `<script>(function(){function p(){window.focus();window.print();}if(document.readyState==="complete"){p();}else{window.addEventListener("load",p);}})();<\/script>`
    : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bulletin — ${eh(b.eleve)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a2a1e; margin: 0; }
  header { text-align: center; border-bottom: 2px solid #2f6f4e; padding-bottom: 10px; margin-bottom: 14px; }
  header h1 { font-size: 17px; margin: 0; color: #1f4d36; }
  header .sous { font-size: 11px; color: #555; margin-top: 2px; }
  header .titre { font-size: 13px; font-weight: bold; margin-top: 8px; color: #8a611c; text-transform: uppercase; letter-spacing: .04em; }
  .info { display: flex; flex-wrap: wrap; gap: 4px 24px; font-size: 12px; margin-bottom: 12px; }
  .info b { color: #1f4d36; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cfe0d4; padding: 6px 9px; text-align: left; }
  th { background: #eef4ef; color: #1f4d36; }
  td.c, th.c { text-align: center; }
  tfoot td { font-weight: bold; background: #f7faf8; }
  .bilan { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin-top: 14px; font-size: 13px; }
  .bilan .box { border: 1px solid #cfe0d4; border-radius: 8px; padding: 8px 14px; }
  .bilan .box b { display: block; font-size: 18px; color: #1f4d36; }
  .appr { margin-top: 12px; font-size: 12px; }
  .appr b { color: #1f4d36; }
  footer { margin-top: 22px; display: flex; justify-content: space-between; font-size: 11px; color: #666; }
</style></head><body>
  <header>
    <h1>${eh(b.cafop)}</h1>
    ${sousTitre ? `<div class="sous">${eh(sousTitre)}</div>` : ""}
    <div class="titre">Bulletin de notes — Semestre ${b.semestre} · ${eh(b.annee)}</div>
  </header>
  <div class="info">
    <span><b>Élève-maître :</b> ${eh(b.eleve)}</span>
    ${b.matricule ? `<span><b>Matricule :</b> ${eh(b.matricule)}</span>` : ""}
    <span><b>Promotion :</b> ${eh(b.promotion)}</span>
    ${b.groupe ? `<span><b>Groupe-classe :</b> ${eh(b.groupe)}</span>` : ""}
  </div>
  <table>
    <thead><tr><th>Module</th><th class="c">Coef.</th><th class="c">Moyenne /20</th><th class="c">Note × coef</th></tr></thead>
    <tbody>${corps}</tbody>
    <tfoot><tr><td>Total (moy. gén. = ${fmt(totalPondere)} / ${totalCoef} = ${fmt(b.moyenneGenerale)})</td><td class="c">${totalCoef}</td><td class="c">—</td><td class="c">${fmt(totalPondere)}</td></tr></tfoot>
  </table>
  <div class="bilan">
    <div class="box">Moyenne générale <b>${fmt(b.moyenneGenerale)}/20</b></div>
    <div class="box">Rang <b>${b.rang}<sup>e</sup> / ${b.effectif}</b></div>
    <div class="box">Décision <b style="font-size:13px">${eh(appreciationCafop(b.moyenneGenerale))}</b></div>
  </div>
  <div class="appr"><b>Appréciation du conseil :</b> ${eh(appreciationCafop(b.moyenneGenerale))}.</div>
  <footer><span>Édité le ${eh(b.date)}</span><span>Le Directeur du CAFOP</span></footer>
  ${scriptImpression}
</body></html>`;
}
