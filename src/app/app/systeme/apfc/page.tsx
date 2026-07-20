import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Network } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreApfcs } from "@/lib/rbac";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleApfc, termeApfcCourant } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { PageHeader, Card } from "@/components/app/ui";
import { StructureForm, StructureLien } from "@/components/app/formation/components";
import { ImportApfcCSV } from "./import-apfc-csv";
import { ReglageTermeApfc } from "./reglage-terme-apfc";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTermeApfc("APFC", await termeApfcCourant()) };
}
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/apfc";

export default async function ApfcPage() {
  const u = await requireRole(["admin", "superviseur_international", "super_admin_apfc", "representant_pays", "apfc_admin"]);

  // Tout le contenu est circonscrit au pays consulté (par défaut, le pays de l'utilisateur).
  const pays = await paysConsulte();
  const terme = await libelleApfc(pays);
  const T = (s: string) => appliquerTermeApfc(s, terme);

  if (u.roleReel === "apfc_admin") {
    if (u.portee.apfcId) redirect(`${BASE}/${u.portee.apfcId}`);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre={T("APFC")} description="Gestion des sessions de formation continue." />
        <Card>
          <p className="text-sm text-ink-700/70">{T("Aucune APFC n'est rattachée à votre compte.")}</p>
        </Card>
      </div>
    );
  }

  // Régions du pays consulté (verrouillé sur son pays pour un rôle à périmètre « pays ») :
  // évite d'exposer les régions des autres pays dans le formulaire « Nouvelle APFC ».
  let apfcs: { id: string; nom: string; region: string | null; cohortes: number }[] = [];
  let regions: { id: string; nom: string }[] = [];
  let erreur = false;
  try {
    const [liste, regs] = await Promise.all([
      prisma.apfc.findMany({
        where: filtreApfcs(u.portee),
        orderBy: { nom: "asc" },
        select: { id: true, nom: true, region: { select: { nom: true } }, _count: { select: { cohortes: true } } },
      }),
      prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
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
        titre={T("APFC")}
        description={T("Antennes Pédagogiques de Formation Continue — sessions de formation des enseignants.")}
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">{T("Impossible de charger les APFC.")}</p>
        </Card>
      ) : (
        <>
          <ReglageTermeApfc pays={pays} terme={terme} />

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">{T("Nouvelle APFC")}</h2>
            <StructureForm type="apfc" regions={regions} terme={terme} />
            <div className="mt-5 border-t border-cream-100 pt-4">
              <ImportApfcCSV regions={regions} terme={terme} />
            </div>
          </Card>

          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-forest-900">
              {T("APFC enregistrées")} ({apfcs.length})
            </h2>
            {apfcs.length === 0 ? (
              <Card>
                <p className="flex items-center gap-2 text-sm text-ink-700/60">
                  <Network size={16} /> {T("Aucune APFC. Créez-en une ci-dessus.")}
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
