"use server";

import { revalidatePath } from "next/cache";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { estHabiliteRabais, instruireDemandePromo } from "@/lib/premium/rabais";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/systeme/approbations-promo";

/** Instruction réservée à l'admin système et aux utilisateurs expressément habilités. */
async function exigerInstructeur() {
  const u = await getUtilisateurCourant();
  if (!u || !(await estHabiliteRabais(u))) {
    throw new Error("Action réservée à l'administrateur système ou aux utilisateurs habilités.");
  }
  return u;
}

export async function approuverDemandePromo(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const acteur = await exigerInstructeur();
  const demandeId = String(formData.get("demandeId") ?? "");
  const code = String(formData.get("code") ?? "").trim() || null;
  // Champ d'incrément : taux librement fixé (utilisé si aucun code prédéfini n'est choisi).
  const tauxBrut = String(formData.get("taux") ?? "").trim();
  const taux = tauxBrut ? Number(tauxBrut) : null;
  if (!demandeId) return { ok: false, message: "Demande manquante." };
  if (!code && taux == null) return { ok: false, message: "Choisissez un code prédéfini ou fixez le taux accordé." };

  try {
    const r = await instruireDemandePromo({ acteur, demandeId, approuver: true, code, taux });
    revalidatePath(BASE);
    revalidatePath("/app/vie-scolaire/academie-premium");
    return r;
  } catch (e) {
    console.error("[promo/approuver] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function refuserDemandePromo(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const acteur = await exigerInstructeur();
  const demandeId = String(formData.get("demandeId") ?? "");
  if (!demandeId) return { ok: false, message: "Demande manquante." };

  try {
    const r = await instruireDemandePromo({ acteur, demandeId, approuver: false });
    revalidatePath(BASE);
    revalidatePath("/app/vie-scolaire/academie-premium");
    return r;
  } catch (e) {
    console.error("[promo/refuser] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
