import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Gauge, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreEtablissements } from "@/lib/rbac";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { LIBELLE_TYPE } from "@/lib/referentiels/etablissement";
import {
  calculerAvancements,
  COMPTEURS_AVANCEMENT,
  type AvancementConfiguration,
} from "@/lib/emploi-du-temps/avancement-configuration";

export const metadata: Metadata = { title: "Établissements en cours de configuration" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/etablissements/en-configuration";
const PAR_PAGE = 24;

/** Couleurs de la jauge selon l'avancement (design system forest/gold, rouge = à peine commencé). */
function couleursJauge(pct: number): { barre: string; texte: string } {
  if (pct >= 80) return { barre: "bg-forest-600", texte: "text-forest-700" };
  if (pct >= 40) return { barre: "bg-gold-500", texte: "text-gold-700" };
  return { barre: "bg-red-500", texte: "text-red-600" };
}

/**
 * ÉTABLISSEMENTS EN COURS DE CONFIGURATION : ceux dont l'emploi du temps N'A PAS encore été
 * généré, avec un TAUX D'AVANCEMENT (%) mesuré sur les prérequis réels du solveur (critères
 * détaillés dans src/lib/emploi-du-temps/avancement-configuration.ts). Page sœur du répertoire,
 * cloisonnée par périmètre (règle d'or).
 */
export default async function EtablissementsEnConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const u = await requireRole([
    "admin",
    "superviseur_international",
    "super_admin_etablissements",
    "representant_pays",
    "etablissements_admin",
    "chef_etablissement",
    "adjoint_chef_etablissement",
  ]);
  const sp = await searchParams;

  // Périmètre (règle d'or) + AUCUN créneau généré.
  const where: Prisma.EtablissementWhereInput = {
    ...filtreEtablissements(u.portee),
    creneaux: { none: {} },
  };

  let ok = true;
  let total = 0;
  let page = Math.max(1, Number(sp.page) || 1);
  let etablissements: {
    id: string; nom: string; type: string; ville: string | null; pays: string | null;
    categoriePedagogique: string | null; nbSallesDisponibles: number;
    region: { nom: string } | null;
    _count: { classes: number; salles: number; niveauxConfig: number; effectifsEnseignant: number; grilles: number };
  }[] = [];
  let avancements = new Map<string, AvancementConfiguration>();

  try {
    total = await prisma.etablissement.count({ where });
    const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
    page = Math.min(page, pages);
    etablissements = await prisma.etablissement.findMany({
      where,
      orderBy: [{ nom: "asc" }],
      select: {
        id: true, nom: true, type: true, ville: true, pays: true,
        categoriePedagogique: true, nbSallesDisponibles: true,
        region: { select: { nom: true } },
        // Compteurs FILTRÉS du taux d'avancement (une seule requête paginée, pas de N+1).
        _count: { select: COMPTEURS_AVANCEMENT },
      },
      skip: (page - 1) * PAR_PAGE,
      take: PAR_PAGE,
    });
    avancements = await calculerAvancements(etablissements);
  } catch (e) {
    console.error("[etablissements-en-configuration] DB indisponible :", e);
    ok = false;
  }
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Établissements en cours de configuration"
        description={`${total.toLocaleString("fr-FR")} établissement(s) de votre périmètre sans emploi du temps généré. Le pourcentage mesure l'avancement vers la génération : catégorie pédagogique, effectifs par niveau, classes calculées, volumes horaires, ressources enseignantes, salles.`}
      />

      {!ok ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les établissements. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : etablissements.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
            <Gauge size={26} />
          </span>
          <p className="mt-4 text-sm text-ink-700/65">
            Tous les établissements de votre périmètre ont un emploi du temps généré — rien en
            attente de configuration.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {etablissements.map((e) => {
              const av = avancements.get(e.id);
              const pct = av?.pourcentage ?? 0;
              const manquants = (av?.items ?? []).filter((i) => !i.ok).map((i) => i.libelle);
              const c = couleursJauge(pct);
              return (
                <Link
                  key={e.id}
                  href={`/app/systeme/etablissements/${e.id}`}
                  className="group rounded-3xl border border-cream-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-gold-300 hover:shadow-[var(--shadow-gold)]"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream-100 text-forest-700">
                      <Gauge size={20} />
                    </span>
                    <span className={`font-display text-xl font-bold tabular-nums ${c.texte}`}>{pct}%</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-forest-900">{e.nom}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge>{LIBELLE_TYPE[e.type] ?? e.type}</Badge>
                    {e.region && <Badge ton="neutre">{e.region.nom}</Badge>}
                  </div>
                  {/* Jauge d'avancement de configuration. */}
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-200" aria-hidden="true">
                    <div className={`h-full rounded-full ${c.barre}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-ink-700/60">
                    {manquants.length === 0 ? (
                      <>
                        Prêt pour la génération — ouvrez la console puis « Emploi du temps ».
                      </>
                    ) : (
                      <>
                        À compléter : {manquants.join(" · ")}
                      </>
                    )}
                    {e.ville ? ` — ${e.ville}` : ""}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-forest-700 group-hover:text-forest-900">
                    Ouvrir la configuration <ArrowUpRight size={13} />
                  </span>
                </Link>
              );
            })}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-700/60">
                Page {page} / {pages.toLocaleString("fr-FR")} — {total.toLocaleString("fr-FR")} établissement(s)
              </p>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link href={`${BASE}?page=${page - 1}`} className="inline-flex h-10 items-center gap-1 rounded-full border border-cream-300 bg-white px-4 text-sm font-medium text-forest-800 hover:bg-forest-50">
                    <ChevronLeft size={15} /> Précédent
                  </Link>
                )}
                {page < pages && (
                  <Link href={`${BASE}?page=${page + 1}`} className="inline-flex h-10 items-center gap-1 rounded-full border border-cream-300 bg-white px-4 text-sm font-medium text-forest-800 hover:bg-forest-50">
                    Suivant <ChevronRight size={15} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
