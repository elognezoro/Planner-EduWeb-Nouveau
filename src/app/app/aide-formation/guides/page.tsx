import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Layers, Clock, Settings, CheckCircle2 } from "lucide-react";
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
        action={
          estAdmin ? (
            <Link href="/app/aide-formation/gestion" className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50">
              <Settings size={16} /> Gérer le contenu
            </Link>
          ) : undefined
        }
      />

      {cours.length === 0 ? (
        <Card className="py-12 text-center">
          <BookOpen size={30} className="mx-auto mb-3 text-forest-300" />
          <p className="text-sm text-ink-700/70">Aucun guide publié pour le moment.</p>
          {estAdmin && (
            <Link href="/app/aide-formation/gestion" className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:text-forest-900">
              Créer un premier cours →
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
