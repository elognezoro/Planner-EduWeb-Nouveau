import type { Metadata } from "next";
import Link from "next/link";
import { Radio, Users, Clock, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { filtreUtilisateurs } from "@/lib/rbac/scope";
import { PageHeader, Card } from "@/components/app/ui";
import { FENETRES, ROLES_PRESENCE, fenetreDepuisParam, tempsRelatif } from "./fenetres";

export const metadata: Metadata = { title: "Utilisateurs connectés" };
export const dynamic = "force-dynamic";

const MAX_LIGNES = 300;

export default async function UtilisateursConnectesPage({
  searchParams,
}: {
  searchParams: Promise<{ fenetre?: string | string[] }>;
}) {
  const u = await requireRole([...ROLES_PRESENCE]);

  const params = await searchParams;
  const fenetre = fenetreDepuisParam(params.fenetre);
  const maintenant = new Date().getTime();

  // CLOISONNEMENT : chaque admin ne voit que les comptes de SON périmètre (fail-closed).
  const perimetre = filtreUtilisateurs(u.portee);

  // Compteurs des six fenêtres (en parallèle) + liste de la fenêtre choisie.
  const [comptes, lignes] = await Promise.all([
    Promise.all(
      FENETRES.map((f) =>
        prisma.utilisateur.count({
          where: { ...perimetre, dernierAccesLe: { gte: new Date(maintenant - f.ms) } },
        }),
      ),
    ),
    prisma.utilisateur.findMany({
      where: {
        ...perimetre,
        dernierAccesLe: { gte: new Date(maintenant - FENETRES.find((f) => f.cle === fenetre)!.ms) },
      },
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
      orderBy: { dernierAccesLe: "desc" },
      take: MAX_LIGNES,
    }),
  ]);

  const compteFenetre = comptes[FENETRES.findIndex((f) => f.cle === fenetre)];
  const libelleFenetre = FENETRES.find((f) => f.cle === fenetre)!.libelle;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Utilisateurs connectés"
        description="Présence sur la plateforme, du temps réel à l'année — sur votre périmètre d'administration. Cliquez un utilisateur pour ses actions et pages visitées."
      />

      <Card>
        {/* Fenêtres d'observation : un onglet par période, avec son compteur. */}
        <div className="flex flex-wrap gap-2">
          {FENETRES.map((f, i) => (
            <Link
              key={f.cle}
              href={`/app/utilisateurs-connectes?fenetre=${f.cle}`}
              aria-current={f.cle === fenetre ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                f.cle === fenetre
                  ? "border-forest-700 bg-forest-800 text-white"
                  : "border-cream-300 bg-white text-ink-800 hover:border-forest-300 hover:bg-cream-50"
              }`}
            >
              {f.cle === "temps-reel" && (
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${f.cle === fenetre ? "bg-gold-300" : "bg-forest-400"} opacity-75`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${f.cle === fenetre ? "bg-gold-300" : "bg-forest-500"}`} />
                </span>
              )}
              {f.libelle}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  f.cle === fenetre ? "bg-white/15 text-white" : "bg-cream-200 text-ink-700/80"
                }`}
              >
                {comptes[i]}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm text-ink-700/70">
          <Users size={16} className="text-forest-700" />
          <span>
            <strong className="font-semibold text-forest-900">{compteFenetre}</strong> utilisateur(s)
            connecté(s) — fenêtre « {libelleFenetre} »
            {compteFenetre > MAX_LIGNES ? ` (les ${MAX_LIGNES} plus récents sont listés)` : ""}.
          </span>
        </div>

        {lignes.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-cream-300 bg-cream-50/60 px-6 py-10 text-center">
            <Radio size={22} className="text-ink-700/40" />
            <p className="text-sm text-ink-700/60">
              Aucun utilisateur connecté sur cette fenêtre pour votre périmètre.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-xs uppercase tracking-wide text-ink-700/55">
                  <th className="py-2 pr-3 font-semibold">Utilisateur</th>
                  <th className="py-2 pr-3 font-semibold">Rôle</th>
                  <th className="py-2 pr-3 font-semibold">Structure</th>
                  <th className="py-2 pr-3 font-semibold">Dernier accès</th>
                  <th className="py-2 font-semibold">
                    <span className="sr-only">Détail</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const structure = l.etablissement?.nom ?? l.cafop?.nom ?? l.apfc?.nom ?? l.region?.nom ?? l.pays ?? "—";
                  const actifRecemment = l.dernierAccesLe && maintenant - l.dernierAccesLe.getTime() < 2 * 60_000;
                  return (
                    <tr key={l.id} className="border-b border-cream-100 transition-colors last:border-0 hover:bg-cream-50/60">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/app/utilisateurs-connectes/${l.id}?fenetre=${fenetre}`}
                          className="flex items-center gap-2"
                        >
                          <span
                            aria-hidden
                            className={`h-2 w-2 shrink-0 rounded-full ${actifRecemment ? "bg-forest-500" : "bg-cream-300"}`}
                            title={actifRecemment ? "Actif en ce moment" : undefined}
                          />
                          <span>
                            <span className="block font-medium text-ink-900">
                              {[l.prenoms, l.nom].filter(Boolean).join(" ") || l.email}
                            </span>
                            <span className="block text-xs text-ink-700/55">{l.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-ink-800">{l.roleActif.libelle}</td>
                      <td className="py-2.5 pr-3 text-ink-800">{structure}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-ink-700/75">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={13} className="text-ink-700/40" />
                          {l.dernierAccesLe ? tempsRelatif(l.dernierAccesLe, maintenant) : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          href={`/app/utilisateurs-connectes/${l.id}?fenetre=${fenetre}`}
                          className="inline-flex items-center gap-1 rounded-full border border-cream-300 bg-white px-2.5 py-1 text-xs font-medium text-forest-800 hover:border-forest-300"
                          aria-label={`Actions et pages de ${[l.prenoms, l.nom].filter(Boolean).join(" ") || l.email}`}
                        >
                          Détail <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-ink-700/50">
          La présence est mesurée par le dernier accès authentifié, rafraîchi au plus une fois par
          minute — « Temps réel » couvre les 2 dernières minutes. Rechargez la page pour actualiser.
        </p>
      </Card>
    </div>
  );
}
