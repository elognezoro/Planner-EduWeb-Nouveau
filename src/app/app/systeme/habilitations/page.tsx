import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { estRoleValide, filtreUtilisateurs, ROLE_PAR_DEFAUT, type RoleId } from "@/lib/rbac";
import { RowHabilitation } from "./row";

export const metadata: Metadata = { title: "Gestion des habilitations" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/habilitations";

async function chargerComptes(where: Prisma.UtilisateurWhereInput) {
  try {
    return await prisma.utilisateur.findMany({
      where,
      orderBy: { creeLe: "desc" },
      take: 100,
      include: { roleActif: true },
    });
  } catch (e) {
    console.error("[habilitations] DB indisponible :", e);
    return null;
  }
}

export default async function HabilitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const u = await requireRole(["admin", "etablissements_admin", "cafop_admin", "apfc_admin"]);
  const q = (await searchParams).q?.trim() || null;

  // Périmètre REFUSÉ PAR DÉFAUT : seul l'admin voit tous les comptes.
  const perimetre: Prisma.UtilisateurWhereInput = filtreUtilisateurs(u.portee);

  // Recherche rapide : chaque mot-clé saisi doit correspondre à l'e-mail, au nom ou aux prénoms
  // (ex. « kouame alfred » trouve KOUAME Alfred, quel que soit l'ordre des mots).
  const mots = q ? q.split(/\s+/).filter(Boolean).slice(0, 6) : [];
  const where: Prisma.UtilisateurWhereInput = {
    AND: [
      perimetre,
      ...mots.map((mot) => ({
        OR: [
          { email: { contains: mot, mode: "insensitive" as const } },
          { nom: { contains: mot, mode: "insensitive" as const } },
          { prenoms: { contains: mot, mode: "insensitive" as const } },
        ],
      })),
    ],
  };

  const comptes = await chargerComptes(where);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Gestion des habilitations"
        description="Attribuez ou révoquez le rôle actif des utilisateurs de votre périmètre. Le rattachement au périmètre détaillé (établissement, structure) sera disponible avec la Phase 2."
      />

      {/* Recherche rapide (e-mail ou mots-clés du nom / des prénoms) */}
      <Card>
        <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-forest-900">
              Recherche rapide
            </label>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40"
              />
              <input
                id="q"
                name="q"
                defaultValue={q ?? ""}
                placeholder="E-mail, nom ou prénoms…"
                className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
            </div>
          </div>
          <button
            type="submit"
            className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700"
          >
            Rechercher
          </button>
          {q && (
            <Link
              href={BASE}
              className="inline-flex h-11 items-center gap-1 rounded-full border border-cream-300 px-4 text-sm font-medium text-ink-700/70 hover:bg-red-50 hover:text-red-600"
            >
              <X size={14} /> Réinitialiser
            </Link>
          )}
        </form>
      </Card>

      {comptes === null ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les comptes. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : comptes.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            {q
              ? `Aucun utilisateur ne correspond à « ${q} ».`
              : "Aucun compte à gérer pour le moment."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3">
            <p className="text-sm font-semibold text-forest-900">
              {comptes.length} compte(s){q ? ` pour « ${q} »` : ""}
              {!q && comptes.length === 100 ? " (100 plus récents — affinez avec la recherche)" : ""}
            </p>
          </div>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50 text-left">
                <th className="px-5 py-3 font-semibold text-ink-700/70">Utilisateur</th>
                <th className="px-5 py-3 font-semibold text-ink-700/70">Rôle & application</th>
              </tr>
            </thead>
            <tbody>
              {comptes.map((c) => {
                const roleActuel: RoleId = estRoleValide(c.roleActif.nomTechnique)
                  ? c.roleActif.nomTechnique
                  : ROLE_PAR_DEFAUT;
                const estMoi = c.id === u.id;
                return (
                  <tr key={c.id} className="border-b border-cream-100 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-forest-900">
                        {[c.prenoms, c.nom].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p className="text-xs text-ink-700/55">{c.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      {estMoi ? (
                        <span className="text-xs text-ink-700/50">
                          {c.roleActif.libelle} · (votre compte)
                        </span>
                      ) : (
                        <RowHabilitation utilisateurId={c.id} roleActuel={roleActuel} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
