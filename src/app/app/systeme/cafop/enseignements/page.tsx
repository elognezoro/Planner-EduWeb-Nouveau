import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { PageHeader, Card } from "@/components/app/ui";
import { EnseignementsCafop, type ModuleVue, type CentreLite } from "./enseignements-cafop";

export const metadata: Metadata = { title: "CAFOP — Enseignements & Évaluation" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";
/** Régime de formation des élèves-maîtres : 2 semestres par année. */
const SEMESTRES = 2;

export default async function EnseignementsCafopPage() {
  const u = await requireRole(["admin", "cafop_admin"]);

  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);
  const T = (s: string) => appliquerTerme(s, terme);

  if (u.roleReel === "cafop_admin") {
    if (u.portee.cafopId) redirect(`${BASE}/${u.portee.cafopId}`);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre={T("CAFOP")} description="Notes & bulletins des élèves-maîtres." />
        <Card>
          <p className="text-sm text-ink-700/70">{T("Aucun CAFOP n'est rattaché à votre compte.")}</p>
        </Card>
      </div>
    );
  }

  let modules: ModuleVue[] = [];
  let centres: CentreLite[] = [];
  let regions: { id: string; nom: string }[] = [];
  let erreur = false;
  try {
    const [mods, liste, regs] = await Promise.all([
      prisma.moduleCafop.findMany({
        orderBy: [{ annee: "asc" }, { ordre: "asc" }, { creeLe: "asc" }],
        select: {
          id: true, nom: true, code: true, ordre: true, actif: true, coefficient: true,
          annee: true, semestre: true, dateDebut: true, dateFin: true, datePretest: true, dateEvaluation: true,
        },
      }),
      prisma.cafop.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true, drena: true, pays: true } }),
      prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    ]);
    const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    modules = mods.map((m) => ({
      id: m.id,
      nom: m.nom,
      code: m.code,
      ordre: m.ordre,
      actif: m.actif,
      coefficient: m.coefficient,
      annee: m.annee,
      semestre: m.semestre,
      dateDebut: jour(m.dateDebut),
      dateFin: jour(m.dateFin),
      datePretest: jour(m.datePretest),
      dateEvaluation: jour(m.dateEvaluation),
    }));
    centres = liste;
    regions = regs;
  } catch (e) {
    console.error("[cafop-enseignements] chargement :", e);
    erreur = true;
  }

  if (erreur) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre={T("Gestion des CAFOP")} />
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les données.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <EnseignementsCafop modules={modules} centres={centres} regions={regions} semestres={SEMESTRES} terme={terme} />
    </div>
  );
}
