"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

async function peutGerer(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (u.roleReel === "admin") return u;
  if (u.roleReel === "etablissements_admin" && u.portee.etablissementId === etablissementId) {
    return u;
  }
  return null;
}

function s(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}
function n(formData: FormData, key: string, def: number): number {
  const v = Number(formData.get(key));
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
}

// ── Étapes 1 & 2 : sauvegarde des champs scalaires ──
export async function sauvegarderConfiguration(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const nom = s(formData, "nom");
  if (!nom) return { ok: false, message: "Le nom de l'établissement est requis." };

  const typeVal = String(formData.get("type") ?? "college");
  const statutVal = String(formData.get("statut") ?? "public");

  try {
    await prisma.etablissement.update({
      where: { id },
      data: {
        nom,
        type: typeVal as never,
        statut: statutVal as never,
        code: s(formData, "code"),
        ville: s(formData, "ville"),
        regionId: s(formData, "regionId"),
        pays: s(formData, "pays"),
        sloganBulletin: s(formData, "sloganBulletin"),
        ministere: s(formData, "ministere"),
        anneeScolaire: s(formData, "anneeScolaire"),
        fonctionChef: s(formData, "fonctionChef"),
        nomChef: s(formData, "nomChef"),
        planRapport: s(formData, "planRapport"),
        presentationRapport: s(formData, "presentationRapport"),
        effectifSouhaiteParClasse: n(formData, "effectifSouhaiteParClasse", 40),
        nbSallesDisponibles: n(formData, "nbSallesDisponibles", 0),
        creneauxParJour: n(formData, "creneauxParJour", 8),
        horaireDebutMatin: s(formData, "horaireDebutMatin"),
        horairePauseMatinDebut: s(formData, "horairePauseMatinDebut"),
        horairePauseMatinFin: s(formData, "horairePauseMatinFin"),
        horairePauseMidiDebut: s(formData, "horairePauseMidiDebut"),
        horaireRepriseApresMidi: s(formData, "horaireRepriseApresMidi"),
        horaireFinJournee: s(formData, "horaireFinJournee"),
      },
    });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[config] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Configuration enregistrée." };
}

// ── Calcul des classes pédagogiques (effectif / effectif souhaité) ──
function lettreClasse(i: number): string {
  let s = "";
  let x = i + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export async function calculerClasses(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  if (!id) return { ok: false, message: "Établissement manquant." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const etab = await prisma.etablissement.findUnique({ where: { id } });
    if (!etab) return { ok: false, message: "Établissement introuvable." };
    const effectifSouhaite = Math.max(1, etab.effectifSouhaiteParClasse);
    const niveaux = await prisma.niveau.findMany({ orderBy: { ordre: "asc" } });
    const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });

    let totalClasses = 0;
    for (const niveau of niveaux) {
      const effectif = n(formData, `effectif_${niveau.id}`, 0);
      const vacation = String(formData.get(`vacation_${niveau.id}`) ?? "simple");
      if (effectif <= 0) {
        // Réinitialise la config de ce niveau s'il est vidé.
        await prisma.niveauEtablissement.deleteMany({
          where: { etablissementId: id, niveauId: niveau.id },
        });
        continue;
      }
      const nbClasses = Math.ceil(effectif / effectifSouhaite);
      totalClasses += nbClasses;

      await prisma.niveauEtablissement.upsert({
        where: { etablissementId_niveauId: { etablissementId: id, niveauId: niveau.id } },
        update: { effectif, vacation: vacation as never, nbClasses },
        create: {
          etablissementId: id,
          niveauId: niveau.id,
          effectif,
          vacation: vacation as never,
          nbClasses,
        },
      });

      // Crée les classes manquantes (non destructif).
      const existantes = await prisma.classe.count({
        where: { etablissementId: id, niveauId: niveau.id },
      });
      const aCreer = nbClasses - existantes;
      const effectifParClasse = Math.round(effectif / nbClasses);
      for (let k = 0; k < aCreer; k++) {
        await prisma.classe.create({
          data: {
            nom: `${niveau.nom} ${lettreClasse(existantes + k)}`,
            etablissementId: id,
            niveauId: niveau.id,
            effectif: effectifParClasse,
            regimeVacation: vacation as never,
            anneeScolaireId: annee?.id ?? null,
          },
        });
      }
    }
    revalidatePath(`/app/systeme/etablissements/${id}`);
    return { ok: true, message: `Classes calculées : ${totalClasses} division(s) au total.` };
  } catch (e) {
    console.error("[calcul-classes] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

// ── Champs personnalisés enseignants ──
export async function ajouterChamp(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  const etiquette = s(formData, "etiquette");
  if (!etiquette) return { ok: false, message: "Étiquette requise." };
  try {
    const count = await prisma.champEnseignant.count({ where: { etablissementId: id } });
    await prisma.champEnseignant.create({
      data: {
        etablissementId: id,
        etiquette,
        type: String(formData.get("type") ?? "text"),
        placeholder: s(formData, "placeholder"),
        requis: formData.get("requis") === "on",
        ordre: count,
      },
    });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[champ] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Champ ajouté." };
}

export async function supprimerChamp(formData: FormData) {
  const champId = String(formData.get("champId") ?? "");
  if (!champId) return;
  const champ = await prisma.champEnseignant.findUnique({ where: { id: champId } });
  if (!champ) return;
  const u = await peutGerer(champ.etablissementId);
  if (!u) return;
  await prisma.champEnseignant.delete({ where: { id: champId } });
  revalidatePath(`/app/systeme/etablissements/${champ.etablissementId}`);
}

// ── Documents officiels (Vercel Blob) ──
const CHAMPS_DOC: Record<string, "emblemeUrl" | "logoUrl" | "cachetUrl" | "signatureUrl"> = {
  embleme: "emblemeUrl",
  logo: "logoUrl",
  cachet: "cachetUrl",
  signature: "signatureUrl",
};

export async function televerserDocument(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const id = String(formData.get("etablissementId") ?? "");
  const type = String(formData.get("type") ?? "");
  const champ = CHAMPS_DOC[type];
  if (!id || !champ) return { ok: false, message: "Paramètre invalide." };
  const u = await peutGerer(id);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Aucun fichier sélectionné." };
  }
  if (!fichier.type.startsWith("image/")) {
    return { ok: false, message: "Le fichier doit être une image." };
  }

  try {
    const ext = fichier.name.split(".").pop() ?? "png";
    const blob = await put(`etablissements/${id}/${type}-${Date.now()}.${ext}`, fichier, {
      access: "public",
      addRandomSuffix: true,
    });
    await prisma.etablissement.update({ where: { id }, data: { [champ]: blob.url } });
    revalidatePath(`/app/systeme/etablissements/${id}`);
  } catch (e) {
    console.error("[blob] erreur :", e);
    return {
      ok: false,
      message:
        "Échec du téléversement. Le stockage Blob est-il bien configuré (BLOB_READ_WRITE_TOKEN) ?",
    };
  }
  return { ok: true, message: "Image téléversée." };
}

export async function supprimerDocument(formData: FormData) {
  const id = String(formData.get("etablissementId") ?? "");
  const type = String(formData.get("type") ?? "");
  const champ = CHAMPS_DOC[type];
  if (!id || !champ) return;
  const u = await peutGerer(id);
  if (!u) return;
  await prisma.etablissement.update({ where: { id }, data: { [champ]: null } });
  revalidatePath(`/app/systeme/etablissements/${id}`);
}
