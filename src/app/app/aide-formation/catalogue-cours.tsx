import { BookOpen, Layers, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/app/ui";
import { NIVEAUX } from "@/lib/lms";
import { BoutonInscription } from "./boutons-lms";

const libelleNiveau = (v: string | null) => NIVEAUX.find((n) => n.v === v)?.libelle ?? null;

export type CoursCatalogue = {
  id: string;
  titre: string;
  slug: string;
  description: string | null;
  niveau: string | null;
  dureeMinutes: number | null;
  categorie: { id: string; nom: string } | null;
  _count: { modules: number };
};

/** Catalogue de cours regroupés par catégorie, avec inscription/progression. Partagé Guides ↔ Formations. */
export function CatalogueCours({
  cours,
  progressionPar,
  categorieParDefaut = "Autres",
}: {
  cours: CoursCatalogue[];
  progressionPar: Map<string, number>;
  categorieParDefaut?: string;
}) {
  const groupes = new Map<string, { nom: string; cours: CoursCatalogue[] }>();
  for (const c of cours) {
    const cle = c.categorie?.id ?? "_autres";
    const g = groupes.get(cle) ?? { nom: c.categorie?.nom ?? categorieParDefaut, cours: [] as CoursCatalogue[] };
    g.cours.push(c);
    groupes.set(cle, g);
  }

  return (
    <>
      {[...groupes.values()].map((g) => (
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
                  <div className="mt-auto pt-1"><BoutonInscription coursId={c.id} slug={c.slug} inscrit={inscrit} /></div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
