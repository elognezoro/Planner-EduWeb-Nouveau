import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { peutAdministrerEtablissement } from "@/lib/rbac/scope";
import { prisma } from "@/lib/prisma";
import { creneauxHoraires, bandesPause } from "@/lib/emploi-du-temps/horaires";
import { tableauEdtCellules, type CelluleEdt } from "@/lib/emploi-du-temps/email";
import { gabaritEdtDocument } from "@/lib/emploi-du-temps/document-edt";
import { construireZip, type EntreeZip } from "@/lib/zip";

export const dynamic = "force-dynamic";

/**
 * TÉLÉCHARGEMENT ZIP des emplois du temps générés d'un établissement, en deux catégories :
 *  - ?type=classes     → un fichier par CLASSE pédagogique (dossier « classes/ ») ;
 *  - ?type=enseignants → un fichier par ENSEIGNANT, rangé par SPÉCIALITÉ (dossier
 *    « enseignants/<discipline dominante de son service>/ »).
 * Chaque fichier est un HTML autonome imprimable (A4 paysage). Mêmes gardes que la page
 * Emploi du temps : rôles habilités + périmètre (peutAdministrerEtablissement).
 */

/** Nom de fichier sobre : accents retirés, tout le reste en tirets — les extracteurs Windows
 *  les plus anciens restent à l'aise, et les chemins sont prévisibles. */
function slug(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "sans-nom"
  );
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = await requireRole([
    "admin",
    "superviseur_international",
    "representant_pays",
    "super_admin_etablissements",
    "etablissements_admin",
    "chef_etablissement",
    "adjoint_chef_etablissement",
  ]);
  const etab = await prisma.etablissement.findUnique({ where: { id } });
  if (!etab) return new Response("Établissement introuvable.", { status: 404 });
  if (!peutAdministrerEtablissement(u.portee, id, etab.pays)) {
    return new Response("Accès refusé.", { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") === "enseignants" ? "enseignants" : "classes";
  const creneaux = await prisma.creneau.findMany({
    where: { etablissementId: id },
    orderBy: [{ jour: "asc" }, { periode: "asc" }],
  });
  if (creneaux.length === 0) {
    return new Response("Aucun emploi du temps généré pour cet établissement.", { status: 404 });
  }

  const horaires = creneauxHoraires(etab);
  const bandes = bandesPause(etab);
  const entrees: EntreeZip[] = [];
  // Deux homonymes (classes ou enseignants) ne doivent pas s'écraser dans l'archive.
  const cheminsPris = new Set<string>();
  const cheminUnique = (base: string): string => {
    let chemin = base;
    let i = 2;
    while (cheminsPris.has(chemin)) chemin = `${base}-${i++}`;
    cheminsPris.add(chemin);
    return chemin;
  };

  if (type === "classes") {
    const parClasse = new Map<string, typeof creneaux>();
    for (const c of creneaux) {
      const liste = parClasse.get(c.classeId);
      if (liste) liste.push(c);
      else parClasse.set(c.classeId, [c]);
    }
    for (const liste of parClasse.values()) {
      const nom = liste[0].classeNom;
      const cellules: CelluleEdt[] = liste.map((c) => ({
        jour: c.jour, periode: c.periode, duree: c.duree,
        l1: c.disciplineNom, l2: c.enseignantNom, l3: c.salleNom,
      }));
      const html = gabaritEdtDocument({
        titre: `Emploi du temps — ${nom}`,
        sousTitre: null,
        etablissementNom: etab.nom,
        anneeScolaire: etab.anneeScolaire ?? null,
        tableau: tableauEdtCellules(cellules, horaires, bandes),
      });
      entrees.push({ chemin: `${cheminUnique(`classes/${slug(nom)}`)}.html`, contenu: html });
    }
  } else {
    const parEnseignant = new Map<string, typeof creneaux>();
    for (const c of creneaux) {
      const liste = parEnseignant.get(c.enseignantId);
      if (liste) liste.push(c);
      else parEnseignant.set(c.enseignantId, [c]);
    }
    for (const liste of parEnseignant.values()) {
      const nom = liste[0].enseignantNom;
      // Spécialité = discipline DOMINANTE du service généré (pondérée par la durée des
      // créneaux ; départage alphabétique stable pour les bivalents à égalité).
      const poids = new Map<string, number>();
      for (const c of liste) poids.set(c.disciplineNom, (poids.get(c.disciplineNom) ?? 0) + c.duree);
      const specialite = [...poids.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))[0][0];
      const cellules: CelluleEdt[] = liste.map((c) => ({
        jour: c.jour, periode: c.periode, duree: c.duree,
        l1: c.classeNom, l2: c.disciplineNom, l3: c.salleNom,
      }));
      const html = gabaritEdtDocument({
        titre: `Emploi du temps — ${nom}`,
        sousTitre: `Spécialité : ${specialite}`,
        etablissementNom: etab.nom,
        anneeScolaire: etab.anneeScolaire ?? null,
        tableau: tableauEdtCellules(cellules, horaires, bandes),
      });
      entrees.push({ chemin: `${cheminUnique(`enseignants/${slug(specialite)}/${slug(nom)}`)}.html`, contenu: html });
    }
  }

  const zip = construireZip(entrees);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="edt-${type}-${slug(etab.nom)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
