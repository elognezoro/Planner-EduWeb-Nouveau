import type { Metadata } from "next";
import { ScrollText, Activity } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";

export const metadata: Metadata = { title: "Journal d'activité" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/journal-activite";

const LIBELLE_ACTION: Record<string, string> = {
  "demande_role.approuvee": "Demande de rôle approuvée",
  "demande_role.refusee": "Demande de rôle refusée",
};

function libelleAction(a: string) {
  return LIBELLE_ACTION[a] ?? a;
}
function dateHeure(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function JournalActivitePage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const filtreAction = sp.action?.trim() || null;

  let erreur = false;
  let total = 0;
  let aujourdhui = 0;
  let actions: string[] = [];
  let entrees: {
    id: string;
    creeLe: Date;
    acteurEmail: string | null;
    action: string;
    cible: string | null;
  }[] = [];

  try {
    const debutJour = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const [t, j, distinctes, liste] = await Promise.all([
      prisma.journalActivite.count(),
      prisma.journalActivite.count({ where: { creeLe: { gte: debutJour } } }),
      prisma.journalActivite.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
      prisma.journalActivite.findMany({
        where: filtreAction ? { action: filtreAction } : undefined,
        orderBy: { creeLe: "desc" },
        take: 150,
        select: { id: true, creeLe: true, acteurEmail: true, action: true, cible: true },
      }),
    ]);
    total = t;
    aujourdhui = j;
    actions = distinctes.map((d) => d.action);
    entrees = liste;
  } catch (e) {
    console.error("[journal-activite] :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Journal d'activité"
        description="Traçabilité des actions sensibles effectuées sur la plateforme (audit)."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">{"Impossible de charger le journal d'activité."}</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard libelle="Évènements enregistrés" valeur={total} icone={<ScrollText size={22} />} />
            <StatCard libelle="Aujourd'hui" valeur={aujourdhui} icone={<Activity size={22} />} ton="gold" />
          </div>

          {actions.length > 0 && (
            <Card>
              <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[14rem] flex-1">
                  <label className="mb-1.5 block text-sm font-medium text-forest-900">{"Type d'action"}</label>
                  <select
                    name="action"
                    defaultValue={filtreAction ?? ""}
                    className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  >
                    <option value="">Toutes les actions</option>
                    {actions.map((a) => (
                      <option key={a} value={a}>
                        {libelleAction(a)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700"
                >
                  Filtrer
                </button>
              </form>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">
              Évènements récents{filtreAction && ` — ${libelleAction(filtreAction)}`}
            </h2>
            {entrees.length === 0 ? (
              <p className="py-4 text-sm text-ink-700/55">Aucun évènement enregistré pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left">
                      <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Date</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">Acteur</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">Action</th>
                      <th className="px-2 py-2.5 font-semibold text-ink-700/70">Cible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entrees.map((e) => (
                      <tr key={e.id} className="border-b border-cream-100 last:border-0">
                        <td className="whitespace-nowrap py-2.5 pr-4 text-ink-700/70">{dateHeure(e.creeLe)}</td>
                        <td className="px-2 py-2.5 text-forest-900">{e.acteurEmail ?? "—"}</td>
                        <td className="px-2 py-2.5">
                          <span className="rounded-full bg-forest-100 px-2.5 py-0.5 text-xs font-semibold text-forest-800">
                            {libelleAction(e.action)}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 font-mono text-xs text-ink-700/55">{e.cible ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
