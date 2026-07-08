import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { EnteteCafop } from "../../entete-cafop";
import { SousEnteteCafop, sousTitreCafop } from "../sous-entete";
import { CahierTexteCafop, type SeanceVue } from "./vue";

export const metadata: Metadata = { title: "CAFOP — Cahier de texte" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/cafop";

export default async function CahierTextePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole(["admin", "cafop_admin"]);
  const { id } = await params;
  if (u.roleReel === "cafop_admin" && u.portee.cafopId !== id) redirect(BASE);

  const cafop = await prisma.cafop.findUnique({ where: { id }, select: { id: true, nom: true, drena: true, pays: true } });
  if (!cafop) redirect(BASE);

  const [modules, seancesRaw, apprenants, nbPromos, regions, nbCentres] = await Promise.all([
    prisma.moduleCafop.findMany({ where: { actif: true }, orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
    prisma.seanceCafop.findMany({ where: { cafopId: id }, orderBy: { date: "desc" }, select: { id: true, date: true, groupe: true, titre: true, contenu: true, module: { select: { nom: true } } } }),
    prisma.apprenant.findMany({ where: { cohorte: { cafopId: id, type: "cafop_promotion" } }, select: { groupe: true } }),
    prisma.cohorte.count({ where: { cafopId: id, type: "cafop_promotion" } }),
    prisma.region.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.cafop.count(),
  ]);

  const groupes = [...new Set(apprenants.map((a) => a.groupe).filter(Boolean))].sort() as string[];
  const seances: SeanceVue[] = seancesRaw.map((s) => ({
    id: s.id,
    dateLabel: s.date.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
    moduleNom: s.module?.nom ?? null,
    groupe: s.groupe,
    titre: s.titre,
    contenu: s.contenu,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="enseignements" nbCentres={nbCentres} regions={regions} />
      <SousEnteteCafop cafopId={cafop.id} nom={cafop.nom} sousTitre={sousTitreCafop(cafop, nbPromos, apprenants.length)} actif="cahier" />
      <CahierTexteCafop cafopId={cafop.id} modules={modules} groupes={groupes} seances={seances} />
    </div>
  );
}
