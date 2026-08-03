import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { CalendarCheck, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreEtablissements } from "@/lib/rbac";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { LIBELLE_TYPE } from "@/lib/referentiels/etablissement";

export const metadata: Metadata = { title: "Établissements configurés" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/etablissements/configures";
const PAR_PAGE = 24;

function dateFr(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

/**
 * ÉTABLISSEMENTS CONFIGURÉS : ceux dont l'EMPLOI DU TEMPS A ÉTÉ GÉNÉRÉ (au moins un créneau en
 * base — la génération remplace l'EDT entier de l'établissement, sans filtre d'année : c'est le
 * marqueur canonique). Page sœur du répertoire, cloisonnée par périmètre (règle d'or).
 */
export default async function EtablissementsConfiguresPage({
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

  // Périmètre (règle d'or) + EDT généré. `creneaux: some` s'appuie sur l'index etablissementId.
  const where: Prisma.EtablissementWhereInput = {
    ...filtreEtablissements(u.portee),
    creneaux: { some: {} },
  };

  let ok = true;
  let total = 0;
  let page = Math.max(1, Number(sp.page) || 1);
  let etablissements: {
    id: string; nom: string; type: string; ville: string | null; pays: string | null;
    region: { nom: string } | null;
    _count: { classes: number; salles: number; creneaux: number };
  }[] = [];
  const derniereGeneration = new Map<string, Date>();

  try {
    total = await prisma.etablissement.count({ where });
    const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
    page = Math.min(page, pages);
    etablissements = await prisma.etablissement.findMany({
      where,
      orderBy: [{ nom: "asc" }],
      select: {
        id: true, nom: true, type: true, ville: true, pays: true,
        region: { select: { nom: true } },
        _count: { select: { classes: true, salles: true, creneaux: true } },
      },
      skip: (page - 1) * PAR_PAGE,
      take: PAR_PAGE,
    });
    // Date de dernière génération : une requête groupée pour la page affichée.
    if (etablissements.length > 0) {
      const maxima = await prisma.creneau.groupBy({
        by: ["etablissementId"],
        where: { etablissementId: { in: etablissements.map((e) => e.id) } },
        _max: { creeLe: true },
      });
      for (const m of maxima) if (m._max.creeLe) derniereGeneration.set(m.etablissementId, m._max.creeLe);
    }
  } catch (e) {
    console.error("[etablissements-configures] DB indisponible :", e);
    ok = false;
  }
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Établissements configurés"
        description={`${total.toLocaleString("fr-FR")} établissement(s) de votre périmètre dont l'emploi du temps a été généré.`}
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
            <CalendarCheck size={26} />
          </span>
          <p className="mt-4 text-sm text-ink-700/65">
            Aucun emploi du temps généré pour le moment dans votre périmètre. Retrouvez la
            progression des autres établissements dans « En cours de configuration ».
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {etablissements.map((e) => {
              const genereLe = derniereGeneration.get(e.id) ?? null;
              return (
                <Link
                  key={e.id}
                  href={`/app/systeme/etablissements/${e.id}/emploi-du-temps`}
                  className="group rounded-3xl border border-cream-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-gold-300 hover:shadow-[var(--shadow-gold)]"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-800 text-gold-300">
                      <CalendarCheck size={20} />
                    </span>
                    <ArrowUpRight size={16} className="text-ink-700/30 transition-colors group-hover:text-gold-600" />
                  </div>
                  <h3 className="mt-4 font-semibold text-forest-900">{e.nom}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge ton="succes">EDT généré</Badge>
                    <Badge>{LIBELLE_TYPE[e.type] ?? e.type}</Badge>
                    {e.region && <Badge ton="neutre">{e.region.nom}</Badge>}
                  </div>
                  <p className="mt-3 text-xs text-ink-700/60">
                    {e._count.creneaux.toLocaleString("fr-FR")} créneau(x) · {e._count.classes} classe(s) ·{" "}
                    {e._count.salles} salle(s)
                    {e.ville ? ` · ${e.ville}` : ""}
                    {genereLe ? ` · généré le ${dateFr(genereLe)}` : ""}
                  </p>
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
