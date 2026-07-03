"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

export interface EtatForm {
  ok: boolean;
  message?: string;
  erreurs?: Record<string, string[] | undefined>;
}

/** Réservé à l'administrateur système, hors mode aperçu (lecture seule). */
async function exigerAdmin() {
  const u = await getUtilisateurCourant();
  if (!u || u.roleReel !== "admin" || u.apercuActif) return null;
  return u;
}

export async function mettreAJourConfiguration(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const regime = String(formData.get("regimeNotation") ?? "");
  const annee = String(formData.get("anneeScolaireCourante") ?? "").trim() || null;
  if (regime !== "trimestre" && regime !== "semestre") {
    return { ok: false, message: "Régime de notation invalide." };
  }

  try {
    await prisma.configuration.upsert({
      where: { id: "global" },
      update: { regimeNotation: regime, anneeScolaireCourante: annee },
      create: { id: "global", regimeNotation: regime, anneeScolaireCourante: annee },
    });
    if (annee) {
      // L'année courante devient l'année active.
      await prisma.anneeScolaire.updateMany({ data: { active: false } });
      await prisma.anneeScolaire.updateMany({ where: { libelle: annee }, data: { active: true } });
    }
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[config] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Configuration enregistrée." };
}

const schemaAnnee = z.object({
  libelle: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Format attendu : AAAA-AAAA (ex : 2025-2026)."),
});

export async function creerAnneeScolaire(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const parsed = schemaAnnee.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Libellé invalide." };
  }
  try {
    await prisma.anneeScolaire.upsert({
      where: { libelle: parsed.data.libelle },
      update: {},
      create: { libelle: parsed.data.libelle },
    });
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[annee] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Année scolaire ajoutée." };
}

const schemaRegion = z.object({
  nom: z.string().trim().min(2, "Nom de région requis.").max(80),
});

export async function creerRegion(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const parsed = schemaRegion.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Nom invalide." };
  }
  try {
    const existe = await prisma.region.findUnique({
      where: { pays_nom: { pays: "Côte d'Ivoire", nom: parsed.data.nom } },
    });
    if (existe) return { ok: false, message: "Cette région existe déjà." };
    await prisma.region.create({ data: { nom: parsed.data.nom, pays: "Côte d'Ivoire" } });
    revalidatePath("/app/systeme/configuration");
    revalidatePath("/app/systeme/etablissements");
  } catch (e) {
    console.error("[region] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Région ajoutée." };
}

/**
 * Enregistre la GRILLE HORAIRE NATIONALE (heures / semaine par niveau × discipline)
 * du pays sélectionné. Chaque pays a son propre modèle par défaut ; les établissements
 * du pays en héritent, et peuvent le personnaliser dans leur console (bloc Volumes).
 */
export async function enregistrerGrilleNationale(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const pays = String(formData.get("pays") ?? "").trim();
  if (!pays) return { ok: false, message: "Pays manquant." };

  // Cellules h:<niveauId>:<disciplineId> — 0 ou vide = pas de cours (tiret).
  const lignes: { niveauId: string; disciplineId: string; heures: number }[] = [];
  for (const [cle, valeur] of formData.entries()) {
    if (!cle.startsWith("h:")) continue;
    const [, niveauId, disciplineId] = cle.split(":");
    if (!niveauId || !disciplineId) continue;
    const heures = Number(valeur);
    if (Number.isFinite(heures) && heures > 0) {
      lignes.push({ niveauId, disciplineId, heures: Math.min(40, heures) });
    }
  }

  try {
    // Remplacement complet du modèle national DU PAYS (les grilles d'établissement sont intactes).
    await prisma.$transaction([
      prisma.grilleHoraire.deleteMany({ where: { etablissementId: null, pays } }),
      ...(lignes.length > 0
        ? [
            prisma.grilleHoraire.createMany({
              data: lignes.map((l) => ({
                niveauId: l.niveauId,
                disciplineId: l.disciplineId,
                etablissementId: null,
                pays,
                heuresHebdo: l.heures,
              })),
            }),
          ]
        : []),
    ]);
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[grille nationale] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `Grille horaire nationale de ${pays} enregistrée (${lignes.length} case(s) renseignée(s)).` };
}

// ── Disciplines (référentiel national) ──
const schemaDiscipline = z.object({
  nom: z.string().trim().min(2, "Nom de discipline requis (2 caractères min.).").max(80),
  couleur: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.")
    .optional()
    .or(z.literal("")),
});

export async function creerDiscipline(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const parsed = schemaDiscipline.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const nom = parsed.data.nom;
  try {
    const existe = await prisma.discipline.findFirst({
      where: { nom: { equals: nom, mode: "insensitive" } },
    });
    if (existe) return { ok: false, message: `La discipline « ${existe.nom} » existe déjà.` };
    await prisma.discipline.create({ data: { nom, couleur: parsed.data.couleur || "#2f7d5e" } });
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[discipline] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `Discipline « ${nom} » ajoutée.` };
}

/**
 * Renomme une discipline (correction d'une faute de saisie, changement d'intitulé).
 * Toutes les références (grilles, affectations, notes, compétences…) sont préservées
 * puisque l'identifiant ne change pas.
 */
export async function renommerDiscipline(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const id = String(formData.get("disciplineId") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  if (!id) return { ok: false, message: "Discipline manquante." };
  if (nom.length < 2 || nom.length > 80) {
    return { ok: false, message: "Nom de discipline requis (2 à 80 caractères)." };
  }

  try {
    const discipline = await prisma.discipline.findUnique({ where: { id }, select: { nom: true } });
    if (!discipline) return { ok: false, message: "Discipline introuvable." };
    const doublon = await prisma.discipline.findFirst({
      where: { nom: { equals: nom, mode: "insensitive" }, id: { not: id } },
    });
    if (doublon) return { ok: false, message: `La discipline « ${doublon.nom} » existe déjà.` };
    await prisma.discipline.update({ where: { id }, data: { nom } });
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[discipline] renommage :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `Discipline renommée en « ${nom} ».` };
}

/**
 * Suppression PROTÉGÉE d'une discipline : refusée si des données pédagogiques y sont
 * rattachées (affectations d'enseignants, notes, cahier de texte). Les données de
 * paramétrage (grilles horaires, compétences, effectifs) sont retirées avec elle.
 */
export async function supprimerDiscipline(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const id = String(formData.get("disciplineId") ?? "");
  if (!id) return { ok: false, message: "Discipline manquante." };

  try {
    const discipline = await prisma.discipline.findUnique({ where: { id }, select: { nom: true } });
    if (!discipline) return { ok: false, message: "Discipline introuvable." };

    const [affectations, notes, cahiers] = await Promise.all([
      prisma.affectationEnseignant.count({ where: { disciplineId: id } }),
      prisma.note.count({ where: { disciplineId: id } }),
      prisma.cahierTexte.count({ where: { disciplineId: id } }),
    ]);
    if (affectations + notes + cahiers > 0) {
      const details = [
        affectations ? `${affectations} affectation(s)` : null,
        notes ? `${notes} note(s)` : null,
        cahiers ? `${cahiers} séance(s) de cahier de texte` : null,
      ].filter(Boolean);
      return {
        ok: false,
        message: `Suppression impossible : « ${discipline.nom} » est utilisée par ${details.join(", ")}.`,
      };
    }

    await prisma.discipline.delete({ where: { id } });
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[discipline] suppression :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Discipline supprimée." };
}
