import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Users, UserCheck, MailWarning, ClipboardCheck, Search, X } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { KpiCard } from "@/components/app/kpi-card";
import { Reveal } from "@/components/ui/reveal";
import { ComptesActions } from "./comptes-actions";
import { TableauComptes, type LigneCompte } from "./tableau-comptes";
import { ROLES, filtreUtilisateurs } from "@/lib/rbac";

export const metadata: Metadata = { title: "Comptes utilisateurs" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/comptes";

function nomComplet(p: { prenoms: string | null; nom: string | null }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || "—";
}

export default async function ComptesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; statut?: string; demande?: string }>;
}) {
  const u = await requireRole(["admin", "etablissements_admin", "cafop_admin", "apfc_admin"]);
  const sp = await searchParams;

  // Périmètre : REFUSÉ PAR DÉFAUT — chaque rôle ne voit que les comptes de son périmètre.
  // Seul l'admin système voit tous les comptes (filtre centralisé, jamais réécrit ici).
  const perimetre: Prisma.UtilisateurWhereInput = filtreUtilisateurs(u.portee);

  // Filtres actifs.
  const q = sp.q?.trim() || null;
  const statut = sp.statut && ["actif", "en_attente_verification", "suspendu", "archive"].includes(sp.statut) ? sp.statut : null;
  const role = sp.role?.trim() || null;
  const demande = sp.demande === "1";
  const filtreActif = Boolean(q || statut || role || demande);

  const where: Prisma.UtilisateurWhereInput = { ...perimetre };
  if (statut) where.statutCompte = statut as Prisma.UtilisateurWhereInput["statutCompte"];
  if (role) where.roleActif = { nomTechnique: role };
  if (demande) where.demandes = { some: { statut: "en_attente" } };
  if (q)
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { nom: { contains: q, mode: "insensitive" } },
      { prenoms: { contains: q, mode: "insensitive" } },
    ];

  let erreur = false;
  let kpi = { total: 0, actifs: 0, nonConfirmes: 0, avecDemande: 0 };
  let liste: LigneCompte[] = [];

  try {
    const [total, actifs, nonConfirmes, avecDemande, brutes] = await Promise.all([
      prisma.utilisateur.count({ where: perimetre }),
      prisma.utilisateur.count({ where: { ...perimetre, statutCompte: "actif" } }),
      prisma.utilisateur.count({ where: { ...perimetre, statutCompte: "en_attente_verification" } }),
      prisma.utilisateur.count({ where: { ...perimetre, demandes: { some: { statut: "en_attente" } } } }),
      prisma.utilisateur.findMany({
        where,
        orderBy: { creeLe: "desc" },
        take: 100,
        include: {
          roleActif: true,
          etablissement: { select: { nom: true } },
          region: { select: { nom: true } },
        },
      }),
    ]);
    kpi = { total, actifs, nonConfirmes, avecDemande };
    liste = brutes.map((c) => ({
      id: c.id,
      prenoms: c.prenoms ?? "",
      nom: c.nom ?? "",
      nomAffiche: nomComplet(c),
      email: c.email,
      roleTech: c.roleActif.nomTechnique,
      roleLibelle: c.roleActif.libelle,
      etablissement: c.etablissement?.nom ?? null,
      region: c.region?.nom ?? null,
      pays: c.pays,
      statut: c.statutCompte,
      creeLe: c.creeLe.toISOString(),
    }));
  } catch (e) {
    console.error("[comptes] :", e);
    erreur = true;
  }

  const rolesOptions = Object.entries(ROLES)
    .map(([v, r]) => ({ v, l: r.libelle }))
    .sort((a, b) => a.l.localeCompare(b.l));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titre="Comptes utilisateurs"
        description="Gérez et filtrez les comptes de votre périmètre."
        action={<ComptesActions />}
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les comptes.</p>
        </Card>
      ) : (
        <>
          {/* KPI cliquables (filtres rapides) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard index={0} libelle="Comptes" valeur={kpi.total} icone={<Users size={22} />} href={BASE} />
            <KpiCard index={1} libelle="Actifs" valeur={kpi.actifs} ton="forest" icone={<UserCheck size={22} />} href={`${BASE}?statut=actif`} />
            <KpiCard index={2} libelle="E-mail non confirmé" valeur={kpi.nonConfirmes} ton="gold" icone={<MailWarning size={22} />} href={`${BASE}?statut=en_attente_verification`} />
            <KpiCard index={3} libelle="Demande en attente" valeur={kpi.avecDemande} ton={kpi.avecDemande > 0 ? "red" : "cream"} icone={<ClipboardCheck size={22} />} href={`${BASE}?demande=1`} />
          </div>

          {/* Barre de filtres */}
          <Reveal>
            <Card>
              <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[14rem] flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-forest-900">Recherche</label>
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
                    <input
                      name="q"
                      defaultValue={q ?? ""}
                      placeholder="Nom ou e-mail…"
                      className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                    />
                  </div>
                </div>
                <div className="min-w-[10rem]">
                  <label className="mb-1.5 block text-xs font-medium text-forest-900">Rôle</label>
                  <select name="role" defaultValue={role ?? ""} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                    <option value="">Tous les rôles</option>
                    {rolesOptions.map((r) => (
                      <option key={r.v} value={r.v}>{r.l}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[9rem]">
                  <label className="mb-1.5 block text-xs font-medium text-forest-900">Statut</label>
                  <select name="statut" defaultValue={statut ?? ""} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                    <option value="">Tous</option>
                    <option value="actif">Actif</option>
                    <option value="en_attente_verification">E-mail non confirmé</option>
                    <option value="suspendu">Suspendu</option>
                    <option value="archive">Archivé</option>
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
          </Reveal>

          {/* Table */}
          <Reveal delayIndex={1}>
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3">
                <p className="text-sm font-semibold text-forest-900">
                  {liste.length} compte(s){filtreActif ? " (filtrés)" : ""}
                </p>
              </div>
              {liste.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-ink-700/55">Aucun compte ne correspond à ces critères.</p>
              ) : (
                <TableauComptes
                  lignes={liste}
                  monId={u.id}
                  peutIncarner={u.roleReel === "admin" && !u.apercuActif}
                />
              )}
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}
