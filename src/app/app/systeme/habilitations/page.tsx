import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { estRoleValide, filtreUtilisateurs, ROLE_PAR_DEFAUT, type RoleId } from "@/lib/rbac";
import { RowHabilitation } from "./row";

export const metadata: Metadata = { title: "Gestion des habilitations" };
export const dynamic = "force-dynamic";

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

export default async function HabilitationsPage() {
  const u = await requireRole(["admin", "etablissements_admin", "cafop_admin", "apfc_admin"]);

  // Périmètre REFUSÉ PAR DÉFAUT : seul l'admin voit tous les comptes.
  const where: Prisma.UtilisateurWhereInput = filtreUtilisateurs(u.portee);

  const comptes = await chargerComptes(where);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        titre="Gestion des habilitations"
        description="Attribuez ou révoquez le rôle actif des utilisateurs de votre périmètre. Le rattachement au périmètre détaillé (établissement, structure) sera disponible avec la Phase 2."
      />

      {comptes === null ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les comptes. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : comptes.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">Aucun compte à gérer pour le moment.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
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
