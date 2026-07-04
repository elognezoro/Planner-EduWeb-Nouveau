import type { Metadata } from "next";
import { ListChecks, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";

export const metadata: Metadata = { title: "Grille d'évaluation" };
export const dynamic = "force-dynamic";

const DOMAINES: { titre: string; criteres: string[] }[] = [
  {
    titre: "Préparation & maîtrise disciplinaire",
    criteres: [
      "Préparation écrite des séances (fiches, progression)",
      "Maîtrise des contenus disciplinaires",
      "Conformité au programme officiel et à la progression annuelle",
      "Pertinence des objectifs d'apprentissage",
    ],
  },
  {
    titre: "Conduite de la classe",
    criteres: [
      "Clarté des consignes et des explications",
      "Gestion du temps et rythme de la séance",
      "Gestion du groupe-classe et climat de travail",
      "Différenciation et prise en compte de l'hétérogénéité",
    ],
  },
  {
    titre: "Évaluation des apprentissages",
    criteres: [
      "Variété et pertinence des évaluations",
      "Exploitation des résultats (remédiation)",
      "Tenue des documents (cahier de texte, registre, notes)",
    ],
  },
  {
    titre: "Posture & relation pédagogique",
    criteres: [
      "Communication et écoute des élèves",
      "Valorisation et encouragement",
      "Exemplarité et déontologie professionnelle",
    ],
  },
];

const ECHELLE = [
  { note: "4", libelle: "Très satisfaisant" },
  { note: "3", libelle: "Satisfaisant" },
  { note: "2", libelle: "À améliorer" },
  { note: "1", libelle: "Insuffisant" },
];

export default async function GrilleEvaluationPage() {
  await requireRole(["admin", "inspecteur", "adjoint_chef_etablissement"]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titre="Grille d'évaluation"
        description="Référentiel des critères d'observation lors des visites d'inspection."
      />

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ListChecks size={18} /> Échelle d&apos;appréciation
        </h2>
        <div className="grid gap-2 sm:grid-cols-4">
          {ECHELLE.map((e) => (
            <div key={e.note} className="rounded-xl border border-cream-200 bg-cream-50/50 p-3 text-center">
              <p className="font-display text-xl font-bold text-forest-800">{e.note}</p>
              <p className="text-xs text-ink-700/65">{e.libelle}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-700/55">
          L&apos;appréciation globale /20 est saisie dans le compte-rendu de chaque visite (Inspection →
          Visites), avec les recommandations associées.
        </p>
      </Card>

      {DOMAINES.map((d) => (
        <Card key={d.titre}>
          <h2 className="mb-3 font-display text-base font-bold text-forest-900">{d.titre}</h2>
          <ul className="space-y-2">
            {d.criteres.map((c) => (
              <li key={c} className="flex items-start gap-2.5 text-sm text-ink-900">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-forest-500" /> {c}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
