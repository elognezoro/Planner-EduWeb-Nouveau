import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Layers, Clock, CheckCircle2, Compass, ArrowRight, BarChart3, ArrowUpRight } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { NIVEAUX } from "@/lib/lms";
import { BoutonInscription } from "../boutons-lms";

export const metadata: Metadata = { title: "Guides d'utilisateurs — Aide et Formation" };
export const dynamic = "force-dynamic";

const libelleNiveau = (v: string | null) => NIVEAUX.find((n) => n.v === v)?.libelle ?? null;

export default async function GuidesPage() {
  const u = await requireUtilisateur();
  const estAdmin = u.roleActif === "admin";

  const [cours, inscriptions] = await Promise.all([
    prisma.cours.findMany({
      where: { statut: "publie", OR: [{ publicCible: { isEmpty: true } }, { publicCible: { has: u.roleActif } }] },
      orderBy: [{ categorie: { ordre: "asc" } }, { ordre: "asc" }, { titre: "asc" }],
      select: {
        id: true, titre: true, slug: true, description: true, niveau: true, dureeMinutes: true,
        categorie: { select: { id: true, nom: true } },
        _count: { select: { modules: true } },
      },
    }),
    prisma.inscriptionCours.findMany({ where: { utilisateurId: u.id }, select: { coursId: true, progressionPct: true } }),
  ]);
  const progressionPar = new Map(inscriptions.map((i) => [i.coursId, i.progressionPct]));

  // Regroupement par catégorie (ordre déjà appliqué par la requête).
  const groupes = new Map<string, { nom: string; cours: typeof cours }>();
  for (const c of cours) {
    const cle = c.categorie?.id ?? "_autres";
    const g = groupes.get(cle) ?? { nom: c.categorie?.nom ?? "Autres guides", cours: [] as typeof cours };
    g.cours.push(c);
    groupes.set(cle, g);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Guides d'utilisateurs et formation à l'utilisation"
        description="Parcours pratiques pour prendre en main EduWeb Planner, à votre rythme."
      />

      <Link
        href="/app/aide-formation/guides/plateforme"
        className="group flex items-center gap-4 rounded-2xl border border-gold-200 bg-gradient-to-r from-gold-50 to-forest-50/40 p-5 shadow-soft transition hover:border-gold-300"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-600 text-white"><Compass size={24} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-forest-900">Guide complet de la plateforme</h2>
          <p className="text-sm text-ink-700/70">Prise en main, usage détaillé de chaque rôle et chapitre approfondi sur le centre de formation (badges et certificats compris).</p>
        </div>
        <ArrowRight size={20} className="shrink-0 text-forest-600 transition group-hover:translate-x-0.5" />
      </Link>

      <a
        href="/dhfc/module-maitre.html"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-4 rounded-2xl border border-forest-700 bg-gradient-to-r from-forest-600 to-forest-800 p-5 text-white shadow-soft transition hover:from-forest-700 hover:to-forest-900"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><BarChart3 size={24} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold">Module maître interactif — Analyse des besoins DHFC-EBiS</h2>
          <p className="text-sm text-cream-50/85">Version interactive du rapport (graphiques, navigation par chapitre, quiz de maîtrise). La version « cours » éditable figure ci-dessous.</p>
        </div>
        <ArrowUpRight size={20} className="shrink-0 transition group-hover:translate-x-0.5" />
      </a>

      {cours.length === 0 ? (
        <Card className="py-12 text-center">
          <BookOpen size={30} className="mx-auto mb-3 text-forest-300" />
          <p className="text-sm text-ink-700/70">Aucun guide publié pour le moment.</p>
          {estAdmin && (
            <Link href="/app/aide-formation/formations" className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:text-forest-900">
              Gérer le contenu depuis « Formations » →
            </Link>
          )}
        </Card>
      ) : (
        [...groupes.values()].map((g) => (
          <section key={g.nom} className="space-y-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">{g.nom}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.cours.map((c) => {
                const pct = progressionPar.get(c.id);
                const inscrit = pct !== undefined;
                return (
                  <Card key={c.id} className="flex flex-col">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700"><BookOpen size={18} /></span>
                      <h3 className="font-display text-base font-bold text-forest-900">{c.titre}</h3>
                    </div>
                    {c.description && <p className="mb-3 line-clamp-3 text-sm text-ink-700/70">{c.description}</p>}
                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700/60">
                      <span className="inline-flex items-center gap-1.5"><Layers size={13} className="text-forest-600" /> {c._count.modules} leçon(s)</span>
                      {libelleNiveau(c.niveau) && <span>{libelleNiveau(c.niveau)}</span>}
                      {c.dureeMinutes ? <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-forest-600" /> {c.dureeMinutes} min</span> : null}
                    </div>
                    {inscrit && (
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-ink-700/60">Progression</span>
                          <span className="font-semibold text-forest-800">{pct === 100 ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> Terminé</span> : `${pct}%`}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-forest-500" style={{ width: `${pct}%` }} /></div>
                      </div>
                    )}
                    <div className="mt-auto pt-1">
                      <BoutonInscription coursId={c.id} slug={c.slug} inscrit={inscrit} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
