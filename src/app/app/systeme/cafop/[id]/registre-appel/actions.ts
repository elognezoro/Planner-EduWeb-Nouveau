"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";
import { envoyerSMS } from "@/lib/sms/envoyer";
import { type EtatForm } from "@/lib/formation/actions";
import { conduiteSur20 } from "./lib";

// ── Garde : admin système ou cafop_admin du centre concerné (hors mode aperçu) ──
type Garde = { ok: true; u: UtilisateurCourant } | { ok: false; message: string };
async function cafopAutorise(cafopId: string): Promise<Garde> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || !cafopId) return { ok: false, message: "Action non autorisée." };
  let autorise = u.roleReel === "admin" || (u.roleReel === "cafop_admin" && u.portee.cafopId === cafopId);
  // Super Admin CAFOP : écriture sur tout CAFOP de son pays (cloisonnement strict).
  if (!autorise && u.roleReel === "super_admin_cafop") {
    const c = await prisma.cafop.findUnique({ where: { id: cafopId }, select: { pays: true } });
    autorise = ecritureNationaleAutorisee(u, "super_admin_cafop", c?.pays);
  }
  if (!autorise) return { ok: false, message: "Action non autorisée." };
  return { ok: true, u };
}

function jourUTC(dateStr: string): Date {
  const d = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const cheminRegistre = (cafopId: string) => `/app/systeme/cafop/${cafopId}/registre-appel`;

/** Élèves-maîtres réellement rattachés à ce CAFOP (sécurité : on ignore tout id étranger). */
async function apprenantsDuCafop(cafopId: string): Promise<Set<string>> {
  const rows = await prisma.apprenant.findMany({
    where: { cohorte: { cafopId, type: "cafop_promotion" } },
    select: { id: true },
  });
  return new Set(rows.map((a) => a.id));
}

/** Enregistre l'appel : statut + motif par élève, avec le contexte (groupe, heure, module). */
export async function enregistrerAppelCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  const garde = await cafopAutorise(cafopId);
  if (!garde.ok) return { ok: false, message: garde.message };
  const rEssai = refusEssaiPour(garde.u);
  if (rEssai) return { ok: false, message: rEssai };

  const date = jourUTC(String(formData.get("date") ?? "").trim());
  if (Number.isNaN(date.getTime())) return { ok: false, message: "Date invalide." };
  const heureSeance = String(formData.get("heureSeance") ?? "").trim();
  if (!heureSeance) return { ok: false, message: "Choisissez l'heure de la séance avant d'enregistrer." };
  const moduleId = String(formData.get("moduleId") ?? "").trim() || null;
  const discipline = String(formData.get("discipline") ?? "").trim().slice(0, 160) || null;
  // Sécurité : l'enseignant doit être un compte « enseignant » rattaché à CE CAFOP, sinon on ignore.
  let enseignantId = String(formData.get("enseignantId") ?? "").trim() || null;
  if (enseignantId) {
    const ens = await prisma.utilisateur.findFirst({
      where: { id: enseignantId, cafopId, roleActif: { nomTechnique: "enseignant" } },
      select: { id: true },
    });
    if (!ens) enseignantId = null;
  }

  // Sélection MULTIPLE de composantes/thèmes (habiletés) de la séance — champs répétés.
  const composantes = [...new Set(formData.getAll("composantes").map((x) => String(x).trim()).filter(Boolean))].slice(0, 50);
  const themes = [...new Set(formData.getAll("themes").map((x) => String(x).trim()).filter(Boolean))].slice(0, 100);

  const valides = await apprenantsDuCafop(cafopId);
  const STATUTS = new Set(["present", "absent", "retard"]);
  const lignes: { apprenantId: string; statut: string; motif: string | null }[] = [];
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("statut_")) continue;
    const id = k.slice(7);
    if (!valides.has(id)) continue;
    const statut = STATUTS.has(String(v)) ? String(v) : "present";
    const motif = statut === "present" ? null : String(formData.get(`motif_${id}`) ?? "").trim().slice(0, 160) || null;
    lignes.push({ apprenantId: id, statut, motif });
  }
  if (lignes.length === 0) return { ok: false, message: "Aucun élève-maître à enregistrer." };

  try {
    await prisma.$transaction(
      lignes.map((l) =>
        prisma.presenceCafop.upsert({
          where: { apprenantId_date_heureSeance: { apprenantId: l.apprenantId, date, heureSeance } },
          create: {
            apprenantId: l.apprenantId, date, statut: l.statut, motif: l.motif, heureSeance, moduleId, discipline, enseignantId,
            composantes: composantes.length ? composantes : undefined,
            themes: themes.length ? themes : undefined,
          },
          update: {
            statut: l.statut, motif: l.motif, moduleId, discipline, enseignantId,
            composantes: composantes.length ? composantes : undefined,
            themes: themes.length ? themes : undefined,
          },
        }),
      ),
    );
    revalidatePath(cheminRegistre(cafopId));
  } catch (e) {
    console.error("[registre-cafop] enregistrement :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `${lignes.length} présence(s) enregistrée(s).` };
}

/** Justifie toutes les absences/retards non justifiés d'un élève-maître. */
export async function justifierAbsenceCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  const garde = await cafopAutorise(cafopId);
  if (!garde.ok) return { ok: false, message: garde.message };
  const rEssai = refusEssaiPour(garde.u);
  if (rEssai) return { ok: false, message: rEssai };
  const apprenantId = String(formData.get("apprenantId") ?? "").trim();
  const motif = String(formData.get("motif") ?? "").trim().slice(0, 160) || null;

  const ap = await prisma.apprenant.findFirst({ where: { id: apprenantId, cohorte: { cafopId, type: "cafop_promotion" } }, select: { id: true } });
  if (!ap) return { ok: false, message: "Élève-maître introuvable." };

  try {
    const r = await prisma.presenceCafop.updateMany({
      where: { apprenantId, statut: { in: ["absent", "retard"] }, justifie: false },
      data: { justifie: true, ...(motif ? { motif } : {}) },
    });
    revalidatePath(cheminRegistre(cafopId));
    return { ok: true, message: `${r.count} absence(s)/retard(s) justifié(s).` };
  } catch (e) {
    console.error("[registre-cafop] justification :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Enregistre un événement de conduite (encouragement / observation / infirmerie). */
export async function enregistrerEvenementCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  const garde = await cafopAutorise(cafopId);
  if (!garde.ok) return { ok: false, message: garde.message };
  const rEssai = refusEssaiPour(garde.u);
  if (rEssai) return { ok: false, message: rEssai };
  const type = String(formData.get("type") ?? "").trim();
  if (!["encouragement", "observation", "infirmerie"].includes(type)) return { ok: false, message: "Type invalide." };
  const apprenantId = String(formData.get("apprenantId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  if (!description) return { ok: false, message: "La description est obligatoire." };
  const groupe = String(formData.get("groupe") ?? "").trim() || null;
  const heureSeance = String(formData.get("heureSeance") ?? "").trim() || null;
  const accompagnateur = type === "infirmerie" ? String(formData.get("accompagnateur") ?? "").trim().slice(0, 120) || null : null;
  const date = jourUTC(String(formData.get("date") ?? "").trim());

  const ap = await prisma.apprenant.findFirst({ where: { id: apprenantId, cohorte: { cafopId, type: "cafop_promotion" } }, select: { id: true } });
  if (!ap) return { ok: false, message: "Élève-maître introuvable." };

  try {
    await prisma.evenementPresenceCafop.create({
      data: { type, apprenantId, groupe, date, heureSeance, description, accompagnateur, saisiParId: garde.u.id },
    });
    revalidatePath(cheminRegistre(cafopId));
    const libelle = type === "encouragement" ? "Encouragement" : type === "observation" ? "Observation" : "Passage à l'infirmerie";
    return { ok: true, message: `${libelle} enregistré.` };
  } catch (e) {
    console.error("[registre-cafop] événement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Suggestion de description (déterministe, à partir du profil — repli si pas d'IA configurée). */
export async function suggestionEvenementCafop(params: { cafopId: string; apprenantId: string; type: string }): Promise<{ ok: boolean; texte?: string; message?: string }> {
  const garde = await cafopAutorise(params.cafopId);
  if (!garde.ok) return { ok: false, message: garde.message };
  const ap = await prisma.apprenant.findFirst({
    where: { id: params.apprenantId, cohorte: { cafopId: params.cafopId, type: "cafop_promotion" } },
    select: { nom: true, prenoms: true },
  });
  if (!ap) return { ok: false, message: "Introuvable." };
  const nom = [ap.nom, ap.prenoms].filter(Boolean).join(" ") || "L'élève-maître";
  const texte =
    params.type === "encouragement"
      ? `${nom} fait preuve d'assiduité et d'implication dans la formation ; ces efforts méritent d'être encouragés et poursuivis.`
      : params.type === "observation"
        ? `Comportement à recadrer concernant ${nom} : rappeler les règles de la classe et assurer un suivi lors des prochaines séances.`
        : `${nom} a été conduit(e) à l'infirmerie. Préciser les symptômes constatés et informer la vie scolaire du centre.`;
  return { ok: true, texte };
}

/** Envoie un SMS aux élèves-maîtres sélectionnés (sur leur propre numéro). */
export async function envoyerSmsCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  const garde = await cafopAutorise(cafopId);
  if (!garde.ok) return { ok: false, message: garde.message };
  const rEssai = refusEssaiPour(garde.u);
  if (rEssai) return { ok: false, message: rEssai };

  let ids: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("apprenantIds") ?? "[]"));
    if (Array.isArray(parsed)) ids = parsed.map((x) => String(x)).slice(0, 500);
  } catch {
    ids = [];
  }
  if (ids.length === 0) return { ok: false, message: "Aucun élève-maître sélectionné." };
  const messagePerso = String(formData.get("message") ?? "").trim().slice(0, 320) || null;

  const [cafop, apprenants] = await Promise.all([
    prisma.cafop.findUnique({ where: { id: cafopId }, select: { nom: true, pays: true } }),
    prisma.apprenant.findMany({
      where: { id: { in: ids }, cohorte: { cafopId } },
      select: { id: true, nom: true, prenoms: true, telephone: true },
    }),
  ]);
  const counts = await prisma.presenceCafop.groupBy({
    by: ["apprenantId"],
    where: { apprenantId: { in: apprenants.map((a) => a.id) }, statut: { in: ["absent", "retard"] }, justifie: false },
    _count: { _all: true },
  });
  const nbParApprenant = new Map(counts.map((c) => [c.apprenantId, c._count._all]));

  let envoyes = 0;
  let sansTel = 0;
  try {
    for (const a of apprenants) {
      if (!a.telephone) {
        sansTel++;
        continue;
      }
      const nom = [a.nom, a.prenoms].filter(Boolean).join(" ");
      const nb = nbParApprenant.get(a.id) ?? 0;
      const contenu =
        messagePerso ??
        `EduWeb Planner — ${cafop?.nom ?? "CAFOP"} : ${nom} totalise ${nb} absence(s)/retard(s) non justifié(s). Merci de régulariser auprès du centre.`;
      const statut = await envoyerSMS(a.telephone, contenu);
      await prisma.alerteSMS.create({
        data: { etablissementNom: cafop?.nom ?? null, pays: cafop?.pays ?? null, telephone: a.telephone, contenu, type: "absence", statut, envoyeParEmail: garde.u.email },
      });
      if (statut !== "echec") envoyes++;
    }
    revalidatePath(cheminRegistre(cafopId));
  } catch (e) {
    console.error("[registre-cafop] SMS :", e);
    return { ok: false, message: "Erreur technique lors de l'envoi." };
  }
  return { ok: true, message: `${envoyes} SMS envoyé(s)${sansTel ? ` · ${sansTel} sans numéro` : ""}.` };
}

/** Export CSV du registre (effectifs, cumuls d'absences/retards non justifiés, conduite /20). */
export async function exporterRegistreCafop(params: { cafopId: string; groupe?: string | null }): Promise<{ ok: boolean; csv?: string; nom?: string; message?: string }> {
  const garde = await cafopAutorise(params.cafopId);
  if (!garde.ok) return { ok: false, message: garde.message };
  const groupe = params.groupe?.trim() || null;

  const apprenants = await prisma.apprenant.findMany({
    where: { cohorte: { cafopId: params.cafopId, type: "cafop_promotion" }, ...(groupe ? { groupe } : {}) },
    orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
    select: { id: true, nom: true, prenoms: true, matricule: true, sexe: true, groupe: true },
  });
  const ids = apprenants.map((a) => a.id);
  const [presences, evenements] = await Promise.all([
    prisma.presenceCafop.findMany({ where: { apprenantId: { in: ids } }, select: { apprenantId: true, statut: true, justifie: true } }),
    prisma.evenementPresenceCafop.groupBy({ by: ["apprenantId", "type"], where: { apprenantId: { in: ids } }, _count: { _all: true } }),
  ]);

  const agg = new Map<string, { absNj: number; retNj: number; obs: number; enc: number }>();
  for (const id of ids) agg.set(id, { absNj: 0, retNj: 0, obs: 0, enc: 0 });
  for (const p of presences) {
    const a = agg.get(p.apprenantId);
    if (!a || p.justifie) continue;
    if (p.statut === "absent") a.absNj++;
    else if (p.statut === "retard") a.retNj++;
  }
  for (const e of evenements) {
    const a = agg.get(e.apprenantId);
    if (!a) continue;
    if (e.type === "observation") a.obs += e._count._all;
    else if (e.type === "encouragement") a.enc += e._count._all;
  }

  const cell = (s: string) => (/[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const entete = ["N°", "Matricule", "Nom et prénoms", "Sexe", "Classe", "Absences NJ", "Retards NJ", "Conduite /20"];
  const lignes = apprenants.map((a, i) => {
    const g = agg.get(a.id)!;
    const conduite = conduiteSur20(g.absNj, g.retNj, g.obs, g.enc);
    return [
      String(i + 1),
      a.matricule ?? "",
      [a.nom, a.prenoms].filter(Boolean).join(" "),
      a.sexe ?? "",
      a.groupe ?? "",
      String(g.absNj),
      String(g.retNj),
      conduite.toFixed(2).replace(".", ","),
    ].map(cell);
  });
  const csv = "﻿" + [entete.map(cell), ...lignes].map((r) => r.join(";")).join("\r\n");
  return { ok: true, csv, nom: `registre-appel-cafop-${groupe ?? "tous"}.csv` };
}
