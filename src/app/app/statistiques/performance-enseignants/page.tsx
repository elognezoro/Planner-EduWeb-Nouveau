import type { Metadata } from "next";
import { Users, GraduationCap, Gauge } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { ChartBarVertical } from "../etablissement/charts";

export const metadata: Metadata = { title: "Performance des enseignants" };
export const dynamic = "force-dynamic";

const BASE = "/app/statistiques/performance-enseignants";
const ROLES_CHOIX = ["admin", "inspecteur", "drena"];

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function PerformanceEnseignantsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const u = await requireRole(["admin", "chef_etablissement", "inspecteur", "drena"]);
  const sp = await searchParams;
  const peutChoisir = ROLES_CHOIX.includes(u.roleReel);

  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let erreur = false;

  try {
    if (peutChoisir) {
      etablissements = await prisma.etablissement.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } });
      etabId = sp.etab && etablissements.some((e) => e.id === sp.etab) ? sp.etab : null;
    } else {
      etabId = u.portee.etablissementId;
    }
  } catch {
    erreur = true;
  }

  if (!erreur && !etabId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Performance des enseignants" description="Choisissez un établissement." />
        {peutChoisir ? (
          <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
        ) : (
          <Card>
            <p className="text-sm text-ink-700/70">Aucun établissement rattaché à votre périmètre.</p>
          </Card>
        )}
      </div>
    );
  }

  let enseignants: { nom: string; classes: number; moyenne: number | null }[] = [];
  let moyenneGlobale: number | null = null;

  if (!erreur && etabId) {
    try {
      const [affs, notes] = await Promise.all([
        prisma.affectationEnseignant.findMany({
          where: { classe: { etablissementId: etabId } },
          select: { enseignantId: true, classeId: true, disciplineId: true, enseignant: { select: { prenoms: true, nom: true, email: true } } },
        }),
        prisma.note.findMany({
          where: { classe: { etablissementId: etabId } },
          select: { classeId: true, disciplineId: true, valeur: true, sur: true },
        }),
      ]);
      const cle = (c: string, d: string) => `${c}|${d}`;
      const notesParCle = new Map<string, { somme: number; n: number }>();
      for (const n of notes) {
        if (!n.sur) continue;
        const k = cle(n.classeId, n.disciplineId);
        const o = notesParCle.get(k) ?? { somme: 0, n: 0 };
        o.somme += (n.valeur / n.sur) * 20;
        o.n += 1;
        notesParCle.set(k, o);
      }
      const parEns = new Map<string, { nom: string; somme: number; n: number; classes: Set<string> }>();
      for (const a of affs) {
        const e = parEns.get(a.enseignantId) ?? { nom: nomComplet(a.enseignant), somme: 0, n: 0, classes: new Set<string>() };
        e.classes.add(a.classeId);
        const o = notesParCle.get(cle(a.classeId, a.disciplineId));
        if (o) {
          e.somme += o.somme;
          e.n += o.n;
        }
        parEns.set(a.enseignantId, e);
      }
      enseignants = [...parEns.values()]
        .map((e) => ({ nom: e.nom, classes: e.classes.size, moyenne: e.n > 0 ? Math.round((e.somme / e.n) * 10) / 10 : null }))
        .sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
      const avecMoyenne = enseignants.filter((e) => e.moyenne != null);
      if (avecMoyenne.length > 0) {
        moyenneGlobale = Math.round((avecMoyenne.reduce((s, e) => s + (e.moyenne ?? 0), 0) / avecMoyenne.length) * 10) / 10;
      }
    } catch {
      erreur = true;
    }
  }

  const graph = enseignants
    .filter((e) => e.moyenne != null)
    .slice(0, 12)
    .map((e) => ({ label: e.nom.split(" ")[0] ?? e.nom, valeur: e.moyenne as number }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Performance des enseignants"
        description="Moyenne des notes encadrées par enseignant (proxy de résultats, /20)."
      />

      {u.roleReel !== "chef_etablissement" && etabId && (
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
      )}

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les statistiques.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Enseignants" valeur={enseignants.length} icone={<Users size={22} />} />
            <StatCard libelle="Classes encadrées" valeur={enseignants.reduce((s, e) => s + e.classes, 0)} icone={<GraduationCap size={22} />} ton="gold" />
            <StatCard libelle="Moyenne globale /20" valeur={moyenneGlobale ?? "—"} icone={<Gauge size={22} />} />
          </div>

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-forest-900">Moyenne encadrée par enseignant</h2>
            <ChartBarVertical data={graph} nomSerie="Moyenne /20" couleur="#246a48" vide="Aucune note pour estimer la performance." />
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Détail</h2>
            {enseignants.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucun enseignant affecté dans cet établissement.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left">
                      <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Enseignant</th>
                      <th className="px-2 py-2.5 text-right font-semibold text-ink-700/70">Classes</th>
                      <th className="px-2 py-2.5 text-right font-semibold text-ink-700/70">Moyenne /20</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enseignants.map((e) => (
                      <tr key={e.nom} className="border-b border-cream-100 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-forest-900">{e.nom}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/70">{e.classes}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-forest-800">
                          {e.moyenne != null ? e.moyenne.toLocaleString("fr-FR") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
