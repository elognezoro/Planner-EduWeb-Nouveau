import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Users, UserCheck, MailWarning, ClipboardCheck, Search, X } from "lucide-react";
import { LigneActions } from "./ligne-actions";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { KpiCard } from "@/components/app/kpi-card";
import { Reveal } from "@/components/ui/reveal";
import { ComptesActions } from "./comptes-actions";
import { ROLES } from "@/lib/rbac";

export const metadata: Metadata = { title: "Comptes utilisateurs" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/comptes";
const libelleStatut: Record<string, string> = {
  en_attente_verification: "E-mail non confirmé",
  actif: "Actif",
  suspendu: "Suspendu",
};

function nomComplet(p: { prenoms: string | null; nom: string | null }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || "—";
}
function dateFr(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
}

export default async function ComptesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; statut?: string; demande?: string }>;
}) {
  const u = await requireRole(["admin", "etablissements_admin", "cafop_admin", "apfc_admin"]);
  const sp = await searchParams;

  // Périmètre de l'administrateur.
  const perimetre: Prisma.UtilisateurWhereInput = {};
  if (u.roleActif === "etablissements_admin") perimetre.etablissementId = u.portee.etablissementId;
  else if (u.roleActif === "cafop_admin") perimetre.cafopId = u.portee.cafopId;
  else if (u.roleActif === "apfc_admin") perimetre.apfcId = u.portee.apfcId;

  // Filtres actifs.
  const q = sp.q?.trim() || null;
  const statut = sp.statut && ["actif", "en_attente_verification", "suspendu"].includes(sp.statut) ? sp.statut : null;
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
  let liste: {
    id: string;
    nom: string;
    email: string;
    role: string;
    roleTech: string;
    statut: string;
    demande: string | null;
    creeLe: Date;
  }[] = [];

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
          demandes: { where: { statut: "en_attente" }, take: 1, include: { roleDemande: true } },
        },
      }),
    ]);
    kpi = { total, actifs, nonConfirmes, avecDemande };
    liste = brutes.map((c) => ({
      id: c.id,
      nom: nomComplet(c),
      email: c.email,
      role: c.roleActif.libelle,
      roleTech: c.roleActif.nomTechnique,
      statut: c.statutCompte,
      demande: c.demandes[0]?.roleDemande.libelle ?? null,
      creeLe: c.creeLe,
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-cream-200 bg-cream-50/60 text-left text-xs uppercase tracking-wide text-ink-700/55">
                        <th className="px-5 py-3 font-semibold">Utilisateur</th>
                        <th className="px-3 py-3 font-semibold">Rôle</th>
                        <th className="px-3 py-3 font-semibold">Statut</th>
                        <th className="px-3 py-3 font-semibold">Demande</th>
                        <th className="px-3 py-3 font-semibold">Inscrit le</th>
                        <th className="px-3 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liste.map((c) => (
                        <tr key={c.id} className="group border-b border-cream-100 transition-colors last:border-0 hover:bg-cream-50/50">
                          <td className="px-5 py-3">
                            <Link href={`${BASE}/${c.id}`} className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-gold-300">
                                {(c.nom !== "—" ? c.nom : c.email).slice(0, 1).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-forest-900 group-hover:text-forest-700">{c.nom}</p>
                                <p className="truncate text-xs text-ink-700/55">{c.email}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-forest-800">{c.role}</td>
                          <td className="px-3 py-3">
                            <Badge ton={c.statut === "actif" ? "succes" : c.statut === "suspendu" ? "refus" : "attente"}>
                              {libelleStatut[c.statut] ?? c.statut}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            {c.demande ? <Badge ton="attente">{c.demande}</Badge> : <span className="text-xs text-ink-700/40">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-700/60">{dateFr(c.creeLe)}</td>
                          <td className="px-3 py-3 text-right">
                            <LigneActions
                              utilisateurId={c.id}
                              statut={c.statut}
                              estAdmin={c.roleTech === "admin"}
                              estSoi={c.id === u.id}
                              peutIncarner={u.roleReel === "admin" && !u.apercuActif}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}
