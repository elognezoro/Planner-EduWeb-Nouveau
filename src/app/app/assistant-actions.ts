"use server";

import { requireUtilisateur } from "@/lib/auth/session";
import { repondreAssistant, type MessageChat } from "@/lib/ia/assistant";
import { limiteDebitOk } from "@/lib/ia/limite-debit";

const QUESTION_MAX = 2000;
// Garde-fou de coût : au plus 20 questions par minute et par utilisateur.
const DEBIT_MAX = 20;
const DEBIT_FENETRE_MS = 60_000;

/**
 * Question posée au chatbot d'assistance. Réservé aux utilisateurs connectés ; le périmètre
 * est re-dérivé côté serveur (jamais depuis le client). L'historique n'est pas persisté.
 */
export async function poserQuestionAssistant(
  historique: MessageChat[],
  question: string,
): Promise<{ ok: boolean; texte: string; source?: "ia" | "repli"; message?: string }> {
  const u = await requireUtilisateur();
  // Réservé aux comptes pleinement habilités : un compte en attente de rôle (auto-inscrit)
  // ne doit pas pouvoir consommer d'appels IA payants (maîtrise du coût).
  if (u.accesRestreint) {
    return { ok: false, texte: "", message: "L'assistant sera disponible une fois votre rôle validé." };
  }
  if (!limiteDebitOk(`assistant:${u.id}`, DEBIT_MAX, DEBIT_FENETRE_MS)) {
    return { ok: false, texte: "", message: "Vous avez envoyé trop de messages. Patientez une minute, svp." };
  }

  const q = (question ?? "").trim().slice(0, QUESTION_MAX);
  if (!q) return { ok: false, texte: "", message: "Question vide." };

  // On borne et on assainit l'historique reçu du client (rôles valides, contenu texte borné).
  const hist: MessageChat[] = (Array.isArray(historique) ? historique : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.contenu === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, contenu: m.contenu.slice(0, QUESTION_MAX) }));

  const { texte, source } = await repondreAssistant(
    {
      id: u.id,
      nomComplet: u.nomComplet,
      roleActif: u.roleActif,
      libelleRoleActif: u.libelleRoleActif,
      portee: u.portee,
      accesRestreint: u.accesRestreint,
      apercuActif: u.apercuActif,
    },
    hist,
    q,
  );
  return { ok: true, texte, source };
}
