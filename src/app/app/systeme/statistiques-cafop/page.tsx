import type { Metadata } from "next";
import { GraduationCap, Users, BookMarked } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop, termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { ChartBarVertical } from "@/app/app/statistiques/etablissement/charts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTerme("Statistiques CAFOP", await termeCafopCourant()) };
}
export const dynamic = "force-dynamic";

export default async function StatistiquesCafopPage() {
  const u = await requireRole(["admin", "cafop_admin", "drena"]);
  const terme = await libelleCafop(await paysConsulte());
  const T = (s: string) => appliquerTerme(s, terme);

  const where = u.roleReel === "cafop_admin" ? { id: u.portee.cafopId ?? "__aucune__" } : {};
  const cafops = await prisma.cafop.findMany({
    where,
    orderBy: { nom: "asc" },
    select: { nom: true, region: { select: { nom: true } }, cohortes: { select: { _count: { select: { apprenants: true } } } } },
  });

  const lignes = cafops.map((c) => ({
    nom: c.nom,
    region: c.region?.nom ?? "—",
    promotions: c.cohortes.length,
    stagiaires: c.cohortes.reduce((s, x) => s + x._count.apprenants, 0),
  }));
  const kpis = {
    cafops: lignes.length,
    promotions: lignes.reduce((s, l) => s + l.promotions, 0),
    stagiaires: lignes.reduce((s, l) => s + l.stagiaires, 0),
  };
  const graph = lignes.map((l) => ({ label: l.nom, valeur: l.stagiaires })).sort((a, b) => b.valeur - a.valeur).slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader titre={T("Statistiques CAFOP")} description="Effectifs des promotions d'élèves-maîtres." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard libelle={T("CAFOP")} valeur={kpis.cafops} icone={<GraduationCap size={22} />} />
        <StatCard libelle="Promotions" valeur={kpis.promotions} icone={<BookMarked size={22} />} ton="gold" />
        <StatCard libelle="Élèves-maîtres" valeur={kpis.stagiaires} icone={<Users size={22} />} />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-base font-bold text-forest-900">{T("Élèves-maîtres par CAFOP")}</h2>
        <ChartBarVertical data={graph} nomSerie="Élèves-maîtres" vide={T("Aucun CAFOP enregistré.")} />
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Détail</h2>
        {lignes.length === 0 ? (
          <p className="text-sm text-ink-700/60">{T("Aucun CAFOP enregistré.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                  <th className="py-2.5 pr-3 font-semibold">{T("CAFOP")}</th>
                  <th className="px-2 py-2.5 font-semibold">Région</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Promotions</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Élèves-maîtres</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.nom} className="border-b border-cream-100 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-forest-900">{l.nom}</td>
                    <td className="px-2 py-2.5 text-ink-700/70">{l.region}</td>
                    <td className="px-2 py-2.5 text-right text-ink-700/80">{l.promotions}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.stagiaires}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
