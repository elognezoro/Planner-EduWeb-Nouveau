import "server-only";
import { headers } from "next/headers";
import { prismaBase } from "@/lib/prisma";
import { contexteAuditActuel } from "./contexte";
import { versJsonCaviarde } from "./caviardage";

/**
 * Helpers de journalisation EXPLICITE, en complément de la capture automatique (extension Prisma).
 *
 *  - `journaliserActivite` : évènement métier riche (avec état avant/après, cible lisible…).
 *  - `journaliserSecurite` : évènement de sécurité (connexion, déconnexion, mot de passe, 2FA, rôle),
 *     souvent HORS contexte de session résolue (l'acteur est alors passé explicitement).
 *
 * Écriture via le client de BASE (non étendu) : pas de double journalisation. Non bloquant :
 * un échec de journalisation ne doit jamais interrompre l'action de l'utilisateur.
 */

export interface EntreeActivite {
  action: string;
  entite?: string | null;
  entiteId?: string | null;
  cible?: string | null;
  etablissementId?: string | null;
  ancienneValeur?: unknown;
  nouvelleValeur?: unknown;
  details?: unknown;
  /** Acteur : par défaut lu dans le contexte d'audit de la requête (ALS). */
  utilisateurId?: string | null;
  acteurEmail?: string | null;
  acteurRole?: string | null;
  ip?: string | null;
  navigateur?: string | null;
  source?: "metier" | "securite";
  /** Mode assistance : administrateur RÉEL. Par défaut lu dans le contexte d'audit (ALS). */
  operateurId?: string | null;
  operateurEmail?: string | null;
  operateurRole?: string | null;
}

/** IP (1er x-forwarded-for) + user-agent de la requête courante ; jamais bloquant. */
async function capturerRequete(): Promise<{ ip: string | null; navigateur: string | null }> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
    const navigateur = (h.get("user-agent") ?? "").trim().slice(0, 300) || null;
    return { ip, navigateur };
  } catch {
    return { ip: null, navigateur: null };
  }
}

/** Journalise un évènement (métier par défaut). Acteur/IP complétés depuis le contexte si absents. */
export async function journaliserActivite(entree: EntreeActivite): Promise<void> {
  try {
    const ctx = contexteAuditActuel();
    await prismaBase.journalActivite.create({
      data: {
        utilisateurId: entree.utilisateurId ?? ctx?.utilisateurId ?? null,
        acteurEmail: entree.acteurEmail ?? ctx?.acteurEmail ?? null,
        acteurRole: entree.acteurRole ?? ctx?.acteurRole ?? null,
        etablissementId: entree.etablissementId ?? ctx?.etablissementId ?? null,
        action: entree.action,
        operation: entree.source === "securite" ? "securite" : "metier",
        entite: entree.entite ?? null,
        entiteId: entree.entiteId ?? null,
        cible: entree.cible ?? null,
        ancienneValeur: versJsonCaviarde(entree.ancienneValeur),
        nouvelleValeur: versJsonCaviarde(entree.nouvelleValeur),
        details: versJsonCaviarde(entree.details),
        ip: entree.ip ?? ctx?.ip ?? null,
        navigateur: entree.navigateur ?? ctx?.navigateur ?? null,
        source: entree.source ?? "metier",
        // Couvre d'un seul point le canal MÉTIER et le canal SÉCURITÉ (journaliserSecurite délègue ici).
        operateurId: entree.operateurId ?? ctx?.operateurId ?? null,
        operateurEmail: entree.operateurEmail ?? ctx?.operateurEmail ?? null,
        operateurRole: entree.operateurRole ?? ctx?.operateurRole ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] journaliserActivite :", e);
  }
}

/**
 * Journalise un évènement de SÉCURITÉ. L'acteur est souvent connu explicitement (connexion),
 * l'IP/navigateur sont capturés depuis la requête. Le préfixe « securite. » est garanti.
 */
export async function journaliserSecurite(
  action: string,
  opts: {
    utilisateurId?: string | null;
    acteurEmail?: string | null;
    acteurRole?: string | null;
    cible?: string | null;
    details?: unknown;
  } = {},
): Promise<void> {
  const req = await capturerRequete();
  await journaliserActivite({
    action: action.startsWith("securite.") ? action : `securite.${action}`,
    source: "securite",
    ip: req.ip,
    navigateur: req.navigateur,
    ...opts,
  });
}
