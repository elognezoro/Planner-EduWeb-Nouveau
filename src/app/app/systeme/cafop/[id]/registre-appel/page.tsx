import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop, termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { chargerPlanFormation } from "@/lib/formation/plan-formation-data";
import { Card } from "@/components/app/ui";
import { EnteteCafop } from "../../entete-cafop";
import { SousEnteteCafop, sousTitreCafop } from "../sous-entete";
import { conduiteSur20, SEUIL_ALERTE_SMS, JOURS_SEMAINE } from "./lib";
import { RegistreAppelCafop, type EleveAppel, type PresenceVue, type CelluleHeatmap } from "./vue";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTerme("CAFOP — Registre d'appel", await termeCafopCourant()) };
}
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";
const jour = (d: Date) => d.toISOString().slice(0, 10);

export default async function RegistreAppelPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "cafop_admin"]);
  const { id } = await params;
  if (u.roleReel === "cafop_admin" && u.portee.cafopId !== id) redirect(BASE);

  const cafop = await prisma.cafop.findUnique({ where: { id }, select: { id: true, nom: true, drena: true, pays: true } });
  if (!cafop) redirect(BASE);

  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);
  const [promotions, elevesRaw, presencesRaw, evenementsBruts, regions, nbCentres, modules, enseignantsRaw, plan] = await Promise.all([
    prisma.cohorte.findMany({
      where: { cafopId: id, type: "cafop_promotion" },
      orderBy: [{ anneeDebut: "desc" }, { creeLe: "desc" }],
      select: { id: true, libelle: true },
    }),
    prisma.apprenant.findMany({
      where: { cohorte: { cafopId: id, type: "cafop_promotion" } },
      orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
      select: { id: true, nom: true, prenoms: true, matricule: true, sexe: true, dateNaissance: true, telephone: true, groupe: true, annee: true, cohorteId: true },
    }),
    prisma.presenceCafop.findMany({
      where: { apprenant: { cohorte: { cafopId: id, type: "cafop_promotion" } } },
      select: { apprenantId: true, date: true, statut: true, motif: true, justifie: true, heureSeance: true },
    }),
    prisma.evenementPresenceCafop.groupBy({
      by: ["apprenantId", "type"],
      where: { apprenant: { cohorte: { cafopId: id, type: "cafop_promotion" } } },
      _count: { _all: true },
    }),
    prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count({ where: { pays } }),
    prisma.moduleCafop.findMany({ where: { actif: true }, orderBy: [{ annee: "asc" }, { ordre: "asc" }, { creeLe: "asc" }], select: { id: true, nom: true, annee: true } }),
    prisma.utilisateur.findMany({
      where: { cafopId: id, roleActif: { nomTechnique: "enseignant" } },
      orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
      select: { id: true, nom: true, prenoms: true },
    }),
    chargerPlanFormation(pays),
  ]);

  // Enseignants (comptes « enseignant » du centre) et disciplines (plan de formation du pays).
  const enseignants = enseignantsRaw.map((e) => ({ id: e.id, nom: [e.nom, e.prenoms].filter(Boolean).join(" ") || e.id }));
  const disciplinesSet = new Set<string>();
  for (const sec of plan?.sections ?? []) {
    const iDisc = sec.colonnes.findIndex((c) => /disciplin/i.test(c));
    if (iDisc < 0) continue;
    for (const l of sec.lignes) if (l.type === "donnee" && l.cellules[iDisc]?.trim()) disciplinesSet.add(l.cellules[iDisc].trim());
  }
  const disciplines = [...disciplinesSet].sort((a, b) => a.localeCompare(b));

  // Événements par élève-maître (observations / encouragements) → entrent dans la conduite.
  const evenementsPar = new Map<string, { obs: number; enc: number; inf: number }>();
  for (const ev of evenementsBruts) {
    const e = evenementsPar.get(ev.apprenantId) ?? { obs: 0, enc: 0, inf: 0 };
    if (ev.type === "observation") e.obs += ev._count._all;
    else if (ev.type === "encouragement") e.enc += ev._count._all;
    else if (ev.type === "infirmerie") e.inf += ev._count._all;
    evenementsPar.set(ev.apprenantId, e);
  }

  // Cumuls d'assiduité NON JUSTIFIÉS par élève-maître (toutes séances confondues).
  const cumuls = new Map<string, { a: number; r: number }>();
  for (const p of presencesRaw) {
    if (p.justifie) continue;
    const c = cumuls.get(p.apprenantId) ?? { a: 0, r: 0 };
    if (p.statut === "absent") c.a += 1;
    else if (p.statut === "retard") c.r += 1;
    cumuls.set(p.apprenantId, c);
  }

  const dateNaissanceLabel = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d) : null;

  const eleves: EleveAppel[] = elevesRaw.map((e) => {
    const c = cumuls.get(e.id) ?? { a: 0, r: 0 };
    const ev = evenementsPar.get(e.id) ?? { obs: 0, enc: 0, inf: 0 };
    const aNj = c.a + c.r;
    return {
      id: e.id,
      nom: e.nom,
      prenoms: e.prenoms,
      matricule: e.matricule,
      sexe: e.sexe,
      naissanceLabel: dateNaissanceLabel(e.dateNaissance),
      groupe: e.groupe,
      annee: e.annee,
      promotionId: e.cohorteId,
      aTelephone: Boolean(e.telephone),
      cumulA: c.a,
      cumulR: c.r,
      aNj,
      obs: ev.obs,
      enc: ev.enc,
      inf: ev.inf,
      conduite: conduiteSur20(c.a, c.r, ev.obs, ev.enc),
      // Seuil libellé « absences » : l'alerte se déclenche sur les absences NON justifiées.
      alerte: c.a >= SEUIL_ALERTE_SMS,
    };
  });

  const presences: PresenceVue[] = presencesRaw.map((p) => ({
    apprenantId: p.apprenantId,
    date: jour(p.date),
    statut: p.statut,
    motif: p.motif,
    justifie: p.justifie,
  }));

  const groupes = [...new Set(elevesRaw.map((e) => e.groupe).filter(Boolean))].sort() as string[];

  // Heatmap : taux de présence moyen par jour de semaine × heure de séance réellement saisie.
  const agg = new Map<string, { present: number; total: number }>();
  const heuresSet = new Set<string>();
  for (const p of presencesRaw) {
    if (!p.heureSeance) continue;
    const jourIdx = (p.date.getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche
    if (jourIdx > 5) continue;
    heuresSet.add(p.heureSeance);
    const cle = `${jourIdx}|${p.heureSeance}`;
    const cell = agg.get(cle) ?? { present: 0, total: 0 };
    if (p.statut !== "absent") cell.present += 1;
    cell.total += 1;
    agg.set(cle, cell);
  }
  const heures = [...heuresSet].sort();
  const heatmap: CelluleHeatmap[] = [];
  JOURS_SEMAINE.forEach((jourNom, jourIdx) => {
    for (const heure of heures) {
      const cell = agg.get(`${jourIdx}|${heure}`);
      heatmap.push({
        jour: jourNom,
        heure,
        taux: cell && cell.total > 0 ? Math.round((cell.present / cell.total) * 100) : null,
      });
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} terme={terme} />
      <SousEnteteCafop cafopId={cafop.id} nom={cafop.nom} sousTitre={sousTitreCafop(cafop, promotions.length, eleves.length)} actif="appel" terme={terme} />
      {promotions.length === 0 ? (
        <Card><p className="text-sm text-ink-700/70">{`Aucune promotion. Créez-en une dans « ${appliquerTerme("Configurer le CAFOP", terme)} ».`}</p></Card>
      ) : (
        <RegistreAppelCafop
          cafopId={cafop.id}
          cafopNom={cafop.nom}
          promotions={promotions}
          modules={modules}
          groupes={groupes}
          eleves={eleves}
          presences={presences}
          heatmap={heatmap}
          heures={heures}
          disciplines={disciplines}
          enseignants={enseignants}
          defaultDate={jour(new Date())}
        />
      )}
    </div>
  );
}
