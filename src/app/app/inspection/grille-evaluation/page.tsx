import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, UserRound, FileSignature, PenLine } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";
import { ECHELLE, IDENTIFICATION, COMPETENCES, SYNTHESE } from "@/lib/inspection/grille-supervision";

export const metadata: Metadata = { title: "Grille d'évaluation" };
export const dynamic = "force-dynamic";

/*
 * Référentiel officiel MENA « Grille de supervision des professeurs du secondaire » : les
 * données (échelle, identification, compétences, synthèse) vivent dans le module partagé
 * `src/lib/inspection/grille-supervision.ts` — la SAISIE de la grille se fait depuis chaque
 * visite (Inspection → Visites → « Grille de supervision »).
 */

export default async function GrilleEvaluationPage() {
  await requireRole(["admin", "inspecteur", "adjoint_chef_etablissement"]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Grille d'évaluation"
        description="Grille de supervision des professeurs du secondaire — référentiel officiel des visites (Antenne de la Pédagogie et de la Formation Continue)."
      />

      {/* La grille se remplit EN LIGNE depuis chaque visite — cette page reste le référentiel. */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-800">
        <PenLine size={17} className="mt-0.5 shrink-0" />
        <span>
          Cette page présente le référentiel officiel. La grille se remplit en ligne depuis chaque
          visite d&apos;inspection :{" "}
          <Link href="/app/inspection/visites" className="font-semibold underline">
            Inspection → Visites
          </Link>{" "}
          → bouton « Grille de supervision » de la visite concernée (avec fiche imprimable à en-tête
          officiel une fois la grille remplie).
        </span>
      </div>

      {/* Échelle d'appréciation officielle (consigne de la grille). */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ListChecks size={18} /> Échelle d&apos;appréciation
        </h2>
        <div className="grid gap-2 sm:grid-cols-4">
          {ECHELLE.map((e) => (
            <div key={e.code} className="rounded-xl border border-cream-200 bg-cream-50/50 p-3 text-center">
              <p className="font-display text-xl font-bold text-forest-800">{e.code}</p>
              <p className="text-xs text-ink-700/65">{e.libelle}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-700/55">
          Consigne : indiquez votre appréciation pour chacun des énoncés de la grille en cochant la case
          appropriée. L&apos;appréciation globale /20 est saisie dans le compte-rendu de chaque visite
          (Inspection → Visites), avec les recommandations associées.
        </p>
      </Card>

      {/* I - Identification de l'enseignant.e (volet d'en-tête de la grille officielle). */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <UserRound size={18} /> I — Identification de l&apos;enseignant.e
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {IDENTIFICATION.map((g) => (
            <div key={g.groupe}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">{g.groupe}</p>
              <ul className="space-y-1.5">
                {g.champs.map((c) => (
                  <li key={c} className="rounded-lg border border-cream-200 bg-cream-50/40 px-3 py-1.5 text-sm text-ink-900">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Les 4 compétences de la grille officielle : items, critères et indicateurs à apprécier. */}
      {COMPETENCES.map((comp) => (
        <Card key={comp.numero}>
          <h2 className="mb-3 font-display text-base font-bold text-forest-900">
            {comp.numero} — {comp.titre}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-cream-50 text-left text-xs uppercase tracking-wide text-forest-800">
                  <th className="border border-cream-200 p-2 font-semibold">Élément d&apos;appréciation</th>
                  <th className="border border-cream-200 p-2 font-semibold">Critère</th>
                  <th className="border border-cream-200 p-2 font-semibold">Indicateurs</th>
                  {ECHELLE.map((e) => (
                    <th key={e.code} title={e.libelle} className="w-10 border border-cream-200 p-2 text-center font-semibold">
                      {e.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comp.items.map((item) =>
                  item.indicateurs.map((indicateur, i) => (
                    <tr key={`${item.numero}-${i}`} className="align-top">
                      {i === 0 && (
                        <td rowSpan={item.indicateurs.length} className="border border-cream-200 p-2 text-ink-900">
                          <span className="font-semibold text-forest-900">{item.numero}</span> {item.enonce}
                        </td>
                      )}
                      {i === 0 && (
                        <td rowSpan={item.indicateurs.length} className="border border-cream-200 p-2 text-ink-700/80">
                          {item.critere}
                        </td>
                      )}
                      <td className="border border-cream-200 p-2 text-ink-900">{indicateur}</td>
                      {ECHELLE.map((e) => (
                        <td key={e.code} className="border border-cream-200 p-2 text-center text-ink-700/30">
                          <span className="inline-block h-4 w-4 rounded border border-cream-300 bg-white align-middle" aria-hidden />
                        </td>
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* Rubriques de synthèse et signatures (fin de la grille officielle). */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileSignature size={18} /> Synthèse de la supervision
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SYNTHESE.map((s) => (
            <div key={s.titre} className="rounded-xl border border-cream-200 bg-cream-50/40 p-3">
              <p className="text-sm font-semibold text-forest-900">{s.titre}</p>
              <p className="mt-1 text-xs text-ink-700/65">{s.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-700/55">
          La grille officielle se conclut par la date et le lieu (« Fait à …, le … »), puis les noms,
          prénoms et signatures de l&apos;enseignant.e et du (de la) superviseur.e.
        </p>
      </Card>
    </div>
  );
}
