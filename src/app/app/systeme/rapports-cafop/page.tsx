import type { Metadata } from "next";
import { FileText, BookMarked, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { PageHeader, Card, StatCard, Badge } from "@/components/app/ui";

export const metadata: Metadata = { title: "Rapports CAFOP" };
export const dynamic = "force-dynamic";

export default async function RapportsCafopPage() {
  const u = await requireRole(["admin", "cafop_admin"]);
  const terme = await libelleCafop(await paysConsulte());
  const T = (s: string) => appliquerTerme(s, terme);

  const where =
    u.roleReel === "cafop_admin"
      ? { type: "cafop_promotion" as const, cafopId: u.portee.cafopId ?? "__aucune__" }
      : { type: "cafop_promotion" as const };

  const promotions = await prisma.cohorte.findMany({
    where,
    orderBy: { creeLe: "desc" },
    take: 60,
    include: { cafop: { select: { nom: true } }, _count: { select: { apprenants: true } } },
  });

  const lignes = promotions.map((p) => ({
    id: p.id,
    libelle: p.libelle,
    cafop: p.cafop?.nom ?? "—",
    annees: [p.anneeDebut, p.anneeFin].filter((a) => a != null).join("–"),
    statut: p.statut,
    stagiaires: p._count.apprenants,
  }));
  const kpis = {
    promotions: lignes.length,
    actives: lignes.filter((l) => l.statut === "active").length,
    stagiaires: lignes.reduce((s, l) => s + l.stagiaires, 0),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader titre={T("Rapports CAFOP")} description="Promotions d'élèves-maîtres et effectifs." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard libelle="Promotions" valeur={kpis.promotions} icone={<BookMarked size={22} />} />
        <StatCard libelle="Actives" valeur={kpis.actives} icone={<FileText size={22} />} ton="gold" />
        <StatCard libelle="Élèves-maîtres" valeur={kpis.stagiaires} icone={<Users size={22} />} />
      </div>

      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Promotions</h2>
        {lignes.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune promotion enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                  <th className="py-2.5 pr-3 font-semibold">Promotion</th>
                  <th className="px-2 py-2.5 font-semibold">{T("CAFOP")}</th>
                  <th className="px-2 py-2.5 font-semibold">Années</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Élèves-maîtres</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-b border-cream-100 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-forest-900">{l.libelle}</td>
                    <td className="px-2 py-2.5 text-ink-700/70">{l.cafop}</td>
                    <td className="px-2 py-2.5 text-ink-700/70">{l.annees || "—"}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.stagiaires}</td>
                    <td className="px-2 py-2.5 text-center">
                      <Badge ton={l.statut === "active" ? "succes" : "neutre"}>
                        {l.statut === "active" ? "Active" : "Clôturée"}
                      </Badge>
                    </td>
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
