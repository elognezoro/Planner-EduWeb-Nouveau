import { getUtilisateurCourant } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreEtablissements } from "@/lib/rbac";
import { agregatsEtablissement, dateFrLongue, echapperHtml as esc, statsParClasse } from "@/lib/reseau-catholique/agregats";
import { LIBELLE_TYPE } from "@/lib/referentiels/etablissement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugFichier(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/**
 * Rapport d'établissement au format WORD (HTML servi en application/msword,
 * ouvrable et AJUSTABLE dans Word) — réservé au SEDEC du diocèse (et à l'admin
 * système). Le SENEC télécharge les rapports de SEDEC, pas ceux d'établissement.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getUtilisateurCourant();
  if (!u) return new Response("Session expirée.", { status: 401 });
  if (u.roleActif !== "sedec" && u.roleReel !== "admin") {
    return new Response("Téléchargement réservé au SEDEC du diocèse (ou à l'administrateur).", { status: 403 });
  }

  // Cloisonnement : pour le SEDEC, l'établissement doit être catholique ET de son diocèse.
  const where = u.roleActif === "sedec" ? { id, AND: [filtreEtablissements(u.portee)] } : { id };
  const e = await prisma.etablissement.findFirst({
    where,
    include: { region: { select: { nom: true } } },
  });
  if (!e) return new Response("Établissement hors de votre périmètre.", { status: 404 });

  const [a, classes, niveaux, personnel, competences] = await Promise.all([
    agregatsEtablissement(e.id),
    statsParClasse(e.id),
    prisma.niveauEtablissement.findMany({
      where: { etablissementId: e.id },
      include: { niveau: { select: { nom: true, ordre: true } } },
    }),
    prisma.utilisateur.findMany({
      where: {
        etablissementId: e.id,
        roleActif: { nomTechnique: { in: ["chef_etablissement", "adjoint_chef_etablissement", "educateur", "enseignant"] } },
      },
      select: { id: true, nom: true, prenoms: true, email: true, roleActif: { select: { libelle: true, nomTechnique: true } } },
    }),
    prisma.competenceEnseignant.findMany({
      where: { etablissementId: e.id },
      include: { discipline: { select: { nom: true } } },
    }),
  ]);
  niveaux.sort((x, y) => x.niveau.ordre - y.niveau.ordre);
  const specialites = new Map<string, string[]>();
  for (const c of competences) specialites.set(c.enseignantId, [...(specialites.get(c.enseignantId) ?? []), c.discipline.nom]);
  const nomDe = (p: { prenoms: string | null; nom: string | null; email: string }) =>
    [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || p.email;
  personnel.sort((x, y) => nomDe(x).localeCompare(nomDe(y), "fr"));

  const chef = [e.prenomsChef, e.nomChef].filter(Boolean).join(" ").trim();
  const identite: [string, string][] = [
    ["Type", LIBELLE_TYPE[e.type] ?? e.type],
    ["Code", e.code ?? "—"],
    ["Diocèse", e.diocese ?? "—"],
    ["Pays", e.pays ?? "—"],
    ["Région (DRENAET)", e.region?.nom ?? "—"],
    ["Localité", e.ville ?? "—"],
    [e.fonctionChef || "Chef d'établissement", chef || "—"],
    ["Année scolaire", e.anneeScolaire ?? "—"],
  ];
  const chiffres: [string, string][] = [
    ["Élèves (comptes)", String(a.eleves)],
    ["Enseignants", String(a.enseignants)],
    ["Classes", String(a.classes)],
    ["Salles", String(a.salles || e.nbSallesDisponibles)],
    ["Appels saisis", String(a.appels)],
    ["Taux de présence", a.tauxPresence != null ? `${a.tauxPresence} %` : "—"],
    ["Notes saisies", String(a.nbNotes)],
    ["Moyenne générale", a.moyenneGenerale != null ? `${a.moyenneGenerale} / 20` : "—"],
  ];

  const tableau = (lignes: [string, string][]) =>
    `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:10.5pt">
      ${lignes.map(([l, v]) => `<tr><td style="background:#eaf3ec;width:38%;font-weight:bold">${esc(l)}</td><td>${esc(v)}</td></tr>`).join("")}
    </table>`;

  const lignesNiveaux = niveaux.length
    ? niveaux.map((n) => `<tr><td>${esc(n.niveau.nom)}</td><td style="text-align:right">${n.effectif}</td><td style="text-align:right">${n.nbClasses}</td><td>${n.vacation === "double" ? "Double" : "Simple"}</td></tr>`).join("")
    : `<tr><td colspan="4" style="color:#777;font-style:italic">Aucun niveau configuré</td></tr>`;

  const lignesPersonnel = personnel.length
    ? personnel.map((p, i) => {
        const spec = p.roleActif.nomTechnique === "enseignant" ? (specialites.get(p.id) ?? []).join(", ") : "";
        return `<tr><td>${i + 1}</td><td>${esc(nomDe(p))}</td><td>${esc(p.roleActif.libelle)}</td><td>${esc(spec || "—")}</td><td>${esc(p.email)}</td></tr>`;
      }).join("")
    : `<tr><td colspan="5" style="color:#777;font-style:italic">Aucun compte rattaché</td></tr>`;

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Rapport d'établissement</title></head>
  <body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a">
    <div style="text-align:center;border-bottom:2px solid #14532d;padding-bottom:8pt;margin-bottom:12pt">
      <div style="font-size:11pt;color:#555">Enseignement Catholique — Réseau SEDEC${e.diocese ? ` · ${esc(e.diocese)}` : ""}</div>
      <div style="font-size:16pt;font-weight:bold;color:#14532d">${esc(e.nom)}</div>
      <div style="font-size:11pt;color:#555">Rapport d'établissement — édité le ${dateFrLongue()}</div>
    </div>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">1. Identité</h2>
    ${tableau(identite)}
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">2. Chiffres clés</h2>
    ${tableau(chiffres)}
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">3. Niveaux ouverts</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:10.5pt">
      <thead><tr style="background:#eaf3ec"><th>Niveau</th><th>Effectif</th><th>Classes</th><th>Vacation</th></tr></thead>
      <tbody>${lignesNiveaux}</tbody>
    </table>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">4. Résultats par classe</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:10pt">
      <thead><tr style="background:#eaf3ec"><th>Classe</th><th>Niveau</th><th>Élèves inscrits</th><th>Taux de présence</th><th>Abs. non justifiées</th><th>Moyenne /20</th><th>Notes saisies</th></tr></thead>
      <tbody>${
        classes.length
          ? classes.map((c) =>
              `<tr><td>${esc(c.nom)}</td><td>${esc(c.niveau)}</td><td style="text-align:right">${c.eleves}</td><td style="text-align:right">${c.tauxPresence != null ? `${c.tauxPresence} %` : "—"}</td><td style="text-align:right">${c.absentsNJ}</td><td style="text-align:right">${c.moyenne != null ? c.moyenne.toLocaleString("fr-FR") : "—"}</td><td style="text-align:right">${c.nbNotes}</td></tr>`,
            ).join("")
          : `<tr><td colspan="7" style="color:#777;font-style:italic">Aucune classe</td></tr>`
      }</tbody>
    </table>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">5. Personnel</h2>
    <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:10pt">
      <thead><tr style="background:#eaf3ec"><th>#</th><th>Nom et prénoms</th><th>Rôle</th><th>Spécialités</th><th>E-mail</th></tr></thead>
      <tbody>${lignesPersonnel}</tbody>
    </table>
    <h2 style="color:#14532d;font-size:13pt;margin:14pt 0 4pt">6. Observations</h2>
    <p style="font-size:10.5pt;color:#444">(Section à compléter par le SEDEC : appréciations, recommandations, besoins identifiés…)</p>
    <br/><br/>
    <table style="width:100%;font-size:10.5pt"><tr>
      <td style="text-align:center">Fait à ………………………, le ${dateFrLongue()}</td>
      <td style="text-align:center">Signature et cachet<br/><br/><br/>____________________</td>
    </tr></table>
  </body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-${slugFichier(e.nom)}.doc"`,
    },
  });
}
