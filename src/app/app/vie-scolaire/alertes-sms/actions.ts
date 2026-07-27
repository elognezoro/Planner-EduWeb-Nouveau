"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { peutGererEtablissement } from "@/lib/vie-scolaire/contexte";
import { envoyerSMS } from "@/lib/sms/envoyer";
import { executerPasseAlertes } from "@/lib/alertes/moteur";
import { refusEssaiPour } from "@/lib/premium/garde-essai";

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
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

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
    // Envoi en PARALLÈLE BORNÉ (lots de 8) au lieu d'une boucle séquentielle : une alerte de classe
    // (des dizaines de destinataires × ~300 ms chez un vrai fournisseur) ne dépasse plus le timeout
    // de la fonction serverless (cf. audit de scalabilité — robustesse opérationnelle).
    const CONCURRENCE = 8;
    for (let i = 0; i < telephones.length; i += CONCURRENCE) {
      const lot = telephones.slice(i, i + CONCURRENCE);
      const statuts = await Promise.all(
        lot.map(async (tel) => {
          const statut = await envoyerSMS(tel, contenu);
          await prisma.alerteSMS.create({
            data: { telephone: tel, contenu, type, statut, etablissementId, etablissementNom, pays, envoyeParEmail: u.email },
          });
          return statut;
        }),
      );
      for (const s of statuts) {
        if (s === "simule") simules += 1;
        else if (s === "envoye") envoyes += 1;
      }
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

// ── Paramétrage des alertes (seuils, canaux, modèles) + moteur d'alertes ──

/** Garde commune : personnel habilité, hors aperçu, période d'essai OK, établissement en périmètre. */
async function garderConfig(etablissementId: string): Promise<{ ok: true; u: UtilisateurCourant } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutEnvoyer(u)) return { ok: false, message: "Action réservée au personnel (ou mode aperçu)." };
  if (!etablissementId || !(await peutGererEtablissement(u, etablissementId))) {
    return { ok: false, message: "Établissement hors de votre périmètre." };
  }
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  return { ok: true, u };
}

const borne = (v: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.trunc(Number(v) || 0)));

export async function enregistrerReglagesAlertes(
  etablissementId: string,
  r: {
    seuilAbsences: number; seuilRetards: number; seuilNote: number;
    canalSms: boolean; canalEmail: boolean; canalInApp: boolean; canalWhatsApp: boolean;
    telEtablissement: string | null;
  },
): Promise<EtatForm> {
  const g = await garderConfig(etablissementId);
  if (!g.ok) return { ok: false, message: g.message };
  const data = {
    seuilAbsences: borne(r.seuilAbsences, 0, 99),
    seuilRetards: borne(r.seuilRetards, 0, 99),
    seuilNote: borne(r.seuilNote, 0, 20),
    canalSms: !!r.canalSms, canalEmail: !!r.canalEmail, canalInApp: !!r.canalInApp, canalWhatsApp: !!r.canalWhatsApp,
    telEtablissement: (r.telEtablissement ?? "").trim().slice(0, 30) || null,
  };
  try {
    await prisma.parametrageAlertesSMS.upsert({ where: { etablissementId }, create: { etablissementId, ...data }, update: data });
    revalidatePath(BASE);
    return { ok: true, message: "Réglages enregistrés." };
  } catch (e) {
    console.error("[alertes-config] :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function enregistrerModelesAlertes(
  etablissementId: string,
  m: { modeleAbsence: string; modeleRetard: string; modeleNotes: string },
): Promise<EtatForm> {
  const g = await garderConfig(etablissementId);
  if (!g.ok) return { ok: false, message: g.message };
  const net = (s: string) => (s ?? "").trim().slice(0, 320);
  const data = { modeleAbsence: net(m.modeleAbsence), modeleRetard: net(m.modeleRetard), modeleNotes: net(m.modeleNotes) };
  if (!data.modeleAbsence || !data.modeleRetard || !data.modeleNotes) {
    return { ok: false, message: "Les trois modèles doivent être renseignés." };
  }
  try {
    await prisma.parametrageAlertesSMS.upsert({ where: { etablissementId }, create: { etablissementId, ...data }, update: data });
    revalidatePath(BASE);
    return { ok: true, message: "Modèles enregistrés." };
  } catch (e) {
    console.error("[alertes-modeles] :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Déclenche une passe d'alertes MAINTENANT (moteur : seuils → SMS aux parents concernés). */
export async function lancerPasseAlertes(etablissementId: string): Promise<EtatForm> {
  const g = await garderConfig(etablissementId);
  if (!g.ok) return { ok: false, message: g.message };
  try {
    const r = await executerPasseAlertes(etablissementId, g.u.email);
    revalidatePath(BASE);
    const traites = r.smsEnvoyes + r.smsSimules;
    const suffixe = r.sansContact > 0 ? ` ${r.sansContact} élève(s) concerné(s) sans contact parent.` : "";
    return {
      ok: true,
      message: `Passe terminée : ${r.elevesConcernes} élève(s) au-dessus des seuils, ${traites} SMS traité(s)${r.smsEnvoyes > 0 ? ` (${r.smsEnvoyes} réels)` : " (simulés)"}.${suffixe}`,
    };
  } catch (e) {
    console.error("[alertes-passe] :", e);
    return { ok: false, message: "Erreur technique lors de la passe d'alertes." };
  }
}
