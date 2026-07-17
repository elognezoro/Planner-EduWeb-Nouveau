import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { PageHeader, Card } from "@/components/app/ui";
import {
  VueMaitreStages,
  type StagiaireVue,
  type ModuleApplicableVue,
  type GrilleVue,
  type CritereVue,
  type DemandeVue,
  type DialogueVue,
  type VisiteVue,
  type PresenceLigneVue,
} from "./vue-maitre";

export const metadata: Metadata = { title: "Mes stagiaires" };
export const dynamic = "force-dynamic";

const dateLabel = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d);
const dateHeureLabel = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);
const jour = (d: Date) => d.toISOString().slice(0, 10);

/** Parse défensif du JSON `composantes` d'un ModuleCafop : [{ nom, themes: [] }]. */
function parseComposantes(json: unknown): { nom: string; themes: string[] }[] {
  if (!Array.isArray(json)) return [];
  const out: { nom: string; themes: string[] }[] = [];
  for (const c of json) {
    if (!c || typeof c !== "object") continue;
    const nom = String((c as { nom?: unknown }).nom ?? "").trim();
    if (!nom) continue;
    const themesBrut = (c as { themes?: unknown }).themes;
    const themes = Array.isArray(themesBrut) ? themesBrut.map((t) => String(t).trim()).filter(Boolean) : [];
    out.push({ nom, themes });
  }
  return out;
}

/** Parse défensif du JSON `criteres` d'une EvaluationStage : [{ critere, note, sur }]. */
function parseCriteres(json: unknown): CritereVue[] {
  if (!Array.isArray(json)) return [];
  const out: CritereVue[] = [];
  for (const c of json) {
    if (!c || typeof c !== "object") continue;
    const critere = String((c as { critere?: unknown }).critere ?? "").trim();
    const note = Number((c as { note?: unknown }).note);
    const sur = Number((c as { sur?: unknown }).sur) || 20;
    if (!critere || Number.isNaN(note)) continue;
    out.push({ critere, note, sur });
  }
  return out;
}

export default async function EspaceMaitreStagesPage() {
  const u = await requireRole(["maitre_application"]);
  const cafopId = u.portee.cafopId;

  if (!cafopId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader titre="Mes stagiaires" description="Suivi des élèves-maîtres en stage pratique." />
        <Card><p className="text-sm text-ink-700/70">Aucun CAFOP rattaché.</p></Card>
      </div>
    );
  }

  const cafop = await prisma.cafop.findUnique({ where: { id: cafopId }, select: { nom: true, pays: true } });
  if (!cafop) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader titre="Mes stagiaires" description="Suivi des élèves-maîtres en stage pratique." />
        <Card><p className="text-sm text-ink-700/70">CAFOP introuvable.</p></Card>
      </div>
    );
  }
  const terme = await libelleCafop(cafop.pays);

  // ── Mes attributions (stagiaires qui me sont attribués), groupées par année de formation. ──
  const attributions = await prisma.attributionStagiaire.findMany({
    where: { maitreId: u.id },
    include: {
      apprenant: { select: { id: true, nom: true, prenoms: true, matricule: true } },
      module: { select: { id: true, nom: true, composantes: true } },
    },
    orderBy: [{ annee: "asc" }, { creeLe: "asc" }],
  });
  const stagiaireIds = [...new Set(attributions.map((a) => a.apprenantId))];

  // ── Modules « stage » du CAFOP (utilisés quand l'attribution ne cible pas un stage précis). ──
  // Note : `in: []` est un no-op sûr côté Prisma (retourne aussitôt un tableau vide), donc ces
  // requêtes restent lancées inconditionnellement — cela évite toute divergence de type entre
  // deux branches d'un ternaire pour le même Promise.all.
  const modulesStageRaw = await prisma.moduleCafop.findMany({
    where: { estStage: true },
    orderBy: [{ annee: "asc" }, { ordre: "asc" }],
    select: { id: true, nom: true, annee: true, composantes: true },
  });
  const modulesParAnnee = new Map<number, ModuleApplicableVue[]>();
  for (const m of modulesStageRaw) {
    const arr = modulesParAnnee.get(m.annee) ?? [];
    arr.push({ id: m.id, nom: m.nom, composantes: parseComposantes(m.composantes) });
    modulesParAnnee.set(m.annee, arr);
  }

  const [presencesRaw, dialoguesRaw, visitesRaw, evaluationsMaitreRaw, evaluationsProfRaw] = await Promise.all([
    prisma.presenceCafop.findMany({
      where: { apprenantId: { in: stagiaireIds } },
      orderBy: { date: "desc" },
      take: 400,
      select: { apprenantId: true, date: true, statut: true, motif: true, heureSeance: true },
    }),
    prisma.dialogueStage.findMany({
      where: { apprenantId: { in: stagiaireIds } },
      orderBy: { creeLe: "asc" },
      select: { id: true, apprenantId: true, auteurNom: true, duMaitre: true, contenu: true, creeLe: true },
    }),
    prisma.visiteStagiaire.findMany({
      where: { apprenantId: { in: stagiaireIds } },
      orderBy: { date: "desc" },
      select: {
        id: true, apprenantId: true, professeur: true, date: true, ecole: true, objet: true,
        observations: true, recommandations: true, noteGlobale: true,
      },
    }),
    prisma.evaluationStage.findMany({
      where: { apprenantId: { in: stagiaireIds }, evaluateurType: "maitre_application" },
      select: {
        id: true, apprenantId: true, moduleId: true, criteres: true, noteGlobale: true,
        sur: true, appreciation: true, evaluateurNom: true, majLe: true,
      },
    }),
    prisma.evaluationStage.findMany({
      where: { apprenantId: { in: stagiaireIds }, evaluateurType: "prof_cafop" },
      select: {
        apprenantId: true, moduleId: true, criteres: true, noteGlobale: true,
        sur: true, appreciation: true, evaluateurNom: true, majLe: true,
      },
    }),
  ]);

  // Mes demandes de modification (une grille MODIFIÉE crée une demande dont la cible est
  // l'EvaluationStage : on relie chaque demande à son stagiaire via cette cible).
  const demandesRaw = await prisma.demandeModificationCafop.findMany({
    where: { demandeurId: u.id },
    orderBy: { creeLe: "desc" },
    select: { id: true, cibleId: true, cibleLibelle: true, motif: true, statut: true, motifDecision: true, creeLe: true, decideLe: true },
  });
  const evalIdVersApprenant = new Map(evaluationsMaitreRaw.map((e) => [e.id, e.apprenantId]));

  const grouper = <T, K>(items: T[], cle: (t: T) => K) => {
    const m = new Map<K, T[]>();
    for (const it of items) {
      const k = cle(it);
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    }
    return m;
  };

  const presencesParApprenant = grouper(presencesRaw, (p) => p.apprenantId);
  const dialoguesParApprenant = grouper(dialoguesRaw, (d) => d.apprenantId);
  const visitesParApprenant = grouper(visitesRaw, (v) => v.apprenantId);
  const grillesMaitreParApprenant = grouper(evaluationsMaitreRaw, (e) => e.apprenantId);
  const grillesProfParApprenant = grouper(evaluationsProfRaw, (e) => e.apprenantId);
  const demandesParApprenant = new Map<string, DemandeVue[]>();
  for (const d of demandesRaw) {
    const apprenantId = evalIdVersApprenant.get(d.cibleId);
    if (!apprenantId) continue;
    const arr = demandesParApprenant.get(apprenantId) ?? [];
    arr.push({
      id: d.id,
      libelle: d.cibleLibelle ?? "Grille d'évaluation",
      motif: d.motif,
      statut: d.statut as DemandeVue["statut"],
      motifDecision: d.motifDecision,
      dateLabel: dateHeureLabel(d.creeLe),
      decideLeLabel: d.decideLe ? dateHeureLabel(d.decideLe) : null,
    });
    demandesParApprenant.set(apprenantId, arr);
  }

  const versGrilleVue = (e: {
    moduleId: string; criteres: unknown; noteGlobale: number; sur: number;
    appreciation: string | null; evaluateurNom: string | null; majLe: Date;
  }): GrilleVue => ({
    moduleId: e.moduleId,
    criteres: parseCriteres(e.criteres),
    noteGlobale: e.noteGlobale,
    sur: e.sur,
    appreciation: e.appreciation,
    evaluateurNom: e.evaluateurNom,
    majLeLabel: dateLabel(e.majLe),
  });

  const stagiaires: StagiaireVue[] = attributions.map((attr) => {
    const modulesApplicables: ModuleApplicableVue[] = attr.module
      ? [{ id: attr.module.id, nom: attr.module.nom, composantes: parseComposantes(attr.module.composantes) }]
      : modulesParAnnee.get(attr.annee) ?? [];

    const presencesStagiaire = presencesParApprenant.get(attr.apprenantId) ?? [];
    const present = presencesStagiaire.filter((p) => p.statut === "present").length;
    const absent = presencesStagiaire.filter((p) => p.statut === "absent").length;
    const retard = presencesStagiaire.filter((p) => p.statut === "retard").length;
    const total = presencesStagiaire.length;

    const presences: PresenceLigneVue[] = presencesStagiaire.map((p) => ({
      dateLabel: dateLabel(p.date),
      heureSeance: p.heureSeance ?? "Journée",
      statut: p.statut,
      motif: p.motif,
    }));

    const dialogues: DialogueVue[] = (dialoguesParApprenant.get(attr.apprenantId) ?? []).map((d) => ({
      id: d.id,
      auteurNom: d.auteurNom ?? "—",
      duMaitre: d.duMaitre,
      contenu: d.contenu,
      dateLabel: dateHeureLabel(d.creeLe),
    }));

    const visites: VisiteVue[] = (visitesParApprenant.get(attr.apprenantId) ?? []).map((v) => ({
      id: v.id,
      professeur: v.professeur,
      dateLabel: dateLabel(v.date),
      ecole: v.ecole,
      objet: v.objet,
      observations: v.observations,
      recommandations: v.recommandations,
      noteGlobale: v.noteGlobale,
    }));

    return {
      attributionId: attr.id,
      apprenantId: attr.apprenantId,
      nom: attr.apprenant.nom,
      prenoms: attr.apprenant.prenoms,
      matricule: attr.apprenant.matricule,
      annee: attr.annee,
      modulesApplicables,
      presences,
      regularite: { pct: total > 0 ? Math.round((present / total) * 100) : 0, present, absent, retard, total },
      dialogues,
      visites,
      grillesMaitre: (grillesMaitreParApprenant.get(attr.apprenantId) ?? []).map(versGrilleVue),
      grillesProf: (grillesProfParApprenant.get(attr.apprenantId) ?? []).map(versGrilleVue),
      demandes: demandesParApprenant.get(attr.apprenantId) ?? [],
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <VueMaitreStages
        cafopId={cafopId}
        cafopNom={appliquerTerme(cafop.nom, terme)}
        terme={terme}
        stagiaires={stagiaires}
        defaultDate={jour(new Date())}
      />
    </div>
  );
}
