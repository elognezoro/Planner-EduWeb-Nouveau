import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop, termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { EnteteCafop } from "../entete-cafop";
import { statistiquesCafop } from "./donnees";
import { VueStatistiquesCafop } from "./vue-statistiques";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTerme("CAFOP — Statistiques", await termeCafopCourant()) };
}
export const dynamic = "force-dynamic";

export default async function StatistiquesCafopTabPage() {
  // Onglet interne à la page CAFOP (menu réservé admin / cafop_admin) : accès aligné sur ce périmètre.
  const u = await requireRole(["admin", "superviseur_international", "super_admin_cafop", "representant_pays", "cafop_admin", "delc"]);
  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);

  const cafopId = u.roleReel === "cafop_admin" ? u.portee.cafopId ?? "__aucune__" : undefined;
  const [stats, regions] = await Promise.all([
    statistiquesCafop(pays, cafopId),
    prisma.region.findMany({ where: { pays }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EnteteCafop ongletActif="statistiques" nbCentres={stats.nbCentres} regions={regions} terme={terme} />
      <VueStatistiquesCafop stats={stats} terme={terme} pays={pays} />
    </div>
  );
}
