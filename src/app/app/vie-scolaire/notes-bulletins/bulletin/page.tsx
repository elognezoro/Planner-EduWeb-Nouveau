import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronDown, FileBarChart } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { libelleNiveauEtablissement } from "@/lib/niveaux/libelle";

export const metadata: Metadata = { title: "Bulletin" };
export const dynamic = "force-dynamic";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function BulletinPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string; periode?: string; etab?: string }>;
}) {
  const u = await requireRole([
    "admin",
    "chef_etablissement",
    "etablissements_admin",
    "adjoint_chef_etablissement",
    "inspecteur_orientation",
    "educateur",
    "enseignant",
  ]);
  const sp = await searchParams;
  const classeId = sp.classe ?? "";
  const periode = Number(sp.periode) || 1;
  if (!classeId) redirect("/app/vie-scolaire/notes-bulletins");

  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    include: { niveau: true, etablissement: { select: { nom: true, pays: true } } },
  });
  if (!classe) redirect("/app/vie-scolaire/notes-bulletins");

  // Contrôle d'accès au périmètre.
  let autorise = u.roleReel === "admin";
  if (
    !autorise &&
    (u.roleReel === "chef_etablissement" ||
      // Parité avec le chef (consigne client) : passe par le test de périmètre, jamais par la
      // branche « admin » ci-dessus qui est sans cloisonnement.
      u.roleReel === "etablissements_admin" ||
      u.roleReel === "adjoint_chef_etablissement" ||
      u.roleReel === "inspecteur_orientation" ||
      u.roleReel === "educateur")
  ) {
    autorise = classe.etablissementId === u.portee.etablissementId;
  }
  if (!autorise && u.roleReel === "enseignant") {
    autorise = Boolean(
      // CLOISONNEMENT : la classe doit appartenir à un établissement de l'enseignant.
      await prisma.affectationEnseignant.findFirst({
        where: { enseignantId: u.id, classeId, classe: { etablissementId: { in: u.portee.etablissementIds } } },
      }),
    );
  }
  if (!autorise) redirect("/app/vie-scolaire/notes-bulletins");

  // Libellé du niveau propre à CET établissement (renommage local) ; repli sur le nom canonique.
  const niveauLibelle = await libelleNiveauEtablissement(classe.etablissementId, classe.niveauId, classe.niveau.nom);

  const [inscriptions, notes, grilles] = await Promise.all([
    prisma.inscription.findMany({
      where: { classeId },
      include: { eleve: { select: { id: true, prenoms: true, nom: true, email: true } } },
    }),
    prisma.note.findMany({
      where: { classeId, periode },
      include: { discipline: { select: { id: true, nom: true } } },
    }),
    prisma.grilleHoraire.findMany({
      where: {
        niveauId: classe.niveauId,
        OR: [
          { etablissementId: classe.etablissementId },
          // Modèle national du pays de l'établissement.
          { etablissementId: null, pays: classe.etablissement?.pays ?? "Côte d'Ivoire" },
        ],
      },
    }),
  ]);

  // Coefficient par discipline : surcharge établissement prioritaire, sinon national, sinon 1.
  const coefNational = new Map<string, number>();
  const coefEtab = new Map<string, number>();
  for (const g of grilles) {
    if (g.etablissementId === null) coefNational.set(g.disciplineId, g.coefficient);
    else coefEtab.set(g.disciplineId, g.coefficient);
  }
  const coefDe = (disciplineId: string) =>
    coefEtab.get(disciplineId) ?? coefNational.get(disciplineId) ?? 1;

  // Disciplines présentes dans les notes.
  const disciplines = new Map<string, string>();
  for (const n of notes) disciplines.set(n.discipline.id, n.discipline.nom);
  const disciplinesListe = [...disciplines.entries()]
    .map(([id, nom]) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  // Moyenne (sur 20) par élève et discipline.
  const moyennes = new Map<string, Map<string, number>>(); // eleveId -> disciplineId -> moyenne/20
  const cumul = new Map<string, { somme: number; total: number }>(); // accumulateur par (eleve+disc)
  for (const n of notes) {
    const cle = `${n.eleveId}:${n.disciplineId}`;
    const c = cumul.get(cle) ?? { somme: 0, total: 0 };
    c.somme += (n.valeur / n.sur) * 20;
    c.total += 1;
    cumul.set(cle, c);
  }
  for (const [cle, c] of cumul) {
    const [eleveId, disciplineId] = cle.split(":");
    if (!moyennes.has(eleveId)) moyennes.set(eleveId, new Map());
    moyennes.get(eleveId)!.set(disciplineId, c.somme / c.total);
  }

  // Moyenne générale par élève (pondérée par coefficient).
  const lignes = inscriptions.map((i) => {
    const m = moyennes.get(i.eleve.id) ?? new Map<string, number>();
    let sommePond = 0;
    let sommeCoef = 0;
    for (const [discId, moy] of m) {
      const coef = coefDe(discId);
      sommePond += moy * coef;
      sommeCoef += coef;
    }
    const generale = sommeCoef > 0 ? sommePond / sommeCoef : null;
    return { eleve: i.eleve, moyennesDisc: m, generale };
  });
  lignes.sort((a, b) => (b.generale ?? -1) - (a.generale ?? -1));

  const fmt = (v: number | null) =>
    v === null ? "—" : v.toFixed(2).replace(".", ",");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Téléphone : masqué, l'en-tête mobile porte déjà le bouton retour. */}
      <Link
        href="/app/vie-scolaire/notes-bulletins"
        className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 mobile:hidden"
      >
        <ArrowLeft size={16} /> Retour à la saisie
      </Link>

      <PageHeader
        titre={`Bulletin — ${classe.nom}`}
        description={`${classe.etablissement?.nom ?? ""} · ${niveauLibelle} · Période ${periode}`}
      />

      {notes.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-500">
            <FileBarChart size={26} />
          </span>
          <p className="mt-4 text-sm text-ink-700/65">
            Aucune note saisie pour cette classe et cette période.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto mobile:p-4">
          {/* Matrice élèves × disciplines : ordinateur et impression ; remplacée à l'écran du
              téléphone par les cartes ci-dessous (plus de défilement latéral). */}
          <table className="w-full min-w-[640px] border-collapse text-sm masque-ecran-mobile">
            <thead>
              <tr className="border-b border-cream-200 text-left">
                <th className="py-2.5 pr-3 font-semibold text-ink-700/70">Rang</th>
                <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Élève</th>
                {disciplinesListe.map((d) => (
                  <th key={d.id} className="px-2 py-2.5 text-center font-semibold text-ink-700/70" title={`coef. ${coefDe(d.id)}`}>
                    {d.nom}
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center font-semibold text-forest-800">Moy. gén.</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, idx) => (
                <tr key={l.eleve.id} className="border-b border-cream-100 last:border-0">
                  <td className="py-2 pr-3 text-ink-700/60">{idx + 1}</td>
                  <td className="py-2 pr-4 font-medium text-forest-900">{nomComplet(l.eleve)}</td>
                  {disciplinesListe.map((d) => (
                    <td key={d.id} className="px-2 py-2 text-center text-ink-800">
                      {fmt(l.moyennesDisc.get(d.id) ?? null)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-bold text-forest-800">
                    {fmt(l.generale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Téléphone : une carte par élève (rang, nom, moyenne générale) ; le détail par
              discipline, avec son coefficient, se déplie au toucher. */}
          <ol className="space-y-2.5 lg:hidden print:hidden">
            {lignes.map((l, idx) => (
              <li key={l.eleve.id} className="rounded-2xl border border-cream-200 bg-cream-50/40">
                <details className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
                    <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-ink-700/70">{idx + 1}</span>
                    <span className="min-w-0 flex-1 font-semibold leading-snug text-forest-900 wrap-break-word">{nomComplet(l.eleve)}</span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-xl font-bold leading-tight tabular-nums text-forest-800">{fmt(l.generale)}</span>
                      <span className="block text-xs text-ink-700/70">moy. gén.</span>
                    </span>
                    <ChevronDown aria-hidden size={18} className="shrink-0 text-ink-700/60 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="divide-y divide-cream-100 border-t border-cream-200 px-3.5">
                    {disciplinesListe.map((d) => (
                      <li key={d.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 text-ink-800 wrap-break-word">
                          {d.nom} <span className="text-xs text-ink-700/70">coef. {coefDe(d.id)}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-forest-900">{fmt(l.moyennesDisc.get(d.id) ?? null)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-ink-700/55 mobile:text-ink-700/70">
            Moyennes ramenées sur 20. La moyenne générale est pondérée par les coefficients de la
            grille horaire <span className="mobile:hidden">(survol d&apos;un en-tête de discipline pour voir son coefficient)</span>
            <span className="hidden mobile:inline">(touchez un élève pour voir ses moyennes et les coefficients)</span>.
          </p>
        </Card>
      )}
    </div>
  );
}
