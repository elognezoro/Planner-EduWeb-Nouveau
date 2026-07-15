import { getUtilisateurCourant } from "@/lib/auth/session";
import { FILTRE_CATHOLIQUE } from "@/lib/rbac/scope";
import { diocesesDuPays } from "@/lib/referentiels/dioceses";
import { dateFrLongue, echapperHtml as esc, lignesReseau, moyenneGenerale, tauxPresence } from "@/lib/reseau-catholique/agregats";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugFichier(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/**
 * Rapport de SEDEC (diocèse) au format WORD (HTML servi en application/msword,
 * ouvrable et AJUSTABLE dans Word) — réservé au SENEC (rapports de tous les
 * diocèses de son pays) et à l'admin système. Le SEDEC, lui, télécharge les
 * rapports d'ÉTABLISSEMENT depuis la fiche de chaque établissement.
 */
export async function GET(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u) return new Response("Session expirée.", { status: 401 });
  if (u.roleActif !== "senec" && u.roleReel !== "admin") {
    return new Response("Téléchargement réservé au SENEC (ou à l'administrateur).", { status: 403 });
  }
  const pays = u.roleActif === "senec" ? u.portee.pays : new URL(req.url).searchParams.get("pays") ?? "Côte d'Ivoire";
  if (!pays) return new Response("Aucun pays rattaché à votre compte.", { status: 400 });

  const diocese = (new URL(req.url).searchParams.get("diocese") ?? "").trim();
  if (!diocese) return new Response("Précisez le diocèse (?diocese=…).", { status: 400 });
  const connus = diocesesDuPays(pays);
  if (connus.length > 0 && !connus.includes(diocese)) {
    return new Response("Diocèse inconnu du référentiel de votre pays.", { status: 404 });
  }

  const where: Prisma.EtablissementWhereInput = {
    pays: { equals: pays, mode: "insensitive" },
    diocese,
    ...FILTRE_CATHOLIQUE,
  };
  const [lignes, presence, notes] = await Promise.all([lignesReseau(where), tauxPresence(where), moyenneGenerale(where)]);

  const totaux = lignes.reduce(
    (t, l) => ({ eleves: t.eleves + l.eleves, enseignants: t.enseignants + l.enseignants, classes: t.classes + l.classes }),
    { eleves: 0, enseignants: 0, classes: 0 },
  );
  const synthese: [string, string][] = [
    ["Diocèse", diocese],
    ["Pays", pays],
    ["Établissements du réseau", String(lignes.length)],
    ["Élèves (comptes)", totaux.eleves.toLocaleString("fr-FR")],
    ["Enseignants", totaux.enseignants.toLocaleString("fr-FR")],
    ["Classes", String(totaux.classes)],
    ["Taux de présence", presence.taux != null ? `${presence.taux} %` : "—"],
    ["Moyenne générale", notes.moyenne != null ? `${notes.moyenne} / 20` : "—"],
  ];

  const lignesEtabs = lignes.length
    ? lignes.map((l, i) =>
        `<tr><td>${i + 1}</td><td>${esc(l.nom)}</td><td>${esc(l.ville ?? "—")}</td><td style="text-align:right">${l.eleves}</td><td style="text-align:right">${l.enseignants}</td><td style="text-align:right">${l.classes}</td></tr>`,
      ).join("")
    : `<tr><td colspan="6" style="color:#777;font-style:italic">Aucun établissement rattaché à ce diocèse</td></tr>`;

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Rapport de SEDEC</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a">
    <div style="text-align:center;border-bottom:2px solid #14532d;padding-bottom:8pt;margin-bottom:12pt">
      <div style="font-size:11pt;color:#555">Enseignement Catholique — Secrétariat National (SENEC)</div>
      <div style="font-size:16pt;font-weight:bold;color:#14532d">Rapport de SEDEC — ${esc(diocese)}</div>
      <div style="font-size:11pt;color:#555">Édité le ${dateFrLongue()}</div>
    </div>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">1. Synthèse du diocèse</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:10.5pt">
      ${synthese.map(([l, v]) => `<tr><td style="background:#eaf3ec;width:38%;font-weight:bold">${esc(l)}</td><td>${esc(v)}</td></tr>`).join("")}
    </table>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">2. Établissements du diocèse</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:10pt">
      <thead><tr style="background:#eaf3ec"><th>#</th><th>Établissement</th><th>Localité</th><th>Élèves</th><th>Enseignants</th><th>Classes</th></tr></thead>
      <tbody>${lignesEtabs}</tbody>
    </table>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">3. Observations du SENEC</h2>
    <p style="font-size:10.5pt;color:#444">(Section à compléter : appréciations, recommandations au SEDEC, besoins identifiés…)</p>
    <br/><br/>
    <table style="width:100%;font-size:10.5pt"><tr>
      <td style="text-align:center">Fait à ………………………, le ${dateFrLongue()}</td>
      <td style="text-align:center">Signature et cachet<br/><br/><br/>____________________</td>
    </tr></table>
  </body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-sedec-${slugFichier(diocese)}.doc"`,
    },
  });
}
