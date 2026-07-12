"use server";

import { headers } from "next/headers";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { repondreAssistant, type MessageChat, type ContexteAssistant } from "@/lib/ia/assistant";
import { limiteDebitOk } from "@/lib/ia/limite-debit";

const QUESTION_MAX = 2000;
// Garde-fous de coût : connectés = généreux ; visiteurs anonymes = plus stricts (endpoint public).
const DEBIT_MAX_CONNECTE = 20;
const DEBIT_MAX_ANONYME = 8;
const DEBIT_FENETRE_MS = 60_000;

/** IP d'appel (best-effort) pour borner l'usage anonyme. */
async function ipAppelante(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  return (xff ? xff.split(",")[0].trim() : "") || h.get("x-real-ip") || "inconnu";
}

/**
 * Question posée au chatbot d'assistance — disponible sur TOUTES les pages, connecté ou non.
 * - Connecté (accès complet) : aide + consultation de SES données (outils cloisonnés au périmètre serveur).
 * - Connecté restreint / visiteur anonyme : aide générale uniquement (aucun accès aux données).
 * L'historique n'est pas persisté ; le périmètre est toujours re-dérivé côté serveur.
 */
export async function poserQuestionAssistant(
  historique: MessageChat[],
  question: string,
): Promise<{ ok: boolean; texte: string; source?: "ia" | "repli"; message?: string }> {
  const u = await getUtilisateurCourant();

  // Limitation de débit : par utilisateur si connecté, sinon par IP (endpoint public).
  const cle = u ? `assistant:${u.id}` : `assistant-ip:${await ipAppelante()}`;
  const max = u ? DEBIT_MAX_CONNECTE : DEBIT_MAX_ANONYME;
  if (!limiteDebitOk(cle, max, DEBIT_FENETRE_MS)) {
    return { ok: false, texte: "", message: "Vous avez envoyé trop de messages. Patientez une minute, svp." };
  }

  const q = (question ?? "").trim().slice(0, QUESTION_MAX);
  if (!q) return { ok: false, texte: "", message: "Question vide." };

  const hist: MessageChat[] = (Array.isArray(historique) ? historique : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.contenu === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, contenu: m.contenu.slice(0, QUESTION_MAX) }));

  const ctx: ContexteAssistant | null = u
    ? {
        id: u.id,
        nomComplet: u.nomComplet,
        roleActif: u.roleActif,
        libelleRoleActif: u.libelleRoleActif,
        portee: u.portee,
        accesRestreint: u.accesRestreint,
        apercuActif: u.apercuActif,
      }
    : null;

  const { texte, source } = await repondreAssistant(ctx, hist, q);
  return { ok: true, texte, source };
}
