import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Network } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { StructureForm, StructureLien } from "@/components/app/formation/components";

export const metadata: Metadata = { title: "APFC" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/apfc";

export default async function ApfcPage() {
  const u = await requireRole(["admin", "apfc_admin"]);

  if (u.roleReel === "apfc_admin") {
    if (u.portee.apfcId) redirect(`${BASE}/${u.portee.apfcId}`);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre="APFC" description="Gestion des sessions de formation continue." />
        <Card>
          <p className="text-sm text-ink-700/70">{"Aucune APFC n'est rattachée à votre compte."}</p>
        </Card>
      </div>
    );
  }

  let apfcs: { id: string; nom: string; region: string | null; cohortes: number }[] = [];
  let regions: { id: string; nom: string }[] = [];
  let erreur = false;
  try {
    const [liste, regs] = await Promise.all([
      prisma.apfc.findMany({
        orderBy: { nom: "asc" },
        select: { id: true, nom: true, region: { select: { nom: true } }, _count: { select: { cohortes: true } } },
      }),
      prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    ]);
    apfcs = liste.map((c) => ({ id: c.id, nom: c.nom, region: c.region?.nom ?? null, cohortes: c._count.cohortes }));
    regions = regs;
  } catch (e) {
    console.error("[apfc] chargement :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="APFC"
        description="Antennes Pédagogiques de Formation Continue — sessions de formation des enseignants."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les APFC.</p>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Nouvelle APFC</h2>
            <StructureForm type="apfc" regions={regions} />
          </Card>

          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-forest-900">
              APFC enregistrées ({apfcs.length})
            </h2>
            {apfcs.length === 0 ? (
              <Card>
                <p className="flex items-center gap-2 text-sm text-ink-700/60">
                  <Network size={16} /> Aucune APFC. Créez-en une ci-dessus.
                </p>
              </Card>
            ) : (
              apfcs.map((c) => (
                <StructureLien key={c.id} base={BASE} id={c.id} nom={c.nom} region={c.region} cohortes={c.cohortes} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
