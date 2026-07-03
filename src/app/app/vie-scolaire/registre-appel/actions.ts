"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { envoyerSMS } from "@/lib/sms/envoyer";
import { suggererDescription, type ProfilEleve, type TypeSuggestion } from "@/lib/ia/suggestions";
import { conduiteSur20, BAREME_DEFAUT, STATUTS_APPEL, type BaremeConduite, type StatutAppel } from "./lib";

/** Barème de conduite de l'établissement d'une classe (défaut si introuvable). */
async function baremeDeClasse(classeId: string): Promise<BaremeConduite> {
  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    select: {
      etablissement: {
        select: {
          conduiteAbsenceNj: true,
          conduiteRetardNj: true,
          conduiteObservation: true,
          conduiteEncouragement: true,
        },
      },
    },
  });
  const e = classe?.etablissement;
  return e
    ? { absenceNj: e.conduiteAbsenceNj, retardNj: e.conduiteRetardNj, observation: e.conduiteObservation, encouragement: e.conduiteEncouragement }
    : BAREME_DEFAUT;
}

export interface EtatForm {
  ok: boolean;
  message?: string;
}

export interface ExportRegistre {
  ok: boolean;
  message?: string;
  csv?: string;
  nom?: string;
}

const BASE = "/app/vie-scolaire/registre-appel";
const STATUTS = STATUTS_APPEL.map((s) => s.v);

/** Peut-on saisir l'appel pour cette classe ? (admin, chef/éducateur du périmètre, ou enseignant affecté) */
async function peutSaisir(u: UtilisateurCourant, classeId: string): Promise<boolean> {
  if (u.apercuActif) return false;
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) return false;
  if (u.roleReel === "admin") return true;
  if (
    (u.roleReel === "chef_etablissement" || u.roleReel === "educateur") &&
    classe.etablissementId === u.portee.etablissementId
  ) {
    return true;
  }
  if (u.roleReel === "enseignant") {
    const aff = await prisma.affectationEnseignant.findFirst({
      where: { enseignantId: u.id, classeId },
    });
    return Boolean(aff);
  }
  return false;
}

function normaliserDate(valeur: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const d = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normaliserHeureSeance(valeur: string): string | null {
  const v = valeur.trim();
  return /^\d{2}h\d{2} - \d{2}h\d{2}$/.test(v) ? v : null;
}

// ─────────────────────────────────────────────────────────────
//  Enregistrement de l'appel (statuts + motifs, par séance)
// ─────────────────────────────────────────────────────────────
export async function enregistrerAppel(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const classeId = String(formData.get("classeId") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  const disciplineId = String(formData.get("disciplineId") ?? "").trim() || null;
  const heureSeance = normaliserHeureSeance(String(formData.get("heureSeance") ?? ""));
  const date = normaliserDate(dateStr);
  if (!classeId || !date) return { ok: false, message: "Classe ou date invalide." };

  if (!(await peutSaisir(u, classeId))) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }

  // Statuts saisis : champs `statut_<eleveId>` ; motifs : `motif_<eleveId>`.
  const lignes: { eleveId: string; statut: StatutAppel; motif: string | null }[] = [];
  for (const [cle, val] of formData.entries()) {
    if (!cle.startsWith("statut_")) continue;
    const eleveId = cle.slice("statut_".length);
    const statut = String(val) as StatutAppel;
    if (!STATUTS.includes(statut)) continue;
    const motif = String(formData.get(`motif_${eleveId}`) ?? "").trim().slice(0, 160) || null;
    lignes.push({ eleveId, statut, motif });
  }
  if (lignes.length === 0) return { ok: false, message: "Aucun élève à enregistrer." };

  try {
    // Réutilise l'appel existant de cette classe / date / discipline / séance, sinon le crée.
    let appel = await prisma.appel.findFirst({ where: { classeId, date, disciplineId, heureSeance } });
    if (!appel) {
      appel = await prisma.appel.create({
        data: { classeId, date, disciplineId, heureSeance, saisiParId: u.id },
      });
    }
    await Promise.all(
      lignes.map((l) =>
        prisma.presence.upsert({
          where: { appelId_eleveId: { appelId: appel!.id, eleveId: l.eleveId } },
          update: { statut: l.statut, motif: l.motif },
          create: { appelId: appel!.id, eleveId: l.eleveId, statut: l.statut, motif: l.motif },
        }),
      ),
    );
    revalidatePath(BASE);
  } catch (e) {
    console.error("[appel] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Appel enregistré." };
}

// ─────────────────────────────────────────────────────────────
//  Justification des absences / retards d'un élève (classe entière)
// ─────────────────────────────────────────────────────────────
export async function justifierAbsences(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const classeId = String(formData.get("classeId") ?? "");
  const eleveId = String(formData.get("eleveId") ?? "");
  const motif = String(formData.get("motif") ?? "").trim().slice(0, 160) || null;
  if (!classeId || !eleveId) return { ok: false, message: "Paramètres invalides." };

  if (!(await peutSaisir(u, classeId))) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }

  try {
    const res = await prisma.presence.updateMany({
      where: {
        eleveId,
        justifie: false,
        statut: { in: ["absent", "retard"] },
        appel: { classeId },
      },
      data: { justifie: true, ...(motif ? { motif } : {}) },
    });
    revalidatePath(BASE);
    return {
      ok: true,
      message:
        res.count > 0
          ? `${res.count} absence(s)/retard(s) justifié(s).`
          : "Rien à justifier pour cet élève.",
    };
  } catch (e) {
    console.error("[appel/justifier] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Événements de vie scolaire (encouragement / observation / infirmerie)
// ─────────────────────────────────────────────────────────────
const TYPES_EVENEMENT = ["encouragement", "observation", "infirmerie"] as const;
type TypeEvenement = (typeof TYPES_EVENEMENT)[number];

/** Profil réel de l'élève (assiduité + événements) — base des suggestions IA. */
async function profilEleve(classeId: string, eleveId: string): Promise<ProfilEleve | null> {
  const bareme = await baremeDeClasse(classeId);
  const [eleve, classe, presences, evenements] = await Promise.all([
    prisma.utilisateur.findUnique({
      where: { id: eleveId },
      select: { prenoms: true, nom: true, email: true, sexe: true },
    }),
    prisma.classe.findUnique({ where: { id: classeId }, select: { nom: true } }),
    prisma.presence.findMany({
      where: { eleveId, justifie: false, statut: { in: ["absent", "retard"] }, appel: { classeId } },
      select: { statut: true },
    }),
    prisma.evenementAppel.groupBy({
      by: ["type"],
      where: { eleveId, classeId },
      _count: { _all: true },
    }),
  ]);
  if (!eleve || !classe) return null;
  const aNj = presences.filter((p) => p.statut === "absent").length;
  const rNj = presences.filter((p) => p.statut === "retard").length;
  const nb = (t: TypeEvenement) => evenements.find((e) => e.type === t)?._count._all ?? 0;
  return {
    nomComplet: [eleve.nom, eleve.prenoms].filter(Boolean).join(" ") || eleve.email,
    sexe: eleve.sexe,
    classe: classe.nom,
    absencesNonJustifiees: aNj,
    retardsNonJustifies: rNj,
    encouragements: nb("encouragement"),
    observations: nb("observation"),
    conduite: conduiteSur20(aNj, rNj, nb("observation"), nb("encouragement"), bareme),
  };
}

// ─────────────────────────────────────────────────────────────
//  Barème de conduite de l'établissement (ajustable par le chef)
// ─────────────────────────────────────────────────────────────
export async function enregistrerBareme(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif) return { ok: false, message: "Mode aperçu : action en lecture seule." };

  const etablissementId = String(formData.get("etablissementId") ?? "");
  if (!etablissementId) return { ok: false, message: "Établissement manquant." };

  // Réservé au chef / gestionnaire de CET établissement (ou à l'admin système).
  const autorise =
    u.roleReel === "admin" ||
    ((u.roleReel === "chef_etablissement" || u.roleReel === "etablissements_admin") &&
      u.portee.etablissementId === etablissementId);
  if (!autorise) return { ok: false, message: "Réservé au chef d'établissement (ou à l'admin)." };

  const lire = (cle: string): number | null => {
    const v = Number(String(formData.get(cle) ?? "").replace(",", "."));
    return Number.isFinite(v) && v >= 0 && v <= 5 ? Math.round(v * 100) / 100 : null;
  };
  const absenceNj = lire("absenceNj");
  const retardNj = lire("retardNj");
  const observation = lire("observation");
  const encouragement = lire("encouragement");
  if (absenceNj === null || retardNj === null || observation === null || encouragement === null) {
    return { ok: false, message: "Valeurs invalides : chaque poids doit être compris entre 0 et 5 points." };
  }

  try {
    await prisma.etablissement.update({
      where: { id: etablissementId },
      data: {
        conduiteAbsenceNj: absenceNj,
        conduiteRetardNj: retardNj,
        conduiteObservation: observation,
        conduiteEncouragement: encouragement,
      },
    });
    revalidatePath(BASE);
    return { ok: true, message: "Barème de conduite mis à jour pour l'établissement." };
  } catch (e) {
    console.error("[appel/bareme] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Suggestion de description (IA si clé configurée, sinon repli basé sur le profil). */
export async function suggestionEvenement(params: {
  classeId: string;
  eleveId: string;
  type: TypeSuggestion;
}): Promise<{ ok: boolean; texte?: string; source?: "ia" | "profil"; message?: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!(await peutSaisir(u, params.classeId))) return { ok: false, message: "Action non autorisée." };
  try {
    const profil = await profilEleve(params.classeId, params.eleveId);
    if (!profil) return { ok: false, message: "Élève introuvable." };
    const { texte, source } = await suggererDescription(params.type, profil);
    return { ok: true, texte, source };
  } catch (e) {
    console.error("[appel/suggestion] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Enregistre un événement (encouragement / observation / infirmerie) pour un élève. */
export async function enregistrerEvenement(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const type = String(formData.get("type") ?? "") as TypeEvenement;
  const classeId = String(formData.get("classeId") ?? "");
  const eleveId = String(formData.get("eleveId") ?? "");
  const date = normaliserDate(String(formData.get("date") ?? ""));
  const heureSeance = normaliserHeureSeance(String(formData.get("heureSeance") ?? ""));
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  const accompagnateur = String(formData.get("accompagnateur") ?? "").trim().slice(0, 120) || null;

  if (!TYPES_EVENEMENT.includes(type)) return { ok: false, message: "Type d'événement invalide." };
  if (!classeId || !eleveId || !date) return { ok: false, message: "Paramètres invalides." };
  if (!description) return { ok: false, message: "La description est requise." };
  if (!(await peutSaisir(u, classeId))) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    // Sécurité : l'élève doit être inscrit dans CETTE classe.
    const inscrit = await prisma.inscription.findFirst({ where: { classeId, eleveId }, select: { id: true } });
    if (!inscrit) return { ok: false, message: "Élève non inscrit dans cette classe." };

    await prisma.evenementAppel.create({
      data: { type, classeId, eleveId, date, heureSeance, description, accompagnateur, saisiParId: u.id },
    });
    revalidatePath(BASE);
    const libelles: Record<TypeEvenement, string> = {
      encouragement: "Encouragement enregistré.",
      observation: "Observation enregistrée.",
      infirmerie: "Admission à l'infirmerie enregistrée.",
    };
    return { ok: true, message: libelles[type] };
  } catch (e) {
    console.error("[appel/evenement] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Historique d'absences d'un élève (bouton bleu)
// ─────────────────────────────────────────────────────────────
export interface LigneHistorique {
  date: string; // AAAA-MM-JJ
  heure: string | null;
  discipline: string | null;
  type: "absent" | "retard";
  motif: string | null;
  justifie: boolean;
}

export async function historiqueAbsences(params: {
  classeId: string;
  eleveId: string;
}): Promise<{ ok: boolean; lignes?: LigneHistorique[]; message?: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!(await peutSaisir(u, params.classeId))) return { ok: false, message: "Action non autorisée." };
  try {
    const presences = await prisma.presence.findMany({
      where: {
        eleveId: params.eleveId,
        statut: { in: ["absent", "retard"] },
        appel: { classeId: params.classeId },
      },
      include: { appel: { include: { discipline: { select: { nom: true } } } } },
      orderBy: { appel: { date: "desc" } },
      take: 100,
    });
    return {
      ok: true,
      lignes: presences.map((p) => ({
        date: p.appel.date.toISOString().slice(0, 10),
        heure: p.appel.heureSeance,
        discipline: p.appel.discipline?.nom ?? null,
        type: p.statut as "absent" | "retard",
        motif: p.motif,
        justifie: p.justifie,
      })),
    };
  } catch (e) {
    console.error("[appel/historique] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  SMS aux parents (élèves sélectionnés ou en alerte)
// ─────────────────────────────────────────────────────────────
export async function envoyerSmsParents(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const classeId = String(formData.get("classeId") ?? "");
  // Message personnalisé optionnel (modale SMS individuelle) — sinon message généré par élève.
  const messagePersonnalise = String(formData.get("message") ?? "").trim().slice(0, 320) || null;
  let eleveIds: string[] = [];
  try {
    const brut = JSON.parse(String(formData.get("eleveIds") ?? "[]"));
    if (Array.isArray(brut)) eleveIds = brut.filter((x) => typeof x === "string").slice(0, 200);
  } catch {
    return { ok: false, message: "Sélection invalide." };
  }
  if (!classeId || eleveIds.length === 0) {
    return { ok: false, message: "Sélectionnez au moins un élève." };
  }

  if (!(await peutSaisir(u, classeId))) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }

  try {
    const classe = await prisma.classe.findUnique({
      where: { id: classeId },
      include: { etablissement: { select: { nom: true } } },
    });
    // Sécurité : ne retient que des élèves réellement inscrits dans CETTE classe.
    const inscriptions = await prisma.inscription.findMany({
      where: { classeId, eleveId: { in: eleveIds } },
      include: { eleve: { select: { id: true, prenoms: true, nom: true, email: true } } },
    });
    const nonJustifiees = await prisma.presence.groupBy({
      by: ["eleveId", "statut"],
      where: {
        eleveId: { in: inscriptions.map((i) => i.eleveId) },
        justifie: false,
        statut: { in: ["absent", "retard"] },
        appel: { classeId },
      },
      _count: { _all: true },
    });
    const absencesPar = new Map<string, number>();
    for (const n of nonJustifiees) {
      if (n.statut === "absent") absencesPar.set(n.eleveId, n._count._all);
    }
    const liens = await prisma.lienParentEleve.findMany({
      where: { eleveId: { in: inscriptions.map((i) => i.eleveId) } },
      include: { parent: { select: { telephone: true } } },
    });
    const parentsPar = new Map<string, string[]>();
    for (const l of liens) {
      const tel = l.parent.telephone?.trim();
      if (!tel) continue;
      parentsPar.set(l.eleveId, [...(parentsPar.get(l.eleveId) ?? []), tel]);
    }

    let envoyes = 0;
    let sansContact = 0;
    for (const i of inscriptions) {
      const tels = parentsPar.get(i.eleveId) ?? [];
      if (tels.length === 0) {
        sansContact += 1;
        continue;
      }
      const nomEleve = [i.eleve.prenoms, i.eleve.nom].filter(Boolean).join(" ") || i.eleve.email;
      const nbAbs = absencesPar.get(i.eleveId) ?? 0;
      const contenu =
        messagePersonnalise ??
        `EduWeb Planner — ${classe?.nom ?? "Classe"} : ${nomEleve} totalise ${nbAbs} absence(s) non justifiée(s). ` +
          `Merci de les justifier auprès de l'établissement.`;
      for (const tel of tels) {
        const statut = await envoyerSMS(tel, contenu);
        await prisma.alerteSMS.create({
          data: {
            etablissementNom: classe?.etablissement?.nom ?? null,
            telephone: tel,
            contenu,
            type: "absence",
            statut,
            envoyeParEmail: u.email,
          },
        });
        envoyes += 1;
      }
    }
    revalidatePath(BASE);
    const suffixe = sansContact > 0 ? ` ${sansContact} élève(s) sans contact parent renseigné.` : "";
    return { ok: true, message: `${envoyes} SMS envoyé(s) aux parents.${suffixe}` };
  } catch (e) {
    console.error("[appel/sms] erreur :", e);
    return { ok: false, message: "Erreur technique lors de l'envoi des SMS." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Export CSV du registre (séance courante + cumuls)
// ─────────────────────────────────────────────────────────────
function champCsv(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function exporterRegistre(params: {
  classeId: string;
  date: string;
  disciplineId?: string | null;
  heureSeance?: string | null;
}): Promise<ExportRegistre> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const date = normaliserDate(params.date);
  if (!params.classeId || !date) return { ok: false, message: "Paramètres invalides." };
  if (!(await peutSaisir(u, params.classeId))) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }

  try {
    const bareme = await baremeDeClasse(params.classeId);
    const [classe, inscriptions, appel, cumulBruts, evenementsBruts] = await Promise.all([
      prisma.classe.findUnique({ where: { id: params.classeId }, select: { nom: true } }),
      prisma.inscription.findMany({
        where: { classeId: params.classeId },
        include: {
          eleve: { select: { id: true, prenoms: true, nom: true, email: true, sexe: true, matricule: true } },
        },
      }),
      prisma.appel.findFirst({
        where: {
          classeId: params.classeId,
          date,
          disciplineId: params.disciplineId?.trim() || null,
          heureSeance: params.heureSeance?.trim() || null,
        },
        include: { presences: true },
      }),
      prisma.presence.findMany({
        where: { appel: { classeId: params.classeId } },
        select: { eleveId: true, statut: true, justifie: true },
      }),
      prisma.evenementAppel.groupBy({
        by: ["eleveId", "type"],
        where: { classeId: params.classeId },
        _count: { _all: true },
      }),
    ]);

    const cumuls = new Map<string, { a: number; r: number; aNj: number; rNj: number }>();
    for (const p of cumulBruts) {
      const c = cumuls.get(p.eleveId) ?? { a: 0, r: 0, aNj: 0, rNj: 0 };
      if (p.statut === "absent") {
        c.a += 1;
        if (!p.justifie) c.aNj += 1;
      } else if (p.statut === "retard") {
        c.r += 1;
        if (!p.justifie) c.rNj += 1;
      }
      cumuls.set(p.eleveId, c);
    }
    const duJour = new Map(appel?.presences.map((p) => [p.eleveId, p]) ?? []);
    const libelle = new Map(STATUTS_APPEL.map((s) => [s.v, s.libelle]));
    const evenementsPar = new Map<string, { obs: number; enc: number }>();
    for (const ev of evenementsBruts) {
      const e = evenementsPar.get(ev.eleveId) ?? { obs: 0, enc: 0 };
      if (ev.type === "observation") e.obs += ev._count._all;
      else if (ev.type === "encouragement") e.enc += ev._count._all;
      evenementsPar.set(ev.eleveId, e);
    }

    const lignes: string[][] = [
      ["N°", "Matricule", "Nom et prénoms", "Sexe", "Statut", "Motif", "Absences (cumul)", "Retards (cumul)", "Non justifiées", "Conduite /20"],
    ];
    const tri = inscriptions
      .map((i) => ({
        ...i.eleve,
        nomComplet: [i.eleve.nom, i.eleve.prenoms].filter(Boolean).join(" ") || i.eleve.email,
      }))
      .sort((a, b) => a.nomComplet.localeCompare(b.nomComplet));
    tri.forEach((e, idx) => {
      const p = duJour.get(e.id);
      const c = cumuls.get(e.id) ?? { a: 0, r: 0, aNj: 0, rNj: 0 };
      const ev = evenementsPar.get(e.id) ?? { obs: 0, enc: 0 };
      lignes.push([
        String(idx + 1),
        e.matricule ?? "",
        e.nomComplet,
        e.sexe ?? "",
        p ? (libelle.get(p.statut) ?? p.statut) : "",
        p?.motif ?? "",
        String(c.a),
        String(c.r),
        String(c.aNj + c.rNj),
        conduiteSur20(c.aNj, c.rNj, ev.obs, ev.enc, bareme).toLocaleString("fr-FR"),
      ]);
    });

    const csv = "﻿" + lignes.map((l) => l.map(champCsv).join(";")).join("\r\n") + "\r\n";
    const nomClasse = (classe?.nom ?? "classe").replace(/[^\w\-]+/g, "-");
    return { ok: true, csv, nom: `registre-appel-${nomClasse}-${params.date}.csv` };
  } catch (e) {
    console.error("[appel/export] erreur :", e);
    return { ok: false, message: "Erreur technique lors de l'export." };
  }
}
