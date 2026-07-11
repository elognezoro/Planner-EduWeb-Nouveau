"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { peutGererEtablissement } from "@/lib/vie-scolaire/contexte";
import { envoyerSMS } from "@/lib/sms/envoyer";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/vie-scolaire/alertes-sms";
const TYPES = ["absence", "note", "convocation", "info"] as const;
type TypeAlerte = (typeof TYPES)[number];

function peutEnvoyer(u: UtilisateurCourant): boolean {
  return (
    !u.apercuActif &&
    ["admin", "chef_etablissement", "educateur", "super_admin_etablissements"].includes(u.roleReel)
  );
}

/** L'utilisateur peut-il agir sur cette classe ? (autorisation centralisée par périmètre) */
async function classeAutorisee(u: UtilisateurCourant, classeId: string) {
  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    select: { etablissementId: true, etablissement: { select: { nom: true, pays: true } } },
  });
  if (!classe) return null;
  return (await peutGererEtablissement(u, classe.etablissementId)) ? classe : null;
}

export async function envoyerAlerte(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutEnvoyer(u)) return { ok: false, message: "Action réservée au personnel (ou mode aperçu)." };

  const classeId = String(formData.get("classeId") ?? "").trim() || null;
  const telephoneDirect = String(formData.get("telephone") ?? "").trim() || null;
  const etabIdDirect = String(formData.get("etablissementId") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "info") as TypeAlerte;
  const contenu = String(formData.get("contenu") ?? "").trim();

  if (!contenu) return { ok: false, message: "Le message est vide." };
  if (!TYPES.includes(type)) return { ok: false, message: "Type d'alerte invalide." };

  // Résolution des destinataires + rattachement de l'alerte à un établissement/pays (cloisonnement).
  let telephones: string[] = [];
  let etablissementId: string | null = null;
  let etablissementNom: string | null = null;
  let pays: string | null = null;

  if (telephoneDirect) {
    // Envoi direct : l'alerte est rattachée à l'établissement du contexte (champ caché de la page),
    // validé côté serveur par le périmètre de l'utilisateur (jamais un établissement d'un autre pays).
    if (!etabIdDirect || !(await peutGererEtablissement(u, etabIdDirect))) {
      return { ok: false, message: "Établissement hors de votre périmètre." };
    }
    const etab = await prisma.etablissement.findUnique({
      where: { id: etabIdDirect },
      select: { nom: true, pays: true },
    });
    if (!etab) return { ok: false, message: "Établissement introuvable." };
    etablissementId = etabIdDirect;
    etablissementNom = etab.nom;
    pays = etab.pays;
    telephones = [telephoneDirect];
  } else if (classeId) {
    const classe = await classeAutorisee(u, classeId);
    if (!classe) return { ok: false, message: "Classe hors de votre périmètre." };
    etablissementId = classe.etablissementId;
    etablissementNom = classe.etablissement.nom;
    pays = classe.etablissement.pays;
    const inscriptions = await prisma.inscription.findMany({
      where: { classeId },
      select: {
        eleve: {
          select: { liensCommeEleve: { select: { parent: { select: { telephone: true } } } } },
        },
      },
    });
    const set = new Set<string>();
    for (const i of inscriptions) {
      for (const lien of i.eleve.liensCommeEleve) {
        const tel = lien.parent.telephone?.trim();
        if (tel) set.add(tel);
      }
    }
    telephones = [...set];
  } else {
    return { ok: false, message: "Choisissez une classe ou saisissez un numéro." };
  }

  if (telephones.length === 0) {
    return { ok: false, message: "Aucun destinataire avec un numéro de téléphone." };
  }

  try {
    let simules = 0;
    let envoyes = 0;
    for (const tel of telephones) {
      const statut = await envoyerSMS(tel, contenu);
      if (statut === "simule") simules += 1;
      if (statut === "envoye") envoyes += 1;
      await prisma.alerteSMS.create({
        data: { telephone: tel, contenu, type, statut, etablissementId, etablissementNom, pays, envoyeParEmail: u.email },
      });
    }
    revalidatePath(BASE);
    const n = telephones.length;
    const detail = envoyes > 0 ? `${envoyes} envoyé(s)` : `${simules} simulé(s) (fournisseur SMS non branché)`;
    return { ok: true, message: `${n} alerte(s) traitée(s) — ${detail}.` };
  } catch (e) {
    console.error("[alertes-sms] :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
