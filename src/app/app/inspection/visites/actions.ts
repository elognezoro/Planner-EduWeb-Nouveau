"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { creerNotifications } from "@/lib/notifications/creer";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/inspection/visites";
const TYPES = ["classe", "etablissement", "suivi"] as const;
const STATUTS_VISITE = ["planifiee", "realisee", "annulee"] as const;
const PRIORITES = ["basse", "moyenne", "haute"] as const;
const STATUTS_RECO = ["ouverte", "en_cours", "traitee"] as const;

type TypeVisite = (typeof TYPES)[number];
type StatutVisite = (typeof STATUTS_VISITE)[number];
type Priorite = (typeof PRIORITES)[number];
type StatutReco = (typeof STATUTS_RECO)[number];

/**
 * Inspecteur, ACE (visites de classe pour évaluer l'exercice professionnel des enseignants
 * de SON établissement) ou admin, hors mode aperçu.
 */
function peutInspecter(u: UtilisateurCourant): boolean {
  return (
    !u.apercuActif &&
    (u.roleReel === "admin" || u.roleReel === "inspecteur" || u.roleReel === "adjoint_chef_etablissement")
  );
}

/** L'établissement est-il dans le périmètre de l'utilisateur ? */
async function etablissementAccessible(u: UtilisateurCourant, etabId: string): Promise<boolean> {
  if (u.roleReel === "admin") return true;
  // L'ACE visite les classes de SON établissement uniquement.
  if (u.roleReel === "adjoint_chef_etablissement") return etabId === u.portee.etablissementId;
  const etab = await prisma.etablissement.findUnique({
    where: { id: etabId },
    select: { regionId: true },
  });
  if (!etab) return false;
  return etab.regionId != null && etab.regionId === u.portee.regionId;
}

/** Peut gérer cette visite : admin, ou inspecteur/ACE propriétaire. */
async function peutGererVisite(u: UtilisateurCourant, visiteId: string): Promise<boolean> {
  if (u.apercuActif) return false;
  if (u.roleReel === "admin") return true;
  if (u.roleReel !== "inspecteur" && u.roleReel !== "adjoint_chef_etablissement") return false;
  const v = await prisma.visite.findUnique({ where: { id: visiteId }, select: { inspecteurId: true } });
  return v?.inspecteurId === u.id;
}

function normaliserDate(valeur: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const d = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function creerVisite(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutInspecter(u)) return { ok: false, message: "Action réservée aux inspecteurs (ou mode aperçu)." };

  const etablissementId = String(formData.get("etablissementId") ?? "");
  const enseignantId = String(formData.get("enseignantId") ?? "").trim() || null;
  const dateStr = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "classe") as TypeVisite;
  const objet = String(formData.get("objet") ?? "").trim();
  const date = normaliserDate(dateStr);

  if (!etablissementId || !date) return { ok: false, message: "Établissement ou date invalide." };
  if (!objet) return { ok: false, message: "L'objet de la visite est obligatoire." };
  if (!TYPES.includes(type)) return { ok: false, message: "Type de visite invalide." };
  if (!(await etablissementAccessible(u, etablissementId))) {
    return { ok: false, message: "Établissement hors de votre périmètre." };
  }

  try {
    const visite = await prisma.visite.create({
      data: { inspecteurId: u.id, etablissementId, enseignantId, date, type, objet },
      include: { etablissement: { select: { nom: true } } },
    });
    // Notifier la direction de l'établissement (chef ET adjoint — l'ACE seconde le chef).
    const chefs = await prisma.utilisateur.findMany({
      where: {
        etablissementId,
        roleActif: { nomTechnique: { in: ["chef_etablissement", "adjoint_chef_etablissement"] } },
      },
      select: { id: true },
    });
    await creerNotifications(
      chefs.map((c) => c.id),
      {
        type: "info",
        titre: "Visite d'inspection planifiée",
        message: `Une visite (${objet}) est planifiée dans votre établissement le ${dateStr}.`,
        lien: BASE,
      },
    );
    void visite;
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] création visite :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Visite planifiée." };
}

export async function changerStatutVisite(visiteId: string, statut: StatutVisite): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!STATUTS_VISITE.includes(statut)) return { ok: false, message: "Statut invalide." };
  if (!(await peutGererVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
  try {
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
  const noteGlobale = noteBrute === "" ? null : Math.min(20, Math.max(0, Number(noteBrute)));
  if (noteBrute !== "" && Number.isNaN(Number(noteBrute))) {
    return { ok: false, message: "Note invalide." };
  }
  if (!(await peutGererVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
  try {
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
  if (!(await peutGererVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
  try {
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
  const reco = await prisma.recommandation.findUnique({
    where: { id: recoId },
    select: { visiteId: true },
  });
  if (!reco) return { ok: false, message: "Recommandation introuvable." };
  if (!(await peutGererVisite(u, reco.visiteId))) return { ok: false, message: "Action non autorisée." };
  try {
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
  if (!(await peutGererVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.visite.delete({ where: { id: visiteId } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] suppression visite :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Visite supprimée." };
}
