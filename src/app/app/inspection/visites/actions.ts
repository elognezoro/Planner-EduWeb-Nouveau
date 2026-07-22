"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { peutInspecter, etablissementAccessible, peutModifierVisite } from "@/lib/inspection/droits-visite";
import { creerNotifications } from "@/lib/notifications/creer";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { creneauxHoraires } from "@/lib/emploi-du-temps/horaires";
import {
  correspondSpecialites,
  estEncadreurPedagogique,
  lireSpecialites,
} from "@/lib/inspection/specialites";
import { suggererNoteIndicativeVisite } from "@/lib/ia/note-indicative-visite";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/inspection/visites";
const TYPES = ["classe", "etablissement", "suivi"] as const;
const MODALITES = ["programmee", "inopinee"] as const;
const STATUTS_VISITE = ["planifiee", "realisee", "annulee"] as const;
const PRIORITES = ["basse", "moyenne", "haute"] as const;
const STATUTS_RECO = ["ouverte", "en_cours", "traitee"] as const;

type TypeVisite = (typeof TYPES)[number];
type Modalite = (typeof MODALITES)[number];
type StatutVisite = (typeof STATUTS_VISITE)[number];
type Priorite = (typeof PRIORITES)[number];
type StatutReco = (typeof STATUTS_RECO)[number];

// Les gardes `peutInspecter`, `etablissementAccessible` et `peutModifierVisite` sont
// FACTORISÉES dans `src/lib/inspection/droits-visite.ts` (module serveur partagé avec les
// actions de la grille de supervision) — comportement inchangé, aucune logique dupliquée.

function normaliserDate(valeur: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const d = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Contexte du formulaire « Planifier une visite » (types classe / suivi) ──

export interface OptionEnseignant {
  id: string;
  /** « Prénoms NOM — Spécialité(s) » (disciplines CompetenceEnseignant jointes par « / »). */
  libelle: string;
}

export interface ContexteVisite {
  ok: boolean;
  message?: string;
  enseignants: OptionEnseignant[];
  classes: { id: string; nom: string }[];
  /** Vrai si la liste d'enseignants est RESTREINTE aux spécialités de l'encadreur. */
  restreinte: boolean;
  /** Spécialités de l'encadreur ayant servi à la restriction (affichage). */
  specialites: string[];
  /** Vrai si l'encadreur (inspecteur/conseiller) n'a AUCUNE spécialité renseignée → aide Mon Profil. */
  sansSpecialite: boolean;
}

const CONTEXTE_VIDE = {
  enseignants: [] as OptionEnseignant[],
  classes: [] as { id: string; nom: string }[],
  restreinte: false,
  specialites: [] as string[],
  sansSpecialite: false,
};

/**
 * Enseignants et classes de l'établissement choisi, pour les visites de classe / de suivi.
 * La liste des enseignants est RESTREINTE à ceux dont une spécialité (CompetenceEnseignant)
 * correspond à l'une des spécialités de l'INSPECTEUR / CONSEILLER courant ; sans spécialité
 * renseignée, pas de restriction (et l'interface invite à compléter Mon Profil).
 */
export async function chargerContexteVisite(etablissementId: string): Promise<ContexteVisite> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée.", ...CONTEXTE_VIDE };
  if (!peutInspecter(u)) return { ok: false, message: "Action non autorisée.", ...CONTEXTE_VIDE };
  if (!etablissementId || !(await etablissementAccessible(u, etablissementId))) {
    return { ok: false, message: "Établissement hors de votre périmètre.", ...CONTEXTE_VIDE };
  }

  try {
    const [comptes, classes, moi] = await Promise.all([
      prisma.utilisateur.findMany({
        where: {
          roleActif: { nomTechnique: "enseignant" },
          OR: [
            { etablissementId },
            { etablissementsSecondaires: { some: { etablissementId } } },
          ],
        },
        orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
        select: {
          id: true,
          prenoms: true,
          nom: true,
          email: true,
          competences: {
            where: { etablissementId },
            select: { discipline: { select: { nom: true } } },
          },
        },
      }),
      prisma.classe.findMany({
        where: { etablissementId },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      }),
      prisma.utilisateur.findUnique({ where: { id: u.id }, select: { specialites: true } }),
    ]);

    const encadreur = estEncadreurPedagogique(u.roleReel);
    const specialites = encadreur ? lireSpecialites(moi?.specialites) : [];
    const restreinte = specialites.length > 0;
    const retenus = restreinte
      ? comptes.filter((c) =>
          correspondSpecialites(c.competences.map((k) => k.discipline.nom), specialites),
        )
      : comptes;

    return {
      ok: true,
      enseignants: retenus.map((c) => {
        const nom = [c.prenoms, c.nom].filter(Boolean).join(" ") || c.email;
        const disciplines = [...new Set(c.competences.map((k) => k.discipline.nom))];
        return { id: c.id, libelle: disciplines.length > 0 ? `${nom} — ${disciplines.join(" / ")}` : nom };
      }),
      classes,
      restreinte,
      specialites,
      sansSpecialite: encadreur && specialites.length === 0,
    };
  } catch (e) {
    console.error("[inspection] contexte visite :", e);
    return { ok: false, message: "Erreur technique.", ...CONTEXTE_VIDE };
  }
}

export interface CreneauEdtVisite {
  jour: number; // 0 = lundi … 5 = samedi
  periode: number;
  /** « 07h30 - 08h25 » (horaires réels de l'établissement) ou « P1 » en repli. */
  heure: string;
  classeId: string;
  classeNom: string;
  disciplineNom: string;
}

export interface EdtEnseignantVisite {
  ok: boolean;
  message?: string;
  creneaux: CreneauEdtVisite[];
}

/**
 * Emploi du temps HEBDOMADAIRE de l'enseignant dans l'établissement choisi : aide
 * l'encadreur à cibler la séance à visiter (un clic sur un créneau renseigne la classe
 * et l'heure de séance du formulaire).
 */
export async function chargerEdtEnseignantVisite(
  etablissementId: string,
  enseignantId: string,
): Promise<EdtEnseignantVisite> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée.", creneaux: [] };
  if (!peutInspecter(u)) return { ok: false, message: "Action non autorisée.", creneaux: [] };
  if (!etablissementId || !enseignantId || !(await etablissementAccessible(u, etablissementId))) {
    return { ok: false, message: "Établissement hors de votre périmètre.", creneaux: [] };
  }

  try {
    const [creneaux, etab] = await Promise.all([
      prisma.creneau.findMany({
        where: { etablissementId, enseignantId },
        orderBy: [{ jour: "asc" }, { periode: "asc" }],
        select: { jour: true, periode: true, classeId: true, classeNom: true, disciplineNom: true },
      }),
      prisma.etablissement.findUnique({
        where: { id: etablissementId },
        select: {
          creneauxParJour: true,
          horaireDebutMatin: true,
          horairePauseMatinDebut: true,
          horairePauseMatinFin: true,
          horairePauseMidiDebut: true,
          horaireRepriseApresMidi: true,
          horaireFinJournee: true,
        },
      }),
    ]);
    const horaires = etab ? creneauxHoraires(etab) : null;
    return {
      ok: true,
      creneaux: creneaux.map((c) => ({
        jour: c.jour,
        periode: c.periode,
        heure: horaires?.[c.periode]
          ? `${horaires[c.periode].debut} - ${horaires[c.periode].fin}`
          : `P${c.periode + 1}`,
        classeId: c.classeId,
        classeNom: c.classeNom,
        disciplineNom: c.disciplineNom,
      })),
    };
  } catch (e) {
    console.error("[inspection] EDT enseignant :", e);
    return { ok: false, message: "Erreur technique.", creneaux: [] };
  }
}

/** Une séance de la grille EDT choisie côté client (multi-sélection — cf. NouvelleVisiteForm). */
interface SeanceEntree {
  date: string;
  heure: string;
  classeId: string;
  classeNom: string;
}

/** Une séance résolue et validée côté serveur (une visite sera créée par séance). */
interface SeanceValidee {
  date: Date;
  dateStr: string;
  heureSeance: string | null;
  classeId: string | null;
}

export async function creerVisite(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutInspecter(u)) return { ok: false, message: "Action réservée aux inspecteurs (ou mode aperçu)." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const etablissementId = String(formData.get("etablissementId") ?? "");
  const enseignantId = String(formData.get("enseignantId") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "classe") as TypeVisite;
  const modalite = String(formData.get("modalite") ?? "programmee") as Modalite;
  const objet = String(formData.get("objet") ?? "").trim();

  if (!etablissementId) return { ok: false, message: "Établissement invalide." };
  if (!objet) return { ok: false, message: "L'objet de la visite est obligatoire." };
  if (!TYPES.includes(type)) return { ok: false, message: "Type de visite invalide." };
  if (!MODALITES.includes(modalite)) return { ok: false, message: "Modalité invalide." };
  if (!(await etablissementAccessible(u, etablissementId))) {
    return { ok: false, message: "Établissement hors de votre périmètre." };
  }
  // Types classe / suivi : l'enseignant (objet de la visite) est obligatoire.
  if ((type === "classe" || type === "suivi") && !enseignantId) {
    return { ok: false, message: "Choisissez l'enseignant à visiter." };
  }

  // ── Séance(s) : PLUSIEURS si choisies sur la grille EDT (multi-sélection de créneaux — champ
  // caché « seances »), UNE SEULE sinon (champs simples date/heureSeance/classeId, rétro-compatibles
  // — utilisés tels quels pour le type « etablissement », qui n'a pas de grille EDT). ──
  let seances: SeanceValidee[];
  const seancesBrut = String(formData.get("seances") ?? "").trim();

  if ((type === "classe" || type === "suivi") && seancesBrut) {
    let entrees: unknown;
    try {
      entrees = JSON.parse(seancesBrut);
    } catch {
      return { ok: false, message: "Séances invalides." };
    }
    if (!Array.isArray(entrees) || entrees.length === 0) {
      return { ok: false, message: "Choisissez au moins une séance." };
    }
    seances = [];
    for (const item of entrees) {
      const brut = item as Partial<SeanceEntree>;
      const dateStr = String(brut?.date ?? "");
      const date = normaliserDate(dateStr);
      if (!date) return { ok: false, message: "Une des dates choisies est invalide." };
      const classeIdSeance = String(brut?.classeId ?? "").trim() || null;
      if (!classeIdSeance) return { ok: false, message: "Choisissez la classe de chaque séance." };
      const heureSeance = String(brut?.heure ?? "").trim().slice(0, 40) || null;
      seances.push({ date, dateStr, heureSeance, classeId: classeIdSeance });
    }
  } else {
    const classeId = String(formData.get("classeId") ?? "").trim() || null;
    const dateStr = String(formData.get("date") ?? "");
    const heureSeance = String(formData.get("heureSeance") ?? "").trim().slice(0, 40) || null;
    const date = normaliserDate(dateStr);
    if (!date) return { ok: false, message: "Date invalide." };
    if ((type === "classe" || type === "suivi") && !classeId) {
      return { ok: false, message: "Choisissez la classe (objet de la visite)." };
    }
    seances = [{ date, dateStr, heureSeance, classeId }];
  }

  try {
    // Ne jamais faire confiance au client : l'enseignant doit APPARTENIR à l'établissement
    // choisi (principal ou rattachement secondaire).
    if (enseignantId) {
      const ens = await prisma.utilisateur.findFirst({
        where: {
          id: enseignantId,
          roleActif: { nomTechnique: "enseignant" },
          OR: [
            { etablissementId },
            { etablissementsSecondaires: { some: { etablissementId } } },
          ],
        },
        select: { id: true },
      });
      if (!ens) return { ok: false, message: "Cet enseignant n'appartient pas à l'établissement choisi." };
    }

    // Chaque classe (une par séance) doit elle aussi APPARTENIR à l'établissement choisi.
    const classesUniques = [...new Set(seances.map((s) => s.classeId).filter((id): id is string => id != null))];
    const classesValides =
      classesUniques.length > 0
        ? await prisma.classe.findMany({
            where: { id: { in: classesUniques }, etablissementId },
            select: { id: true, nom: true },
          })
        : [];
    const nomParClasseId = new Map(classesValides.map((c) => [c.id, c.nom]));
    for (const s of seances) {
      if (s.classeId && !nomParClasseId.has(s.classeId)) {
        return { ok: false, message: "Une des classes choisies n'appartient pas à l'établissement." };
      }
    }

    // UNE VISITE PAR SÉANCE (même établissement/enseignant/type/modalité/objet).
    await Promise.all(
      seances.map((s) =>
        prisma.visite.create({
          data: {
            inspecteurId: u.id,
            etablissementId,
            enseignantId,
            classeId: s.classeId,
            classeNom: s.classeId ? (nomParClasseId.get(s.classeId) ?? null) : null,
            date: s.date,
            heureSeance: s.heureSeance,
            type,
            modalite,
            objet,
          },
        }),
      ),
    );

    // Notification UNIQUEMENT pour une visite PROGRAMMÉE (annoncée) : la direction de
    // l'établissement (chef ET adjoint — l'ACE seconde le chef) et l'enseignant concerné
    // sont prévenus, en UNE SEULE notification récapitulant toutes les séances (pas un envoi
    // par visite). Une visite INOPINÉE n'envoie AUCUNE notification à l'établissement — l'effet
    // de surprise en est le principe.
    if (modalite === "programmee") {
      const chefs = await prisma.utilisateur.findMany({
        where: {
          etablissementId,
          roleActif: { nomTechnique: { in: ["chef_etablissement", "adjoint_chef_etablissement"] } },
        },
        select: { id: true },
      });
      const destinataires = [
        ...chefs.map((c) => c.id),
        ...(enseignantId ? [enseignantId] : []),
      ].filter((id, i, tous) => tous.indexOf(id) === i);
      const recap = seances.map((s) => `${s.dateStr}${s.heureSeance ? ` (${s.heureSeance})` : ""}`).join(", ");
      await creerNotifications(destinataires, {
        type: "info",
        titre: seances.length > 1 ? "Visites d'inspection planifiées" : "Visite d'inspection planifiée",
        message:
          seances.length > 1
            ? `${seances.length} visites (${objet}) sont planifiées dans votre établissement : ${recap}.`
            : `Une visite (${objet}) est planifiée dans votre établissement le ${recap}.`,
        lien: BASE,
      });
    }
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] création visite :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return {
    ok: true,
    message: seances.length > 1 ? `${seances.length} visites planifiées.` : "Visite planifiée.",
  };
}

export async function changerStatutVisite(visiteId: string, statut: StatutVisite): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!STATUTS_VISITE.includes(statut)) return { ok: false, message: "Statut invalide." };
  try {
    if (!(await peutModifierVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };
    await prisma.visite.update({ where: { id: visiteId }, data: { statut } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] statut visite :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

export async function enregistrerCompteRendu(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const visiteId = String(formData.get("visiteId") ?? "");
  const observations = String(formData.get("observations") ?? "").trim() || null;
  const noteBrute = String(formData.get("noteGlobale") ?? "").trim();
  if (noteBrute !== "" && Number.isNaN(Number(noteBrute))) {
    return { ok: false, message: "Note invalide." };
  }
  const noteGlobale = noteBrute === "" ? null : Math.min(20, Math.max(0, Number(noteBrute)));
  try {
    if (!(await peutModifierVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };
    await prisma.visite.update({
      where: { id: visiteId },
      data: { observations, noteGlobale, statut: "realisee" },
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] compte-rendu :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Compte-rendu enregistré." };
}

export async function ajouterRecommandation(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const visiteId = String(formData.get("visiteId") ?? "");
  const texte = String(formData.get("texte") ?? "").trim();
  const priorite = String(formData.get("priorite") ?? "moyenne") as Priorite;
  if (!texte) return { ok: false, message: "Le texte de la recommandation est obligatoire." };
  if (!PRIORITES.includes(priorite)) return { ok: false, message: "Priorité invalide." };
  try {
    if (!(await peutModifierVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };
    await prisma.recommandation.create({ data: { visiteId, texte, priorite } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] ajout recommandation :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Recommandation ajoutée." };
}

export async function changerStatutRecommandation(recoId: string, statut: StatutReco): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!STATUTS_RECO.includes(statut)) return { ok: false, message: "Statut invalide." };
  try {
    const reco = await prisma.recommandation.findUnique({
      where: { id: recoId },
      select: { visiteId: true },
    });
    if (!reco) return { ok: false, message: "Recommandation introuvable." };
    if (!(await peutModifierVisite(u, reco.visiteId))) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };
    await prisma.recommandation.update({ where: { id: recoId }, data: { statut } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] statut recommandation :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

export async function supprimerVisite(visiteId: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  try {
    if (!(await peutModifierVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };
    await prisma.visite.delete({ where: { id: visiteId } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] suppression visite :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Visite supprimée." };
}

// ── Note indicative IA (compte-rendu) ──

export interface EtatSuggestionNote {
  ok: boolean;
  message?: string;
  note?: number;
  justification?: string;
  source?: "ia" | "estimation";
}

const LONGUEUR_MIN_COMPTE_RENDU = 80;

/**
 * Note indicative (IA) déduite du texte du compte-rendu : PRÉ-REMPLIT le champ Appréciation
 * (reste modifiable — la note est TOUJOURS la décision de l'encadreur). Réutilise la garde
 * unique `peutModifierVisite` (mêmes droits que la saisie du compte-rendu) ; l'appel IA
 * lui-même ne lève jamais d'exception (repli heuristique local garanti, cf. lib/ia).
 */
export async function suggererNoteVisite(visiteId: string, texte: string): Promise<EtatSuggestionNote> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const observations = texte.trim();
  if (observations.length < LONGUEUR_MIN_COMPTE_RENDU) {
    return { ok: false, message: "Rédigez d'abord le compte-rendu." };
  }
  try {
    if (!(await peutModifierVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
    const { note, justification, source } = await suggererNoteIndicativeVisite(observations);
    return { ok: true, note, justification, source };
  } catch (e) {
    console.error("[inspection] note indicative IA :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
