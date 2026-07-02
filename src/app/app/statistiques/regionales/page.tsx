import type { Metadata } from "next";
import { MapPin, School, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { ChartBarVertical } from "../etablissement/charts";

export const metadata: Metadata = { title: "Statistiques — Régionales" };
export const dynamic = "force-dynamic";

export default async function StatsRegionalesPage() {
  const u = await requireRole(["admin", "drena"]);

  let erreur = false;
  let titreContexte = "";
  let kpis = { regions: 0, etablissements: 0, eleves: 0 };
  let graph: { label: string; valeur: number }[] = [];
  let lignes: { nom: string; etablissements: number; eleves: number }[] = [];
  let nomSerie = "Élèves";

  try {
    // Élèves par établissement (2 requêtes, indépendant du volume d'établissements).
    const [classes, inscGroupes, etablissements] = await Promise.all([
      prisma.classe.findMany({ select: { id: true, etablissementId: true } }),
      prisma.inscription.groupBy({ by: ["classeId"], _count: { _all: true } }),
      prisma.etablissement.findMany({
        // Seuls les établissements avec des classes comptent dans ces statistiques :
        // ne pas charger le répertoire national complet (40 000+ entrées).
        where: { classes: { some: {} } },
        select: { id: true, nom: true, regionId: true, region: { select: { nom: true } } },
        orderBy: { nom: "asc" },
      }),
    ]);
    const classeToEtab = new Map(classes.map((c) => [c.id, c.etablissementId]));
    const elevesParEtab = new Map<string, number>();
    for (const g of inscGroupes) {
      const etab = classeToEtab.get(g.classeId);
      if (etab) elevesParEtab.set(etab, (elevesParEtab.get(etab) ?? 0) + g._count._all);
    }

    if (u.roleReel === "drena" && u.portee.regionId) {
      // DRENA : établissements de sa région.
      const region = await prisma.region.findUnique({
        where: { id: u.portee.regionId },
        select: { nom: true },
      });
      titreContexte = region?.nom ? `Région ${region.nom}` : "Votre région";
      nomSerie = "Élèves";
      const etabsRegion = etablissements.filter((e) => e.regionId === u.portee.regionId);
      graph = etabsRegion.map((e) => ({ label: e.nom, valeur: elevesParEtab.get(e.id) ?? 0 }));
      lignes = etabsRegion.map((e) => ({
        nom: e.nom,
        etablissements: 1,
        eleves: elevesParEtab.get(e.id) ?? 0,
      }));
      kpis = {
        regions: 1,
        etablissements: etabsRegion.length,
        eleves: etabsRegion.reduce((a, e) => a + (elevesParEtab.get(e.id) ?? 0), 0),
      };
    } else {
      // Admin : agrégation par région.
      titreContexte = "Toutes les régions";
      const parRegion = new Map<string, { etablissements: number; eleves: number }>();
      for (const e of etablissements) {
        const nom = e.region?.nom ?? "Sans région";
        const r = parRegion.get(nom) ?? { etablissements: 0, eleves: 0 };
        r.etablissements += 1;
        r.eleves += elevesParEtab.get(e.id) ?? 0;
        parRegion.set(nom, r);
      }
      lignes = [...parRegion.entries()]
        .map(([nom, v]) => ({ nom, ...v }))
        .sort((a, b) => b.eleves - a.eleves);
      graph = lignes.map((l) => ({ label: l.nom, valeur: l.eleves }));
      kpis = {
        regions: parRegion.size,
        etablissements: etablissements.length,
        eleves: [...elevesParEtab.values()].reduce((a, b) => a + b, 0),
      };
    }
  } catch (e) {
    console.error("[stats-regionales] :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Statistiques — Régionales"
        description={titreContexte ? `Répartition territoriale — ${titreContexte}.` : "Répartition territoriale des effectifs."}
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les statistiques régionales.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle={u.roleReel === "drena" ? "Région" : "Régions"} valeur={kpis.regions} icone={<MapPin size={22} />} />
            <StatCard libelle="Établissements" valeur={kpis.etablissements} icone={<School size={22} />} ton="gold" />
            <StatCard libelle="Élèves inscrits" valeur={kpis.eleves} icone={<Users size={22} />} />
          </div>

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">
              {u.roleReel === "drena" ? "Élèves par établissement" : "Élèves par région"}
            </h2>
            <ChartBarVertical data={graph} nomSerie={nomSerie} vide="Aucun effectif inscrit pour le moment." />
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Détail</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-left">
                    <th className="py-2.5 pr-4 font-semibold text-ink-700/70">
                      {u.roleReel === "drena" ? "Établissement" : "Région"}
                    </th>
                    {u.roleReel !== "drena" && (
                      <th className="px-2 py-2.5 text-right font-semibold text-ink-700/70">Établissements</th>
                    )}
                    <th className="px-2 py-2.5 text-right font-semibold text-ink-700/70">Élèves</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-ink-700/55">
                        Aucune donnée.
                      </td>
                    </tr>
                  ) : (
                    lignes.map((l) => (
                      <tr key={l.nom} className="border-b border-cream-100 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-forest-900">{l.nom}</td>
                        {u.roleReel !== "drena" && (
                          <td className="px-2 py-2.5 text-right text-ink-700/70">{l.etablissements}</td>
                        )}
                        <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.eleves}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
