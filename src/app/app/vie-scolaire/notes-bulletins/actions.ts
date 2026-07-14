"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { refusEssaiPour } from "@/lib/premium/garde-essai";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

/** Peut-on saisir une note pour ce couple classe/discipline ? */
async function peutSaisir(
  u: UtilisateurCourant,
  classeId: string,
  disciplineId: string,
): Promise<boolean> {
  if (u.apercuActif) return false;
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) return false;
  if (u.roleReel === "admin") return true;
  if (
    (u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement" ||
      u.roleReel === "educateur") &&
    classe.etablissementId === u.portee.etablissementId
  ) {
    return true;
  }
  if (u.roleReel === "enseignant") {
    const aff = await prisma.affectationEnseignant.findFirst({
      where: { enseignantId: u.id, classeId, disciplineId },
    });
    return Boolean(aff);
  }
  return false;
}

export async function enregistrerNotes(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const classeId = String(formData.get("classeId") ?? "");
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const libelle = String(formData.get("libelle") ?? "").trim();
  const periode = Number(formData.get("periode") ?? 1);
  const sur = Number(formData.get("sur") ?? 20);

  if (!classeId || !disciplineId) return { ok: false, message: "Classe ou discipline manquante." };
  if (!libelle) return { ok: false, message: "Indiquez un libellé d'évaluation." };
  if (!Number.isInteger(periode) || periode < 1 || periode > 3) {
    return { ok: false, message: "Période invalide." };
  }
  if (!(sur > 0)) return { ok: false, message: "Barème invalide." };

  if (!(await peutSaisir(u, classeId, disciplineId))) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }

  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const lignes: { eleveId: string; valeur: number }[] = [];
  for (const [cle, val] of formData.entries()) {
    if (!cle.startsWith("note_")) continue;
    const brut = String(val).trim();
    if (brut === "") continue;
    const valeur = Number(brut.replace(",", "."));
    if (Number.isNaN(valeur) || valeur < 0 || valeur > sur) continue;
    lignes.push({ eleveId: cle.slice("note_".length), valeur });
  }
  if (lignes.length === 0) {
    return { ok: false, message: "Aucune note valide saisie." };
  }

  try {
    await prisma.note.createMany({
      data: lignes.map((l) => ({
        eleveId: l.eleveId,
        classeId,
        disciplineId,
        libelle,
        valeur: l.valeur,
        sur,
        periode,
        saisiParId: u.id,
      })),
    });
    revalidatePath("/app/vie-scolaire/notes-bulletins");
  } catch (e) {
    console.error("[notes] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: `${lignes.length} note(s) enregistrée(s).` };
}
