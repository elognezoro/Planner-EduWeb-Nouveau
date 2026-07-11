import type { Metadata } from "next";
import Link from "next/link";
import { Route, Award, Layers, CheckCircle2, Settings2 } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { classeBadge } from "@/lib/lms";

export const metadata: Metadata = { title: "Parcours — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const NIVEAU_LIBELLE: Record<string, string> = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé" };

export default async function ParcoursListePage() {
  const u = await requireUtilisateur();
  const estAdmin = u.roleActif === "admin";

  const [parcours, inscriptions, badgesObtenus] = await Promise.all([
    prisma.parcours.findMany({
      // Parcours de démonstration réservés à l'Admin système (invisibles aux autres rôles).
      where: { statut: "publie", ...(estAdmin ? {} : { NOT: { slug: { startsWith: "demo-" } } }), OR: [{ publicCible: { isEmpty: true } }, { publicCible: { has: u.roleActif } }] },
      orderBy: [{ ordre: "asc" }, { creeLe: "desc" }],
      select: { id: true, titre: true, slug: true, description: true, niveau: true, badge: { select: { nom: true, couleur: true } }, _count: { select: { etapes: true } } },
    }),
    prisma.inscriptionParcours.findMany({ where: { utilisateurId: u.id }, select: { parcoursId: true, progressionPct: true, statut: true } }),
    prisma.badgeObtenu.findMany({ where: { utilisateurId: u.id }, orderBy: { dateObtention: "desc" }, select: { id: true, dateObtention: true, badge: { select: { nom: true, description: true, couleur: true } } } }),
  ]);

  const inscMap = new Map(inscriptions.map((i) => [i.parcoursId, i]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Parcours de formation"
        description="Suivez des parcours structurés de plusieurs cours et décrochez des badges à la clé."
        action={estAdmin ? <Link href={`${BASE}/gestion/parcours`} className="inline-flex h-10 items-center gap-2 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-cream-100"><Settings2 size={15} /> Gérer</Link> : undefined}
      />

      {/* Mes badges */}
      {badgesObtenus.length > 0 && (
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900"><Award size={17} className="text-gold-600" /> Mes badges ({badgesObtenus.length})</h2>
          <div className="flex flex-wrap gap-2">
            {badgesObtenus.map((b) => (
              <span key={b.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${classeBadge(b.badge.couleur)}`} title={b.badge.description ?? undefined}>
                <Award size={14} /> {b.badge.nom}
              </span>
            ))}
          </div>
        </Card>
      )}

      {parcours.length === 0 ? (
        <Card><p className="text-sm text-ink-700/70">Aucun parcours n&apos;est disponible pour votre profil pour l&apos;instant.</p></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {parcours.map((p) => {
            const insc = inscMap.get(p.id);
            const pct = insc?.progressionPct ?? 0;
            const termine = insc?.statut === "termine";
            return (
              <Link key={p.id} href={`${BASE}/parcours/${p.slug}`} className="group flex flex-col rounded-3xl border border-cream-200 bg-white p-5 shadow-soft transition-colors hover:border-forest-200">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-forest-50 text-forest-700"><Route size={20} /></span>
                  {p.badge && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${classeBadge(p.badge.couleur)}`}><Award size={11} /> {p.badge.nom}</span>}
                </div>
                <h3 className="font-display text-base font-bold text-forest-900 group-hover:text-forest-700">{p.titre}</h3>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-ink-700/70">{p.description}</p>}
                <p className="mt-2 flex items-center gap-3 text-xs text-ink-700/55">
                  <span className="inline-flex items-center gap-1"><Layers size={12} /> {p._count.etapes} cours</span>
                  {p.niveau && <span>{NIVEAU_LIBELLE[p.niveau] ?? p.niveau}</span>}
                </p>
                <div className="mt-auto pt-3">
                  {insc ? (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-ink-700/60">Progression</span>
                        <span className="font-semibold text-forest-800">{termine ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> Terminé</span> : `${pct}%`}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: `${pct}%` }} /></div>
                    </div>
                  ) : (
                    <Badge ton="neutre">Non inscrit</Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
