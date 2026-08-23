import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity, Compass, Clock } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreUtilisateurs } from "@/lib/rbac/scope";
import { tousLesItems } from "@/lib/rbac/navigation";
import { PageHeader, Card } from "@/components/app/ui";
import { FENETRES, ROLES_PRESENCE, fenetreDepuisParam, tempsRelatif } from "../fenetres";

export const metadata: Metadata = { title: "Utilisateur connecté — détail" };
export const dynamic = "force-dynamic";

/** Libellé de navigation d'un chemin (« /app/vie-scolaire/finances » → « Finances ») :
 *  item au SEGMENT le plus long qui préfixe le chemin — null si aucune entrée ne correspond
 *  (pages sans entrée de menu : le chemin brut reste affiché seul). */
function libelleChemin(chemin: string): string | null {
  const relatif = chemin.replace(/^\/app\/?/, "");
  if (relatif === "") return "Tableau de bord";
  let meilleur: { seg: string; lib: string } | null = null;
  for (const it of tousLesItems()) {
    if (!it.segment) continue;
    if (relatif === it.segment || relatif.startsWith(it.segment + "/")) {
      if (!meilleur || it.segment.length > meilleur.seg.length) meilleur = { seg: it.segment, lib: it.libelle };
    }
  }
  return meilleur?.lib ?? null;
}

export default async function DetailUtilisateurConnectePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fenetre?: string | string[] }>;
}) {
  const u = await requireRole([...ROLES_PRESENCE]);
  const { id } = await params;
  const fenetre = fenetreDepuisParam((await searchParams).fenetre);
  const maintenant = new Date().getTime();
  const seuil = new Date(maintenant - FENETRES.find((f) => f.cle === fenetre)!.ms);

  // CLOISONNEMENT : la cible doit appartenir au périmètre de l'appelant (fail-closed) —
  // le filtre de périmètre est appliqué DANS la requête, un id hors périmètre = introuvable.
  const cible = await prisma.utilisateur.findFirst({
    where: { id, ...filtreUtilisateurs(u.portee) },
    select: {
      id: true,
      prenoms: true,
      nom: true,
      email: true,
      pays: true,
      dernierAccesLe: true,
      roleActif: { select: { libelle: true } },
      etablissement: { select: { nom: true } },
      cafop: { select: { nom: true } },
      apfc: { select: { nom: true } },
      region: { select: { nom: true } },
    },
  });
  if (!cible) notFound();

  const [pages, actions] = await Promise.all([
    prisma.accesPage.groupBy({
      by: ["chemin"],
      where: { utilisateurId: cible.id, date: { gte: seuil } },
      _count: { _all: true },
      _max: { date: true },
      orderBy: { _max: { date: "desc" } },
      take: 100,
    }),
    prisma.journalActivite.findMany({
      where: { utilisateurId: cible.id, creeLe: { gte: seuil } },
      select: { id: true, action: true, operation: true, entite: true, source: true, creeLe: true },
      orderBy: { creeLe: "desc" },
      take: 100,
    }),
  ]);

  const nomComplet = [cible.prenoms, cible.nom].filter(Boolean).join(" ") || cible.email;
  const structure =
    cible.etablissement?.nom ?? cible.cafop?.nom ?? cible.apfc?.nom ?? cible.region?.nom ?? cible.pays ?? "—";
  const libelleFenetre = FENETRES.find((f) => f.cle === fenetre)!.libelle;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/app/utilisateurs-connectes?fenetre=${fenetre}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={16} /> Utilisateurs connectés
      </Link>

      <PageHeader
        titre={nomComplet}
        description={`${cible.roleActif.libelle} · ${structure} · ${cible.email}${cible.dernierAccesLe ? ` — dernier accès ${tempsRelatif(cible.dernierAccesLe, maintenant)}` : ""}`}
      />

      {/* Fenêtre d'observation (partagée avec la liste). */}
      <div className="flex flex-wrap gap-2">
        {FENETRES.map((f) => (
          <Link
            key={f.cle}
            href={`/app/utilisateurs-connectes/${cible.id}?fenetre=${f.cle}`}
            aria-current={f.cle === fenetre ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              f.cle === fenetre
                ? "border-forest-700 bg-forest-800 text-white"
                : "border-cream-300 bg-white text-ink-800 hover:border-forest-300 hover:bg-cream-50"
            }`}
          >
            {f.libelle}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="flex items-center gap-2 text-sm font-semibold text-forest-900">
            <Compass size={17} className="text-forest-700" /> Pages touchées — {libelleFenetre}
          </p>
          {pages.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-cream-300 bg-cream-50/60 px-4 py-6 text-center text-sm text-ink-700/60">
              Aucune page enregistrée sur cette fenêtre. Le suivi des pages démarre à la mise en
              place de cette fonctionnalité — seules les navigations postérieures apparaissent.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[380px] text-left text-sm">
                <thead>
                  <tr className="border-b border-cream-200 text-xs uppercase tracking-wide text-ink-700/55">
                    <th className="py-2 pr-3 font-semibold">Page</th>
                    <th className="py-2 pr-3 font-semibold">Visites</th>
                    <th className="py-2 font-semibold">Dernière</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => {
                    const libelle = libelleChemin(p.chemin);
                    return (
                      <tr key={p.chemin} className="border-b border-cream-100 last:border-0">
                        <td className="py-2 pr-3">
                          {libelle && <p className="font-medium text-ink-900">{libelle}</p>}
                          <p className={`break-all text-xs ${libelle ? "text-ink-700/55" : "font-medium text-ink-900"}`}>{p.chemin}</p>
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-ink-800">{p._count._all}</td>
                        <td className="py-2 whitespace-nowrap text-xs text-ink-700/70">
                          {p._max.date ? tempsRelatif(p._max.date, maintenant) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <p className="flex items-center gap-2 text-sm font-semibold text-forest-900">
            <Activity size={17} className="text-forest-700" /> Actions effectuées — {libelleFenetre}
          </p>
          {actions.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-cream-300 bg-cream-50/60 px-4 py-6 text-center text-sm text-ink-700/60">
              Aucune action journalisée sur cette fenêtre (consultations pures : voir « Pages
              touchées » — seules les écritures et évènements de sécurité sont des actions).
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {actions.map((a) => (
                <li key={a.id} className="rounded-xl border border-cream-200 bg-cream-50/50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink-900">{a.action}</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-ink-700/60">
                      <Clock size={12} className="text-ink-700/40" />
                      {tempsRelatif(a.creeLe, maintenant)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-700/60">
                    {[a.entite, a.operation].filter(Boolean).join(" · ") || a.source}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-700/50">
            Source : journal d&apos;activité (100 dernières au plus). Le détail complet, avec
            valeurs et filtres, reste dans Système › Journal d&apos;activité.
          </p>
        </Card>
      </div>
    </div>
  );
}
