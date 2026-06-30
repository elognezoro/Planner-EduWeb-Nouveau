import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { StructureForm, StructureLien } from "@/components/app/formation/components";

export const metadata: Metadata = { title: "CAFOP" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

export default async function CafopPage() {
  const u = await requireRole(["admin", "cafop_admin"]);

  // cafop_admin : redirigé vers le détail de son centre.
  if (u.roleReel === "cafop_admin") {
    if (u.portee.cafopId) redirect(`${BASE}/${u.portee.cafopId}`);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre="CAFOP" description="Gestion des promotions d'élèves-maîtres." />
        <Card>
          <p className="text-sm text-ink-700/70">{"Aucun CAFOP n'est rattaché à votre compte."}</p>
        </Card>
      </div>
    );
  }

  let cafops: { id: string; nom: string; region: string | null; cohortes: number }[] = [];
  let regions: { id: string; nom: string }[] = [];
  let erreur = false;
  try {
    const [liste, regs] = await Promise.all([
      prisma.cafop.findMany({
        orderBy: { nom: "asc" },
        select: { id: true, nom: true, region: { select: { nom: true } }, _count: { select: { cohortes: true } } },
      }),
      prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    ]);
    cafops = liste.map((c) => ({ id: c.id, nom: c.nom, region: c.region?.nom ?? null, cohortes: c._count.cohortes }));
    regions = regs;
  } catch (e) {
    console.error("[cafop] chargement :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="CAFOP"
        description="Centres d'Animation et de Formation Pédagogique — promotions d'élèves-maîtres."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les CAFOP.</p>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Nouveau CAFOP</h2>
            <StructureForm type="cafop" regions={regions} />
          </Card>

          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-forest-900">
              CAFOP enregistrés ({cafops.length})
            </h2>
            {cafops.length === 0 ? (
              <Card>
                <p className="flex items-center gap-2 text-sm text-ink-700/60">
                  <GraduationCap size={16} /> Aucun CAFOP. Créez-en un ci-dessus.
                </p>
              </Card>
            ) : (
              cafops.map((c) => (
                <StructureLien key={c.id} base={BASE} id={c.id} nom={c.nom} region={c.region} cohortes={c.cohortes} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
