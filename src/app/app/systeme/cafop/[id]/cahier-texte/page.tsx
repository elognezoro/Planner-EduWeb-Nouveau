import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { peutAdministrerCafop } from "@/lib/rbac/scope";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop, termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { chargerPlanFormation } from "@/lib/formation/plan-formation-data";
import { EnteteCafop } from "../../entete-cafop";
import { SousEnteteCafop, sousTitreCafop } from "../sous-entete";
import { CahierTexteCafop, type SeanceVue } from "./vue";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTerme("CAFOP — Cahier de texte", await termeCafopCourant()) };
}
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

export default async function CahierTextePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "cafop_admin", "adc", "delc"]);
  const { id } = await params;

  const cafop = await prisma.cafop.findUnique({ where: { id }, select: { id: true, nom: true, drena: true, pays: true } });
  if (!cafop) redirect(BASE);
  // Périmètre : admin (tous), cafop_admin & adc (leur centre), delc (les CAFOP de son pays).
  if (!peutAdministrerCafop(u.portee, id, cafop.pays)) redirect(BASE);

  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);
  const [modulesRaw, seancesRaw, apprenants, nbPromos, regions, nbCentres, plan] = await Promise.all([
    prisma.moduleCafop.findMany({ where: { actif: true }, orderBy: [{ annee: "asc" }, { ordre: "asc" }, { creeLe: "asc" }], select: { id: true, nom: true, composantes: true } }),
    prisma.seanceCafop.findMany({
      where: { cafopId: id },
      orderBy: { date: "desc" },
      select: {
        id: true, date: true, groupe: true, titre: true, contenu: true,
        moduleId: true, composante: true, theme: true, discipline: true, heureDebut: true, heureFin: true,
        sousTitres: true, objectifs: true, prochaineSeance: true, exercices: true, exercicesUrl: true,
        module: { select: { nom: true } },
      },
    }),
    prisma.apprenant.findMany({ where: { cohorte: { cafopId: id, type: "cafop_promotion" } }, select: { groupe: true } }),
    prisma.cohorte.count({ where: { cafopId: id, type: "cafop_promotion" } }),
    prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count({ where: { pays } }),
    chargerPlanFormation(pays),
  ]);

  const groupes = [...new Set(apprenants.map((a) => a.groupe).filter(Boolean))].sort() as string[];

  // Modules avec leur structure Composante → Thème (cascade de la « Nouvelle séance »).
  const toComposantes = (v: unknown): { nom: string; themes: string[] }[] =>
    Array.isArray(v)
      ? v
          .map((x) => ({
            nom: String((x as { nom?: unknown })?.nom ?? ""),
            themes: Array.isArray((x as { themes?: unknown[] })?.themes) ? (x as { themes: unknown[] }).themes.map((t) => String(t ?? "")).filter(Boolean) : [],
          }))
          .filter((x) => x.nom)
      : [];
  const modules = modulesRaw.map((m) => ({ id: m.id, nom: m.nom, composantes: toComposantes(m.composantes) }));

  // Disciplines proposées : puisées dans le plan de formation du pays + celles déjà saisies.
  const disciplinesSet = new Set<string>();
  for (const sec of plan?.sections ?? []) {
    const iDisc = sec.colonnes.findIndex((c) => /disciplin/i.test(c));
    if (iDisc < 0) continue;
    for (const l of sec.lignes) if (l.type === "donnee" && l.cellules[iDisc]?.trim()) disciplinesSet.add(l.cellules[iDisc].trim());
  }
  for (const s of seancesRaw) if (s.discipline?.trim()) disciplinesSet.add(s.discipline.trim());
  const disciplines = [...disciplinesSet].sort((a, b) => a.localeCompare(b));

  const toSousTitres = (v: unknown): { niveau: number; texte: string }[] =>
    Array.isArray(v)
      ? v.map((e) => ({ niveau: Number((e as { niveau?: unknown })?.niveau) || 1, texte: String((e as { texte?: unknown })?.texte ?? "") })).filter((e) => e.texte)
      : [];
  const toObjectifs = (v: unknown): string[] => (Array.isArray(v) ? v.map((e) => String(e ?? "")).filter(Boolean) : []);
  const heureLabel = (d: string | null, f: string | null) => (d && f ? `${d} – ${f}` : d ?? f ?? null);

  const seances: SeanceVue[] = seancesRaw.map((s) => ({
    id: s.id,
    dateLabel: s.date.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
    moduleNom: s.module?.nom ?? null,
    groupe: s.groupe,
    composante: s.composante,
    theme: s.theme,
    discipline: s.discipline,
    heureLabel: heureLabel(s.heureDebut, s.heureFin),
    titre: s.titre,
    sousTitres: toSousTitres(s.sousTitres),
    objectifs: toObjectifs(s.objectifs),
    contenu: s.contenu,
    prochaineSeanceLabel: s.prochaineSeance ? s.prochaineSeance.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : null,
    exercices: s.exercices,
    exercicesUrl: s.exercicesUrl,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} terme={terme} />
      <SousEnteteCafop cafopId={cafop.id} nom={cafop.nom} sousTitre={sousTitreCafop(cafop, nbPromos, apprenants.length)} actif="cahier" terme={terme} />
      <CahierTexteCafop cafopId={cafop.id} modules={modules} groupes={groupes} seances={seances} disciplines={disciplines} />
    </div>
  );
}
