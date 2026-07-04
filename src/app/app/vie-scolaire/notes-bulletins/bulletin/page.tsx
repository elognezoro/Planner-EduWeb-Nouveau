import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileBarChart } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";

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
      u.roleReel === "adjoint_chef_etablissement" ||
      u.roleReel === "inspecteur_orientation" ||
      u.roleReel === "educateur")
  ) {
    autorise = classe.etablissementId === u.portee.etablissementId;
  }
  if (!autorise && u.roleReel === "enseignant") {
    autorise = Boolean(
      await prisma.affectationEnseignant.findFirst({
        where: { enseignantId: u.id, classeId },
      }),
    );
  }
  if (!autorise) redirect("/app/vie-scolaire/notes-bulletins");

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
      <Link
        href="/app/vie-scolaire/notes-bulletins"
        className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900"
      >
        <ArrowLeft size={16} /> Retour à la saisie
      </Link>

      <PageHeader
        titre={`Bulletin — ${classe.nom}`}
        description={`${classe.etablissement?.nom ?? ""} · ${classe.niveau.nom} · Période ${periode}`}
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
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
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
          <p className="mt-4 text-xs text-ink-700/55">
            Moyennes ramenées sur 20. La moyenne générale est pondérée par les coefficients de la
            grille horaire (survol d'un en-tête de discipline pour voir son coefficient).
          </p>
        </Card>
      )}
    </div>
  );
}
