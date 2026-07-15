import { getUtilisateurCourant } from "@/lib/auth/session";
import { FILTRE_CATHOLIQUE } from "@/lib/rbac/scope";
import { dateFrLongue, echapperHtml as esc, lignesReseau, moyenneGenerale, statsParEtablissement, tauxPresence } from "@/lib/reseau-catholique/agregats";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugFichier(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/**
 * Rapport du SENEC au format WORD (HTML servi en application/msword, ajustable) :
 * généré automatiquement depuis L'ENSEMBLE DES SEDEC (un diocèse par ligne, chaque
 * ligne agrégeant les données de tous ses établissements — élèves, enseignants,
 * classes, assiduité, moyennes). Réservé au SENEC (et à l'admin système).
 */
export async function GET(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u) return new Response("Session expirée.", { status: 401 });
  if (u.roleActif !== "senec" && u.roleReel !== "admin") {
    return new Response("Téléchargement réservé au SENEC (ou à l'administrateur).", { status: 403 });
  }
  const pays = u.roleActif === "senec" ? u.portee.pays : new URL(req.url).searchParams.get("pays") ?? "Côte d'Ivoire";
  if (!pays) return new Response("Aucun pays rattaché à votre compte.", { status: 400 });

  const where: Prisma.EtablissementWhereInput = { pays: { equals: pays, mode: "insensitive" }, ...FILTRE_CATHOLIQUE };
  const [lignes, presence, notes, statsEtabs] = await Promise.all([
    lignesReseau(where),
    tauxPresence(where),
    moyenneGenerale(where),
    statsParEtablissement(where),
  ]);

  // Agrégation PAR DIOCÈSE (SEDEC) à partir des données de chaque établissement.
  interface Sedec { etabs: number; eleves: number; enseignants: number; classes: number; pointages: number; presents: number; sommeSur20: number; nbNotes: number }
  const parSedec = new Map<string, Sedec>();
  for (const l of lignes) {
    const d = l.diocese ?? "(sans diocèse)";
    const s = parSedec.get(d) ?? { etabs: 0, eleves: 0, enseignants: 0, classes: 0, pointages: 0, presents: 0, sommeSur20: 0, nbNotes: 0 };
    const st = statsEtabs.get(l.id);
    s.etabs++; s.eleves += l.eleves; s.enseignants += l.enseignants; s.classes += l.classes;
    if (st) { s.pointages += st.pointages; s.presents += st.presents; s.sommeSur20 += st.sommeSur20; s.nbNotes += st.nbNotes; }
    parSedec.set(d, s);
  }
  const sedecs = [...parSedec.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  const totaux = lignes.reduce(
    (t, l) => ({ etabs: t.etabs + 1, eleves: t.eleves + l.eleves, enseignants: t.enseignants + l.enseignants, classes: t.classes + l.classes }),
    { etabs: 0, eleves: 0, enseignants: 0, classes: 0 },
  );

  const synthese: [string, string][] = [
    ["Pays", pays],
    ["Diocèses (SEDEC) actifs", String(sedecs.length)],
    ["Établissements du réseau", String(totaux.etabs)],
    ["Élèves (comptes)", totaux.eleves.toLocaleString("fr-FR")],
    ["Enseignants", totaux.enseignants.toLocaleString("fr-FR")],
    ["Classes", String(totaux.classes)],
    ["Taux de présence national", presence.taux != null ? `${presence.taux} %` : "—"],
    ["Moyenne générale nationale", notes.moyenne != null ? `${notes.moyenne} / 20` : "—"],
  ];

  const lignesSedecs = sedecs.length
    ? sedecs.map(([d, s], i) => {
        const taux = s.pointages > 0 ? `${Math.round((s.presents / s.pointages) * 1000) / 10} %` : "—";
        const moy = s.nbNotes > 0 ? (Math.round((s.sommeSur20 / s.nbNotes) * 100) / 100).toLocaleString("fr-FR") : "—";
        return `<tr><td>${i + 1}</td><td>${esc(d)}</td><td style="text-align:right">${s.etabs}</td><td style="text-align:right">${s.eleves}</td><td style="text-align:right">${s.enseignants}</td><td style="text-align:right">${s.classes}</td><td style="text-align:right">${taux}</td><td style="text-align:right">${moy}</td></tr>`;
      }).join("")
    : `<tr><td colspan="8" style="color:#777;font-style:italic">Aucun établissement catholique dans le périmètre</td></tr>`;

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Rapport du SENEC</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a">
    <div style="text-align:center;border-bottom:2px solid #14532d;padding-bottom:8pt;margin-bottom:12pt">
      <div style="font-size:11pt;color:#555">Enseignement Catholique — ${esc(pays)}</div>
      <div style="font-size:16pt;font-weight:bold;color:#14532d">Rapport du SENEC (Secrétariat National de l'Enseignement Catholique)</div>
      <div style="font-size:11pt;color:#555">Édité le ${dateFrLongue()} — généré depuis les données de l'ensemble des SEDEC</div>
    </div>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">1. Synthèse nationale</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:10.5pt">
      ${synthese.map(([l, v]) => `<tr><td style="background:#eaf3ec;width:38%;font-weight:bold">${esc(l)}</td><td>${esc(v)}</td></tr>`).join("")}
    </table>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">2. Situation par SEDEC (diocèse)</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:10pt">
      <thead><tr style="background:#eaf3ec"><th>#</th><th>SEDEC (diocèse)</th><th>Étab.</th><th>Élèves</th><th>Enseignants</th><th>Classes</th><th>Présence</th><th>Moyenne /20</th></tr></thead>
      <tbody>${lignesSedecs}</tbody>
    </table>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">3. Observations du SENEC</h2>
    <p style="font-size:10.5pt;color:#444">(Section à compléter : orientations nationales, appréciations par diocèse, recommandations…)</p>
    <br/><br/>
    <table style="width:100%;font-size:10.5pt"><tr>
      <td style="text-align:center">Fait à ………………………, le ${dateFrLongue()}</td>
      <td style="text-align:center">Signature et cachet<br/><br/><br/>____________________</td>
    </tr></table>
  </body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-senec-${slugFichier(pays)}.doc"`,
    },
  });
}
