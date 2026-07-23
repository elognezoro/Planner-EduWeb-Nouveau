import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { peutAdministrerCafop, estLectureSeuleCafop } from "@/lib/rbac/scope";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop, termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { estDirectionStages } from "@/lib/formation/stages-actions";
import { composantesDepuisJson } from "@/lib/formation/structure-module";
import { EnteteCafop } from "../../entete-cafop";
import { SousEnteteCafop, sousTitreCafop } from "../sous-entete";
import {
  StagesCafop,
  type MaitreVue,
  type StageModuleVue,
  type AttributionVue,
  type ApprenantVue,
  type DialogueVue,
  type VisiteVue,
  type EvaluationVue,
  type DemandeVue,
  type RegulariteVue,
  type EnseignantVue,
} from "./stages-vue";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTerme("CAFOP — Stages pratiques", await termeCafopCourant()) };
}
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

// Structure [Compétence →] Composante → Thème d'un module : parseur partagé
// `composantesDepuisJson` (src/lib/formation/structure-module.ts), identique au cahier de texte.

/** Grille de critères d'une évaluation de stage : [{ critere, note, sur }]. */
const toCriteres = (v: unknown): { critere: string; note: number; sur: number }[] =>
  Array.isArray(v)
    ? v
        .map((c) => ({
          critere: String((c as { critere?: unknown })?.critere ?? ""),
          note: Number((c as { note?: unknown })?.note) || 0,
          sur: Number((c as { sur?: unknown })?.sur) || 20,
        }))
        .filter((c) => c.critere)
    : [];

export default async function StagesPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "superviseur_international", "super_admin_cafop", "representant_pays", "cafop_admin", "adc", "delc"]);
  const { id } = await params;

  const cafop = await prisma.cafop.findUnique({ where: { id }, select: { id: true, nom: true, drena: true, pays: true } });
  if (!cafop) redirect(BASE);
  // Périmètre : admin (tous), cafop_admin & adc (leur centre), super_admin_cafop/delc (les CAFOP de leur pays).
  if (!peutAdministrerCafop(u.portee, id, cafop.pays)) redirect(BASE);
  const lectureSeule = estLectureSeuleCafop(u.roleActif); // masque l'import/création de CAFOP au niveau de l'en-tête
  const masquerConfig = u.roleActif === "adc";
  // Exception documentée : l'ADC ÉCRIT dans le module Stages (attribution + autorisation des modifications),
  // au même titre que le Directeur (cafop_admin) et le Super Admin CAFOP de son pays.
  const peutEcrire = await estDirectionStages(u, cafop.id);

  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);

  const [
    maitresRaw,
    attributionsRaw,
    apprenantsRaw,
    stagesRaw,
    dialoguesRaw,
    visitesRaw,
    evaluationsRaw,
    demandesRaw,
    enseignantsRaw,
    nbPromos,
    regions,
    nbCentres,
  ] = await Promise.all([
    prisma.utilisateur.findMany({
      where: { cafopId: id, roleActif: { nomTechnique: "maitre_application" }, statutCompte: "actif" },
      select: { id: true, prenoms: true, nom: true, email: true },
      orderBy: [{ nom: "asc" }],
    }),
    prisma.attributionStagiaire.findMany({
      where: { cafopId: id },
      include: {
        apprenant: { select: { id: true, nom: true, prenoms: true, matricule: true, annee: true, groupe: true } },
        module: { select: { nom: true } },
      },
      orderBy: { creeLe: "desc" },
    }),
    prisma.apprenant.findMany({
      where: { cohorte: { cafopId: id, type: "cafop_promotion" } },
      select: { id: true, nom: true, prenoms: true, matricule: true, annee: true, groupe: true },
      orderBy: [{ nom: "asc" }],
    }),
    prisma.moduleCafop.findMany({
      where: { estStage: true },
      orderBy: { annee: "asc" },
      select: { id: true, nom: true, annee: true, composantes: true },
    }),
    prisma.dialogueStage.findMany({ where: { cafopId: id }, orderBy: { creeLe: "desc" }, take: 200 }),
    prisma.visiteStagiaire.findMany({ where: { cafopId: id }, orderBy: { date: "desc" }, take: 200 }),
    prisma.evaluationStage.findMany({ where: { cafopId: id }, orderBy: { creeLe: "desc" }, take: 200 }),
    prisma.demandeModificationCafop.findMany({ where: { cafopId: id }, orderBy: { creeLe: "desc" }, take: 200 }),
    prisma.enseignantCafop.findMany({ where: { cafopId: id }, select: { id: true, nom: true, prenoms: true }, orderBy: [{ nom: "asc" }] }),
    prisma.cohorte.count({ where: { cafopId: id, type: "cafop_promotion" } }),
    prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count({ where: { pays } }),
  ]);

  // Régularité (registre d'appel du stage) par stagiaire ATTRIBUÉ : % de présence.
  const attribuesIds = [...new Set(attributionsRaw.map((a) => a.apprenantId))];
  const groupesPresence = attribuesIds.length
    ? await prisma.presenceCafop.groupBy({
        by: ["apprenantId", "statut"],
        where: { apprenantId: { in: attribuesIds } },
        _count: { _all: true },
      })
    : [];
  const regularite: RegulariteVue[] = attribuesIds.map((apprenantId) => {
    const lignes = groupesPresence.filter((g) => g.apprenantId === apprenantId);
    const presents = lignes.find((l) => l.statut === "present")?._count._all ?? 0;
    const absents = lignes.find((l) => l.statut === "absent")?._count._all ?? 0;
    const retards = lignes.find((l) => l.statut === "retard")?._count._all ?? 0;
    const total = presents + absents + retards;
    return { apprenantId, presents, absents, retards, total, pct: total > 0 ? Math.round((presents / total) * 100) : 0 };
  });

  const maitresNomComplet = new Map(maitresRaw.map((m) => [m.id, [m.prenoms, m.nom].filter(Boolean).join(" ") || m.email]));
  const maitres: MaitreVue[] = maitresRaw.map((m) => ({ id: m.id, nom: maitresNomComplet.get(m.id) ?? m.email }));

  const stages: StageModuleVue[] = stagesRaw.map((s) => ({ id: s.id, nom: s.nom, annee: s.annee, composantes: composantesDepuisJson(s.composantes) }));

  const attributions: AttributionVue[] = attributionsRaw.map((a) => ({
    id: a.id,
    maitreId: a.maitreId,
    maitreNom: maitresNomComplet.get(a.maitreId) ?? "Maître introuvable",
    annee: a.annee,
    moduleId: a.moduleId,
    moduleNom: a.module?.nom ?? null,
    apprenant: {
      id: a.apprenant.id,
      nom: a.apprenant.nom,
      prenoms: a.apprenant.prenoms,
      matricule: a.apprenant.matricule,
      annee: a.apprenant.annee,
      groupe: a.apprenant.groupe,
    },
  }));

  const apprenants: ApprenantVue[] = apprenantsRaw.map((a) => ({ id: a.id, nom: a.nom, prenoms: a.prenoms, matricule: a.matricule, annee: a.annee, groupe: a.groupe }));
  const groupes = [...new Set(apprenantsRaw.map((a) => a.groupe).filter(Boolean))].sort() as string[];

  const dateHeure = (d: Date) => d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const dateSeule = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const dialogues: DialogueVue[] = dialoguesRaw.map((d) => ({
    id: d.id, apprenantId: d.apprenantId, auteurNom: d.auteurNom, duMaitre: d.duMaitre, contenu: d.contenu, creeLeLabel: dateHeure(d.creeLe),
  }));

  const visites: VisiteVue[] = visitesRaw.map((v) => ({
    id: v.id, apprenantId: v.apprenantId, professeur: v.professeur, dateLabel: dateSeule(v.date),
    ecole: v.ecole, objet: v.objet, observations: v.observations, recommandations: v.recommandations, noteGlobale: v.noteGlobale,
  }));

  const evaluations: EvaluationVue[] = evaluationsRaw.map((e) => ({
    id: e.id,
    apprenantId: e.apprenantId,
    moduleId: e.moduleId,
    evaluateurType: e.evaluateurType === "maitre_application" ? "maitre_application" : "prof_cafop",
    evaluateurNom: e.evaluateurNom,
    criteres: toCriteres(e.criteres),
    noteGlobale: e.noteGlobale,
    sur: e.sur,
    appreciation: e.appreciation,
  }));

  const demandes: DemandeVue[] = demandesRaw.map((d) => ({
    id: d.id,
    type: d.type,
    cibleLibelle: d.cibleLibelle,
    demandeurNom: d.demandeurNom,
    motif: d.motif,
    valeurAvant: d.valeurAvant,
    valeurProposee: d.valeurProposee,
    statut: d.statut,
    decideParNom: d.decideParNom,
    decideLeLabel: d.decideLe ? dateHeure(d.decideLe) : null,
    motifDecision: d.motifDecision,
    creeLeLabel: dateHeure(d.creeLe),
  }));

  const enseignants: EnseignantVue[] = enseignantsRaw.map((e) => ({ id: e.id, nom: [e.prenoms, e.nom].filter(Boolean).join(" ") || e.nom }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} terme={terme} lectureSeule={lectureSeule} />
      <SousEnteteCafop cafopId={cafop.id} nom={cafop.nom} sousTitre={sousTitreCafop(cafop, nbPromos, apprenantsRaw.length)} actif="stages" terme={terme} masquerConfig={masquerConfig} />
      <StagesCafop
        cafopId={cafop.id}
        peutEcrire={peutEcrire}
        maitres={maitres}
        stages={stages}
        attributions={attributions}
        apprenants={apprenants}
        groupes={groupes}
        dialogues={dialogues}
        visites={visites}
        evaluations={evaluations}
        demandes={demandes}
        regularite={regularite}
        enseignants={enseignants}
      />
    </div>
  );
}
