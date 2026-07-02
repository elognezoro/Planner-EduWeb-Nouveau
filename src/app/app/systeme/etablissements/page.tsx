import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { School, ArrowUpRight, Plus, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreEtablissements } from "@/lib/rbac";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { EtablissementForm } from "./etablissement-form";

export const metadata: Metadata = { title: "Établissements" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/etablissements";
const PAR_PAGE = 24;

const libelleType: Record<string, string> = {
  prescolaire: "Préscolaire",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
  groupe_scolaire: "Groupe scolaire",
  autre: "Autre",
};
const TYPES = Object.entries(libelleType);
const STATUTS = [
  ["public", "Public"],
  ["prive", "Privé"],
  ["confessionnel", "Confessionnel"],
  ["autre", "Autre"],
] as const;

function lienPage(sp: Record<string, string | undefined>, page: number): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) p.set(k, v);
  p.set("page", String(page));
  return `${BASE}?${p.toString()}`;
}

export default async function EtablissementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string; type?: string; statut?: string; page?: string }>;
}) {
  const u = await requireRole(["admin", "etablissements_admin"]);
  const sp = await searchParams;
  const estAdmin = u.roleReel === "admin";

  const q = sp.q?.trim() || null;
  const region = sp.region?.trim() || null;
  const type = sp.type && libelleType[sp.type] ? sp.type : null;
  const statut = sp.statut && STATUTS.some(([v]) => v === sp.statut) ? sp.statut : null;
  const filtreActif = Boolean(q || region || type || statut);

  const where: Prisma.EtablissementWhereInput = { ...filtreEtablissements(u.portee) };
  if (q) where.OR = [{ nom: { contains: q, mode: "insensitive" } }, { ville: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }];
  if (region) where.regionId = region;
  if (type) where.type = type as Prisma.EtablissementWhereInput["type"];
  if (statut) where.statut = statut as Prisma.EtablissementWhereInput["statut"];

  let ok = true;
  let total = 0;
  let etablissements: {
    id: string; nom: string; type: string; ville: string | null;
    region: { nom: string } | null; _count: { classes: number; salles: number };
  }[] = [];
  let regions: { id: string; nom: string; pays: string }[] = [];

  let page = Math.max(1, Number(sp.page) || 1);
  try {
    [total, regions] = await Promise.all([
      prisma.etablissement.count({ where }),
      prisma.region.findMany({ orderBy: [{ pays: "asc" }, { nom: "asc" }], select: { id: true, nom: true, pays: true } }),
    ]);
    const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
    page = Math.min(page, pages);
    etablissements = await prisma.etablissement.findMany({
      where,
      orderBy: [{ nom: "asc" }],
      include: { region: { select: { nom: true } }, _count: { select: { classes: true, salles: true } } },
      skip: (page - 1) * PAR_PAGE,
      take: PAR_PAGE,
    });
  } catch (e) {
    console.error("[etablissements] DB indisponible :", e);
    ok = false;
  }
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const plusieursPays = new Set(regions.map((r) => r.pays)).size > 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Établissements"
        description={`${total.toLocaleString("fr-FR")} établissement(s) référencé(s) — création, rattachement régional et configuration.`}
      />

      {!ok ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les établissements. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : (
        <>
          {estAdmin && (
            <Card>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
                <Plus size={18} /> Nouvel établissement
              </h2>
              <EtablissementForm regions={regions.map((r) => ({ id: r.id, nom: plusieursPays ? `${r.nom} (${r.pays})` : r.nom }))} />
            </Card>
          )}

          {/* Recherche & filtres */}
          <Card>
            <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[14rem] flex-1">
                <label className="mb-1.5 block text-xs font-medium text-forest-900">Recherche</label>
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
                  <input
                    name="q"
                    defaultValue={q ?? ""}
                    placeholder="Nom, ville ou code…"
                    className="h-11 w-full rounded-2xl border border-cream-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  />
                </div>
              </div>
              <div className="min-w-[11rem]">
                <label className="mb-1.5 block text-xs font-medium text-forest-900">Région (DRENA)</label>
                <select name="region" defaultValue={region ?? ""} className="h-11 w-full rounded-2xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  <option value="">Toutes</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{plusieursPays ? `${r.nom} (${r.pays})` : r.nom}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[9rem]">
                <label className="mb-1.5 block text-xs font-medium text-forest-900">Type</label>
                <select name="type" defaultValue={type ?? ""} className="h-11 w-full rounded-2xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  <option value="">Tous</option>
                  {TYPES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[8rem]">
                <label className="mb-1.5 block text-xs font-medium text-forest-900">Statut</label>
                <select name="statut" defaultValue={statut ?? ""} className="h-11 w-full rounded-2xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  <option value="">Tous</option>
                  {STATUTS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700">
                Filtrer
              </button>
              {filtreActif && (
                <Link href={BASE} className="inline-flex h-11 items-center gap-1 rounded-full border border-cream-300 px-4 text-sm font-medium text-ink-700/70 hover:bg-red-50 hover:text-red-600">
                  <X size={14} /> Réinitialiser
                </Link>
              )}
            </form>
          </Card>

          {etablissements.length === 0 ? (
            <Card className="flex flex-col items-center py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
                <School size={26} />
              </span>
              <p className="mt-4 text-sm text-ink-700/65">
                Aucun établissement ne correspond à ces critères.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {etablissements.map((e) => (
                  <Link
                    key={e.id}
                    href={`/app/systeme/etablissements/${e.id}`}
                    className="group rounded-3xl border border-cream-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-gold-300 hover:shadow-[var(--shadow-gold)]"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-800 text-gold-300">
                        <School size={20} />
                      </span>
                      <ArrowUpRight
                        size={16}
                        className="text-ink-700/30 transition-colors group-hover:text-gold-600"
                      />
                    </div>
                    <h3 className="mt-4 font-semibold text-forest-900">{e.nom}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge>{libelleType[e.type] ?? e.type}</Badge>
                      {e.region && <Badge ton="neutre">{e.region.nom}</Badge>}
                    </div>
                    <p className="mt-3 text-xs text-ink-700/60">
                      {e._count.classes} classe(s) · {e._count.salles} salle(s)
                      {e.ville ? ` · ${e.ville}` : ""}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-700/60">
                    Page {page} / {pages} — {total.toLocaleString("fr-FR")} établissement(s)
                  </p>
                  <div className="flex items-center gap-2">
                    {page > 1 && (
                      <Link href={lienPage(sp, page - 1)} className="inline-flex h-10 items-center gap-1 rounded-full border border-cream-300 bg-white px-4 text-sm font-medium text-forest-800 hover:bg-forest-50">
                        <ChevronLeft size={15} /> Précédent
                      </Link>
                    )}
                    {page < pages && (
                      <Link href={lienPage(sp, page + 1)} className="inline-flex h-10 items-center gap-1 rounded-full border border-cream-300 bg-white px-4 text-sm font-medium text-forest-800 hover:bg-forest-50">
                        Suivant <ChevronRight size={15} />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
