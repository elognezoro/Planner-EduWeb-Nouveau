import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { School, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreEtablissements } from "@/lib/rbac";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { paysDetecte } from "@/lib/geo";
import { LIBELLE_TYPE, typesDeFamille, RESEAUX_CONFESSIONNELS } from "@/lib/referentiels/etablissement";
import { EtablissementForm } from "./etablissement-form";
import { FiltresEtablissements } from "./filtres-etablissements";

export const metadata: Metadata = { title: "Établissements" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/etablissements";
const PAR_PAGE = 24;

const STATUTS = ["public", "prive", "confessionnel", "autre"];

function lienPage(sp: Record<string, string | undefined>, page: number): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) p.set(k, v);
  p.set("page", String(page));
  return `${BASE}?${p.toString()}`;
}

export default async function EtablissementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pays?: string; region?: string; famille?: string; statut?: string; reseau?: string; page?: string }>;
}) {
  // Le chef d'établissement accède à la configuration de SON établissement (régime, en-tête…).
  const u = await requireRole(["admin", "superviseur_international", "super_admin_etablissements", "representant_pays", "etablissements_admin", "chef_etablissement", "adjoint_chef_etablissement"]);
  const sp = await searchParams;
  const estAdmin = u.roleReel === "admin";

  // Pays géolocalisé de l'utilisateur (en-tête Vercel « x-vercel-ip-country »).
  const paysGeo = estAdmin ? (await paysDetecte()).nom : null;
  const paysParam = sp.pays?.trim();
  const montrerTousPays = paysParam === "all"; // sentinel « Tous les pays »

  // Filtres du répertoire : réservés à l'admin système — les autres rôles voient
  // uniquement leur périmètre, sans filtres (paramètres d'URL ignorés).
  const q = estAdmin ? sp.q?.trim() || null : null;
  const region = estAdmin ? sp.region?.trim() || null : null;
  const famille = estAdmin ? sp.famille?.trim() || null : null;
  const typesFamille = famille ? typesDeFamille(famille) : null;
  const statut = estAdmin && sp.statut && STATUTS.includes(sp.statut) ? sp.statut : null;
  const reseau = estAdmin && sp.reseau && (RESEAUX_CONFESSIONNELS as readonly string[]).includes(sp.reseau) ? sp.reseau : null;

  // WHERE de base : périmètre (règle d'or) + filtres hors pays. Le filtre pays est ajouté
  // plus bas, une fois connus les pays réellement présents en base.
  const where: Prisma.EtablissementWhereInput = { ...filtreEtablissements(u.portee) };
  if (q) where.OR = [{ nom: { contains: q, mode: "insensitive" } }, { ville: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }];
  if (region) where.regionId = region;
  if (typesFamille && typesFamille.length > 0) where.type = { in: typesFamille as Prisma.EnumTypeEtablissementFilter["in"] };
  if (statut) where.statut = statut as Prisma.EtablissementWhereInput["statut"];
  // Réseau confessionnel : implique nécessairement le statut « confessionnel ».
  if (reseau) {
    where.statut = "confessionnel";
    where.reseauConfessionnel = reseau;
  }

  let ok = true;
  let total = 0;
  let etablissements: {
    id: string; nom: string; type: string; ville: string | null; pays: string | null;
    region: { nom: string } | null; _count: { classes: number; salles: number };
  }[] = [];
  let regions: { id: string; nom: string; pays: string }[] = [];
  let paysListe: { nom: string; total: number }[] = [];
  // Pays effectivement filtré (null = tous) + pays du défaut réinitialisable, exposés hors du try.
  let paysFiltre: string | null = null;
  let paysDefautEffectif = "";

  let page = Math.max(1, Number(sp.page) || 1);
  try {
    // 1) Pays réellement présents en base (peuple le combobox ET valide le défaut géo).
    const paysR = estAdmin ? await prisma.etablissement.groupBy({ by: ["pays"], _count: true }) : [];
    paysListe = paysR
      .filter((p) => p.pays)
      .map((p) => ({ nom: p.pays as string, total: p._count }))
      .sort((a, b) => b.total - a.total);

    // 2) Défaut géo appliqué UNIQUEMENT si ce pays possède des établissements — sinon le
    //    répertoire s'afficherait vide par défaut alors que la base contient d'autres pays.
    const geoDispo = !!paysGeo && paysListe.some((p) => p.nom === paysGeo);
    paysDefautEffectif = geoDispo ? (paysGeo as string) : "";
    paysFiltre = estAdmin ? (montrerTousPays ? null : paysParam || (geoDispo ? paysGeo : null)) : null;
    if (paysFiltre) where.pays = paysFiltre;

    // 3) Comptage + régions (formulaire).
    const [totalR, regionsR] = await Promise.all([
      prisma.etablissement.count({ where }),
      estAdmin
        ? prisma.region.findMany({ orderBy: [{ pays: "asc" }, { nom: "asc" }], select: { id: true, nom: true, pays: true } })
        : Promise.resolve([]),
    ]);
    total = totalR;
    regions = regionsR;
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
          {estAdmin && <EtablissementForm regions={regions} />}

          {/* Filtres du répertoire : visibles uniquement par l'admin système. */}
          {estAdmin && (
            <FiltresEtablissements
              regions={regions}
              paysListe={paysListe}
              paysParDefaut={paysDefautEffectif}
              valeurs={{ q: q ?? "", pays: paysFiltre ?? "all", region: region ?? "", famille: famille ?? "", statut: statut ?? "", reseau: reseau ?? "" }}
            />
          )}

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
                      <Badge>{LIBELLE_TYPE[e.type] ?? e.type}</Badge>
                      {e.region && <Badge ton="neutre">{e.region.nom}</Badge>}
                      {!paysFiltre && e.pays && e.pays !== "Côte d'Ivoire" && <Badge ton="attente">{e.pays}</Badge>}
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
                    Page {page} / {pages.toLocaleString("fr-FR")} — {total.toLocaleString("fr-FR")} établissement(s)
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
