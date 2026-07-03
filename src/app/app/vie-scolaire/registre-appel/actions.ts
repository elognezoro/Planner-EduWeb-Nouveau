"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { envoyerSMS } from "@/lib/sms/envoyer";
import { conduiteSur20, STATUTS_APPEL, type StatutAppel } from "./lib";

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
//  SMS aux parents (élèves sélectionnés ou en alerte)
// ─────────────────────────────────────────────────────────────
export async function envoyerSmsParents(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const classeId = String(formData.get("classeId") ?? "");
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
    const [classe, inscriptions, appel, cumulBruts] = await Promise.all([
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
        conduiteSur20(c.aNj, c.rNj).toLocaleString("fr-FR"),
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
