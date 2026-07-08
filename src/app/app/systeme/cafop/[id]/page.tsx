import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/app/ui";
import { EnteteCafop } from "../entete-cafop";
import { SousEnteteCafop, sousTitreCafop } from "./sous-entete";
import { ConfigurerCafop, type CafopConfig, type PromotionConfig, type EleveConfig } from "./configurer-cafop";

export const metadata: Metadata = { title: "CAFOP — Configuration" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

export default async function CafopConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "cafop_admin"]);
  const { id } = await params;
  if (u.roleReel === "cafop_admin" && u.portee.cafopId !== id) redirect(BASE);

  const cafop = await prisma.cafop.findUnique({
    where: { id },
    select: { id: true, nom: true, code: true, drena: true, localite: true, directeur: true, directeurTel: true, effectif: true, pays: true },
  });
  if (!cafop) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader titre="CAFOP introuvable" />
        <Link href={BASE} className="text-sm font-semibold text-forest-700 hover:text-forest-900">← Retour à la liste</Link>
      </div>
    );
  }

  const [promosRaw, elevesRaw, regions, nbCentres] = await Promise.all([
    prisma.cohorte.findMany({
      where: { cafopId: id, type: "cafop_promotion" },
      orderBy: [{ anneeDebut: "desc" }, { creeLe: "desc" }],
      select: { id: true, libelle: true, _count: { select: { apprenants: true } } },
    }),
    prisma.apprenant.findMany({
      where: { cohorte: { cafopId: id, type: "cafop_promotion" } },
      orderBy: [{ groupe: "asc" }, { nom: "asc" }],
      select: { id: true, nom: true, prenoms: true, matricule: true, groupe: true, cohorteId: true },
    }),
    prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count(),
  ]);

  const promotions: PromotionConfig[] = promosRaw.map((p) => ({ id: p.id, libelle: p.libelle, nbEleves: p._count.apprenants }));
  const eleves: EleveConfig[] = elevesRaw.map((e) => ({ id: e.id, nom: e.nom, prenoms: e.prenoms, matricule: e.matricule, groupe: e.groupe, promotionId: e.cohorteId }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} />
      <SousEnteteCafop cafopId={cafop.id} nom={cafop.nom} sousTitre={sousTitreCafop(cafop, promotions.length, eleves.length)} actif="config" />
      <ConfigurerCafop cafop={cafop as CafopConfig} promotions={promotions} eleves={eleves} />
    </div>
  );
}
