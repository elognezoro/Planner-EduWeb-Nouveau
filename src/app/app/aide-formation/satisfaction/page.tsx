import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Star, ThumbsUp, MessageSquare, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";

export const metadata: Metadata = { title: "Satisfaction — Séminaire Magnifica Humanitas" };
export const dynamic = "force-dynamic";

const SEMINAIRE = "magnifica-humanitas";
const BASE = "/app/aide-formation";

const CRITERES = [
  { key: "appreciationGlobale", label: "Appréciation globale" },
  { key: "contenuClair", label: "Contenus clairs et compréhensibles" },
  { key: "contenuPertinent", label: "Contenus pertinents pour ma mission" },
  { key: "activitesUtiles", label: "Activités interactives utiles à l'apprentissage" },
  { key: "rythmeAdapte", label: "Durée et rythme adaptés" },
  { key: "navigationAisee", label: "Navigation aisée dans le séminaire" },
  { key: "applicationConcrete", label: "Je vais appliquer concrètement" },
  { key: "usageResponsable", label: "Aide à un usage plus responsable de l'IA" },
] as const;

const dateHeure = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function moyenne(valeurs: (number | null)[]): number | null {
  const v = valeurs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function Barre({ label, moy }: { label: string; moy: number | null }) {
  const pct = moy === null ? 0 : (moy / 5) * 100;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-700/80">{label}</span>
        <span className="shrink-0 font-display text-sm font-bold text-forest-900">
          {moy === null ? "—" : `${moy.toFixed(1)} / 5`}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-cream-200">
        <div className="h-full rounded-full bg-forest-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function SatisfactionPage() {
  await requireRole(["admin"]);

  const reponses = await prisma.enqueteSatisfaction.findMany({
    where: { seminaire: SEMINAIRE },
    orderBy: { creeLe: "desc" },
  });

  const total = reponses.length;
  const moyGlobale = moyenne(reponses.map((r) => r.appreciationGlobale));

  // Indice de recommandation (type NPS) sur 0–10 : promoteurs (9-10) − détracteurs (0-6).
  const recos = reponses.map((r) => r.recommandation).filter((x): x is number => x !== null);
  const promoteurs = recos.filter((n) => n >= 9).length;
  const detracteurs = recos.filter((n) => n <= 6).length;
  const nps = recos.length ? Math.round(((promoteurs - detracteurs) / recos.length) * 100) : null;
  const pctPromoteurs = recos.length ? Math.round((promoteurs / recos.length) * 100) : null;

  const commentaires = reponses
    .filter((r) => r.pointsForts || r.pointsAmeliorer || r.suggestions)
    .slice(0, 30);

  return (
    <div>
      <PageHeader
        titre="Satisfaction — Magnifica Humanitas"
        description="Résultats de l'enquête de satisfaction de fin de séminaire (réponses anonymes)."
        action={
          <Link
            href={BASE}
            className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:border-forest-300"
          >
            <ArrowLeft className="h-4 w-4" /> Aide &amp; Formation
          </Link>
        }
      />

      {total === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Aucune réponse pour le moment. Les réponses des participants au questionnaire de fin de séminaire
            apparaîtront ici dès leur soumission.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard libelle="Réponses reçues" valeur={total} icone={<Users className="h-5 w-5" />} />
            <StatCard
              libelle="Satisfaction moyenne"
              valeur={moyGlobale === null ? "—" : `${moyGlobale.toFixed(1)}/5`}
              icone={<Star className="h-5 w-5" />}
              ton="gold"
            />
            <StatCard
              libelle="Indice de recommandation"
              valeur={nps === null ? "—" : nps}
              icone={<ThumbsUp className="h-5 w-5" />}
            />
            <StatCard
              libelle="Recommanderaient (9-10/10)"
              valeur={pctPromoteurs === null ? "—" : `${pctPromoteurs}%`}
              icone={<ThumbsUp className="h-5 w-5" />}
              ton="gold"
            />
          </div>

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Notes moyennes par critère</h2>
            <div className="space-y-4">
              {CRITERES.map((c) => (
                <Barre key={c.key} label={c.label} moy={moyenne(reponses.map((r) => r[c.key as keyof typeof r] as number | null))} />
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-forest-700" />
              <h2 className="font-display text-base font-bold text-forest-900">
                Commentaires libres <span className="text-ink-700/55">({commentaires.length})</span>
              </h2>
            </div>
            {commentaires.length === 0 ? (
              <p className="text-sm text-ink-700/70">Aucun commentaire libre pour l'instant.</p>
            ) : (
              <ul className="space-y-4">
                {commentaires.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-cream-200 bg-cream-50/60 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-700/60">
                      <span>{dateHeure(r.creeLe)}</span>
                      {r.role && <span className="rounded-full bg-forest-100 px-2 py-0.5 font-semibold text-forest-800">{r.role}</span>}
                      {r.pays && <span className="rounded-full bg-gold-100 px-2 py-0.5 font-semibold text-gold-800">{r.pays}</span>}
                      {r.appreciationGlobale !== null && (
                        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-gold-700">
                          <Star className="h-3.5 w-3.5 fill-current" /> {r.appreciationGlobale}/5
                        </span>
                      )}
                    </div>
                    {r.pointsForts && <p className="text-sm text-ink-700/85"><b className="text-forest-800">Points forts :</b> {r.pointsForts}</p>}
                    {r.pointsAmeliorer && <p className="mt-1 text-sm text-ink-700/85"><b className="text-forest-800">À améliorer :</b> {r.pointsAmeliorer}</p>}
                    {r.suggestions && <p className="mt-1 text-sm text-ink-700/85"><b className="text-forest-800">Suggestions :</b> {r.suggestions}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
