"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const CHEMIN = "/app/systeme/cafop/plan-formation";

function estAdmin(u: UtilisateurCourant): boolean {
  return !u.apercuActif && u.roleReel === "admin";
}

async function gardeAdmin(): Promise<{ u: UtilisateurCourant } | { erreur: EtatForm }> {
  const u = await getUtilisateurCourant();
  if (!u) return { erreur: { ok: false, message: "Session expirée." } };
  if (!estAdmin(u)) return { erreur: { ok: false, message: "Action réservée à l'administrateur." } };
  return { u };
}

/** Nettoie et borne un tableau de chaînes (colonnes / cellules). */
function chaines(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 12).map((x) => String(x ?? "").slice(0, 4000));
}

// ── Plan (document) ──

/** Crée un plan vierge (avec 3 plans de niveau) pour le pays + année, ou renvoie l'existant. */
export async function creerPlanFormation(pays: string, anneeScolaire: string): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  const p = pays.trim();
  const an = anneeScolaire.trim();
  if (!p || !an) return { ok: false, message: "Pays et année scolaire obligatoires." };
  try {
    const existant = await prisma.planFormation.findUnique({ where: { pays_anneeScolaire: { pays: p, anneeScolaire: an } }, select: { id: true } });
    if (existant) return { ok: false, message: "Un plan existe déjà pour cette année." };
    await prisma.planFormation.create({
      data: {
        pays: p,
        anneeScolaire: an,
        sections: {
          create: [1, 2, 3].map((niveau, i) => ({
            ordre: i,
            niveau,
            titre: `Plan de formation ${niveau === 1 ? "1re" : `${niveau}e`} année`,
            colonnes: niveau === 3
              ? ["N°", "Activités d'encadrement", "Durée", "Période d'exécution"]
              : ["N°", "Modules", "Durée", "Nombre de semaine", "Période d'exécution"],
          })),
        },
      },
    });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] création :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Plan créé." };
}

export async function enregistrerPlanMeta(
  planId: string,
  data: { titre?: string; anneeScolaire?: string; intro?: string | null; signataire?: string | null; signataireFonction?: string | null; publie?: boolean },
): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    await prisma.planFormation.update({
      where: { id: planId },
      data: {
        ...(data.titre !== undefined ? { titre: data.titre.trim() || "Plan de formation" } : {}),
        ...(data.anneeScolaire !== undefined ? { anneeScolaire: data.anneeScolaire.trim() } : {}),
        ...(data.intro !== undefined ? { intro: (data.intro ?? "").trim() || null } : {}),
        ...(data.signataire !== undefined ? { signataire: (data.signataire ?? "").trim() || null } : {}),
        ...(data.signataireFonction !== undefined ? { signataireFonction: (data.signataireFonction ?? "").trim() || null } : {}),
        ...(data.publie !== undefined ? { publie: data.publie } : {}),
      },
    });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] méta :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Plan mis à jour." };
}

// ── Sections ──

export async function ajouterSection(
  planId: string,
  data: { niveau: number | null; titre: string; colonnes: string[]; intro?: string | null; note?: string | null },
): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  const titre = data.titre.trim();
  if (!titre) return { ok: false, message: "Le titre de la section est obligatoire." };
  const colonnes = chaines(data.colonnes).filter(Boolean);
  if (colonnes.length === 0) return { ok: false, message: "Au moins une colonne est requise." };
  try {
    const derniere = await prisma.sectionPlanFormation.findFirst({ where: { planId }, orderBy: { ordre: "desc" }, select: { ordre: true } });
    const ordre = (derniere?.ordre ?? -1) + 1;
    await prisma.sectionPlanFormation.create({
      data: {
        planId,
        ordre,
        niveau: data.niveau ?? null,
        titre,
        intro: (data.intro ?? "").trim() || null,
        note: (data.note ?? "").trim() || null,
        colonnes,
      },
    });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] ajout section :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Section ajoutée." };
}

export async function modifierSection(
  id: string,
  data: { niveau?: number | null; titre?: string; colonnes?: string[]; intro?: string | null; note?: string | null },
): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    await prisma.sectionPlanFormation.update({
      where: { id },
      data: {
        ...(data.niveau !== undefined ? { niveau: data.niveau } : {}),
        ...(data.titre !== undefined ? { titre: data.titre.trim() || "Section" } : {}),
        ...(data.colonnes !== undefined ? { colonnes: chaines(data.colonnes).filter(Boolean) } : {}),
        ...(data.intro !== undefined ? { intro: (data.intro ?? "").trim() || null } : {}),
        ...(data.note !== undefined ? { note: (data.note ?? "").trim() || null } : {}),
      },
    });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] modif section :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Section mise à jour." };
}

/** Ajoute une colonne à la fin du tableau d'une section (les lignes existantes gagnent une cellule vide au rendu). */
export async function ajouterColonneSection(sectionId: string, libelle?: string): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    const s = await prisma.sectionPlanFormation.findUnique({ where: { id: sectionId }, select: { colonnes: true } });
    if (!s) return { ok: false, message: "Section introuvable." };
    const cols = chaines(s.colonnes);
    if (cols.length >= 12) return { ok: false, message: "Maximum 12 colonnes." };
    cols.push((libelle ?? "").trim() || `Colonne ${cols.length + 1}`);
    await prisma.sectionPlanFormation.update({ where: { id: sectionId }, data: { colonnes: cols } });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] ajout colonne :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Colonne ajoutée." };
}

/** Renomme la colonne d'index donné (n'affecte pas les cellules). */
export async function renommerColonneSection(sectionId: string, index: number, libelle: string): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    const s = await prisma.sectionPlanFormation.findUnique({ where: { id: sectionId }, select: { colonnes: true } });
    if (!s) return { ok: false, message: "Section introuvable." };
    const cols = chaines(s.colonnes);
    if (index < 0 || index >= cols.length) return { ok: false, message: "Colonne invalide." };
    cols[index] = libelle.trim() || `Colonne ${index + 1}`;
    await prisma.sectionPlanFormation.update({ where: { id: sectionId }, data: { colonnes: cols } });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] renommage colonne :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

/** Retire la colonne d'index donné ET la cellule correspondante de chaque ligne (réalignement atomique). */
export async function retirerColonneSection(sectionId: string, index: number): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    const s = await prisma.sectionPlanFormation.findUnique({
      where: { id: sectionId },
      select: { colonnes: true, lignes: { select: { id: true, cellules: true, type: true } } },
    });
    if (!s) return { ok: false, message: "Section introuvable." };
    const cols = chaines(s.colonnes);
    if (index < 0 || index >= cols.length) return { ok: false, message: "Colonne invalide." };
    if (cols.length <= 1) return { ok: false, message: "Une section doit garder au moins une colonne." };
    const nouvellesCols = cols.filter((_, i) => i !== index);
    await prisma.$transaction([
      prisma.sectionPlanFormation.update({ where: { id: sectionId }, data: { colonnes: nouvellesCols } }),
      ...s.lignes
        .filter((l) => l.type !== "banniere")
        .map((l) =>
          prisma.lignePlanFormation.update({
            where: { id: l.id },
            data: { cellules: chaines(l.cellules).filter((_, i) => i !== index) },
          }),
        ),
    ]);
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] retrait colonne :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Colonne retirée." };
}

export async function supprimerSection(id: string): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    await prisma.sectionPlanFormation.delete({ where: { id } });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] suppr section :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Section supprimée." };
}

/** Déplace une section (sens = -1 vers le haut, +1 vers le bas) en échangeant l'ordre avec sa voisine. */
export async function deplacerSection(id: string, sens: -1 | 1): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    const courant = await prisma.sectionPlanFormation.findUnique({ where: { id }, select: { id: true, ordre: true, planId: true } });
    if (!courant) return { ok: false, message: "Section introuvable." };
    const voisin = await prisma.sectionPlanFormation.findFirst({
      where: { planId: courant.planId, ordre: sens < 0 ? { lt: courant.ordre } : { gt: courant.ordre } },
      orderBy: { ordre: sens < 0 ? "desc" : "asc" },
      select: { id: true, ordre: true },
    });
    if (!voisin) return { ok: true };
    await prisma.$transaction([
      prisma.sectionPlanFormation.update({ where: { id: courant.id }, data: { ordre: voisin.ordre } }),
      prisma.sectionPlanFormation.update({ where: { id: voisin.id }, data: { ordre: courant.ordre } }),
    ]);
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] déplacement section :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

// ── Lignes ──

export async function ajouterLigne(
  sectionId: string,
  data: { type?: string; cellules?: string[]; texte?: string | null; ton?: string | null },
): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    const dernier = await prisma.lignePlanFormation.findFirst({ where: { sectionId }, orderBy: { ordre: "desc" }, select: { ordre: true } });
    const ordre = (dernier?.ordre ?? -1) + 1;
    await prisma.lignePlanFormation.create({
      data: {
        sectionId,
        ordre,
        type: data.type === "banniere" || data.type === "total" ? data.type : "donnee",
        cellules: chaines(data.cellules),
        texte: (data.texte ?? "").trim() || null,
        ton: data.ton ?? null,
      },
    });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] ajout ligne :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Ligne ajoutée." };
}

export async function modifierLigne(
  id: string,
  data: { type?: string; cellules?: string[]; texte?: string | null; ton?: string | null },
): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    await prisma.lignePlanFormation.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type === "banniere" || data.type === "total" ? data.type : "donnee" } : {}),
        ...(data.cellules !== undefined ? { cellules: chaines(data.cellules) } : {}),
        ...(data.texte !== undefined ? { texte: (data.texte ?? "").trim() || null } : {}),
        ...(data.ton !== undefined ? { ton: data.ton } : {}),
      },
    });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] modif ligne :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Ligne mise à jour." };
}

export async function supprimerLigne(id: string): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    await prisma.lignePlanFormation.delete({ where: { id } });
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] suppr ligne :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Ligne supprimée." };
}

export async function deplacerLigne(id: string, sens: -1 | 1): Promise<EtatForm> {
  const g = await gardeAdmin();
  if ("erreur" in g) return g.erreur;
  try {
    const courant = await prisma.lignePlanFormation.findUnique({ where: { id }, select: { id: true, ordre: true, sectionId: true } });
    if (!courant) return { ok: false, message: "Ligne introuvable." };
    const voisin = await prisma.lignePlanFormation.findFirst({
      where: { sectionId: courant.sectionId, ordre: sens < 0 ? { lt: courant.ordre } : { gt: courant.ordre } },
      orderBy: { ordre: sens < 0 ? "desc" : "asc" },
      select: { id: true, ordre: true },
    });
    if (!voisin) return { ok: true };
    await prisma.$transaction([
      prisma.lignePlanFormation.update({ where: { id: courant.id }, data: { ordre: voisin.ordre } }),
      prisma.lignePlanFormation.update({ where: { id: voisin.id }, data: { ordre: courant.ordre } }),
    ]);
    revalidatePath(CHEMIN);
  } catch (e) {
    console.error("[plan-formation] déplacement ligne :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}
