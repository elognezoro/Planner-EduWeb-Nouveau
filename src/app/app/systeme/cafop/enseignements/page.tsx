import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { EnseignementsCafop, type ModuleVue, type CentreLite } from "./enseignements-cafop";

export const metadata: Metadata = { title: "CAFOP — Enseignements & Évaluation" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";
/** Régime de formation des élèves-maîtres : 2 semestres par année. */
const SEMESTRES = 2;

export default async function EnseignementsCafopPage() {
  const u = await requireRole(["admin", "cafop_admin"]);

  if (u.roleReel === "cafop_admin") {
    if (u.portee.cafopId) redirect(`${BASE}/${u.portee.cafopId}`);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre="CAFOP" description="Notes & bulletins des élèves-maîtres." />
        <Card>
          <p className="text-sm text-ink-700/70">{"Aucun CAFOP n'est rattaché à votre compte."}</p>
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
      prisma.moduleCafop.findMany({ orderBy: [{ ordre: "asc" }, { creeLe: "asc" }], select: { id: true, nom: true, ordre: true, actif: true } }),
      prisma.cafop.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, drena: true, pays: true } }),
      prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    ]);
    modules = mods;
    centres = liste;
    regions = regs;
  } catch (e) {
    console.error("[cafop-enseignements] chargement :", e);
    erreur = true;
  }

  if (erreur) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre="Gestion des CAFOP" />
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les données.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <EnseignementsCafop modules={modules} centres={centres} regions={regions} semestres={SEMESTRES} />
    </div>
  );
}
