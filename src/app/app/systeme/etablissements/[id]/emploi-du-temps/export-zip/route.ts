import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { peutAdministrerEtablissement } from "@/lib/rbac/scope";
import { prisma } from "@/lib/prisma";
import { creneauxHoraires, bandesPause, minutesParPeriode, periodesMatinApresMidi } from "@/lib/emploi-du-temps/horaires";
import type { CelluleEdt } from "@/lib/emploi-du-temps/email";
import { genererPdfEdt, type EnTetePdf } from "@/lib/emploi-du-temps/pdf-edt";
import { construireZip, type EntreeZip } from "@/lib/zip";
import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";

export const dynamic = "force-dynamic";

/**
 * TÉLÉCHARGEMENT ZIP des emplois du temps générés d'un établissement, en VERSIONS PDF
 * (mêmes informations que le PDF individuel de la page : en-tête officiel — ministère,
 * établissement, pays, armoiries, devise, année scolaire —, grille hebdomadaire,
 * volumes horaires par discipline, demi-journées libres). Deux catégories :
 *  - ?type=classes     → un PDF par CLASSE pédagogique (dossier « classes/ ») ;
 *  - ?type=enseignants → un PDF par ENSEIGNANT, rangé par SPÉCIALITÉ (dossier
 *    « enseignants/<discipline dominante de son service>/ »).
 * Mêmes gardes que la page Emploi du temps : rôles habilités + périmètre.
 */

/** Nom de fichier sobre : accents retirés, tout le reste en tirets. */
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

/** Télécharge les armoiries (emblème de l'établissement, sinon blason officiel du pays) —
 *  UNE fois par archive. Échec ou format inconnu : en-tête sans image, jamais bloquant. */
async function chargerArmoiries(url: string | null): Promise<EnTetePdf["armoiries"]> {
  if (!url) return null;
  try {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), 5_000);
    const reponse = await fetch(url, { signal: controleur.signal });
    clearTimeout(minuteur);
    if (!reponse.ok) return null;
    const octets = new Uint8Array(await reponse.arrayBuffer());
    if (octets.length >= 4 && octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47) {
      return { octets, type: "png" };
    }
    if (octets.length >= 2 && octets[0] === 0xff && octets[1] === 0xd8) {
      return { octets, type: "jpg" };
    }
    return null; // SVG/WebP… : non embarquable tel quel dans un PDF.
  } catch {
    return null;
  }
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

  // ── En-tête officiel : mêmes règles que le composant d'impression (EnTeteOfficielEdt). ──
  const pays = etab.pays ?? "";
  const infoPays = pays ? trouverPays(pays) : undefined;
  const entete: EnTetePdf = {
    ministere: etab.ministere || infoPays?.ministere || "",
    etablissementNom: etab.nom,
    paysIntitule: pays ? (infoPays?.intitule ?? `RÉPUBLIQUE DE ${pays}`).toUpperCase() : "",
    slogan: infoPays?.devise || etab.sloganBulletin || "",
    anneeScolaire: etab.anneeScolaire ?? null,
    armoiries: await chargerArmoiries(etab.emblemeUrl ?? (infoPays ? armoiriesUrl(infoPays.code) : null)),
  };

  const horaires = creneauxHoraires(etab);
  const bandes = bandesPause(etab);
  const nbPeriodes = Math.max(1, etab.creneauxParJour);
  const minutes = minutesParPeriode(etab);
  const demiJournees = periodesMatinApresMidi(etab);

  /** Minutes réelles d'un créneau : somme des périodes couvertes (repli 55 min / période). */
  const minutesCreneau = (periode: number, duree: number): number => {
    let total = 0;
    for (let p = periode; p < periode + duree; p++) total += minutes?.[p] ?? 55;
    return total;
  };

  /** Volumes hebdomadaires par libellé (discipline), triés par volume décroissant. */
  const volumesDe = (liste: typeof creneaux, cle: (c: (typeof creneaux)[number]) => string) => {
    const somme = new Map<string, number>();
    for (const c of liste) cle(c) && somme.set(cle(c), (somme.get(cle(c)) ?? 0) + minutesCreneau(c.periode, c.duree));
    return [...somme.entries()]
      .map(([libelle, mins]) => ({ libelle, minutes: mins }))
      .sort((a, b) => b.minutes - a.minutes || a.libelle.localeCompare(b.libelle, "fr"));
  };

  /** Demi-journées SANS cours (matin / après-midi par jour ; « journée » si les deux). */
  const demiJourneesLibres = (liste: typeof creneaux): string[] => {
    const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
    const couvertes = new Map<number, Set<number>>();
    for (const c of liste) {
      const s = couvertes.get(c.jour) ?? new Set<number>();
      for (let p = c.periode; p < c.periode + c.duree; p++) s.add(p);
      couvertes.set(c.jour, s);
    }
    const libres: string[] = [];
    for (let j = 0; j < JOURS.length; j++) {
      const s = couvertes.get(j) ?? new Set<number>();
      if (!demiJournees) {
        if (s.size === 0) libres.push(`${JOURS[j]} (journée)`);
        continue;
      }
      const matinLibre = demiJournees.matin.every((p) => !s.has(p));
      const apremLibre = demiJournees.apresMidi.every((p) => !s.has(p));
      if (matinLibre && apremLibre) libres.push(`${JOURS[j]} (journée)`);
      else if (matinLibre) libres.push(`${JOURS[j]} matin`);
      else if (apremLibre) libres.push(`${JOURS[j]} après-midi`);
    }
    return libres;
  };

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
      const pdf = await genererPdfEdt({
        entete,
        sousTitre: `Classe ${nom}`,
        cellules,
        horaires,
        bandes,
        nbPeriodes,
        volumes: volumesDe(liste, (c) => c.disciplineNom),
        demiJourneesLibres: demiJourneesLibres(liste),
      });
      entrees.push({ chemin: `${cheminUnique(`classes/${slug(nom)}`)}.pdf`, contenu: pdf });
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
      const pdf = await genererPdfEdt({
        entete,
        sousTitre: `${nom} — Spécialité : ${specialite}`,
        cellules,
        horaires,
        bandes,
        nbPeriodes,
        volumes: volumesDe(liste, (c) => c.disciplineNom),
        demiJourneesLibres: demiJourneesLibres(liste),
      });
      entrees.push({ chemin: `${cheminUnique(`enseignants/${slug(specialite)}/${slug(nom)}`)}.pdf`, contenu: pdf });
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
