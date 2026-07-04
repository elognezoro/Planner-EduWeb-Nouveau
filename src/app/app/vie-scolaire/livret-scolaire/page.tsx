import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, ArrowUpRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";

export const metadata: Metadata = { title: "Livret scolaire" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/livret-scolaire";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

async function livret(eleveId: string) {
  const notes = await prisma.note.findMany({
    where: { eleveId },
    orderBy: { creeLe: "asc" },
    include: { discipline: { select: { nom: true } } },
  });
  // période -> discipline -> {somme, n}
  const parPeriode = new Map<number, Map<string, { somme: number; n: number }>>();
  for (const note of notes) {
    if (!note.sur) continue;
    const v = (note.valeur / note.sur) * 20;
    const d = parPeriode.get(note.periode) ?? new Map();
    const o = d.get(note.discipline.nom) ?? { somme: 0, n: 0 };
    o.somme += v;
    o.n += 1;
    d.set(note.discipline.nom, o);
    parPeriode.set(note.periode, d);
  }
  return [...parPeriode.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([periode, disc]) => {
      const disciplines = [...disc.entries()].map(([nom, o]) => ({ nom, moyenne: Math.round((o.somme / o.n) * 10) / 10 }));
      const moy = disciplines.length > 0 ? Math.round((disciplines.reduce((s, x) => s + x.moyenne, 0) / disciplines.length) * 10) / 10 : null;
      return { periode, disciplines: disciplines.sort((a, b) => a.nom.localeCompare(b.nom)), moyenne: moy };
    });
}

function VueLivret({ periodes }: { periodes: Awaited<ReturnType<typeof livret>> }) {
  if (periodes.length === 0) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-sm text-ink-700/60">
          <BookMarked size={16} /> Aucune note enregistrée pour le moment.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {periodes.map((p) => (
        <Card key={p.periode}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-forest-900">Période {p.periode}</h2>
            {p.moyenne != null && (
              <span className="rounded-full bg-forest-800 px-3 py-0.5 text-sm font-semibold text-gold-300">
                Moyenne {p.moyenne}/20
              </span>
            )}
          </div>
          <ul className="divide-y divide-cream-100">
            {p.disciplines.map((d) => (
              <li key={d.nom} className="flex items-center justify-between py-2 text-sm">
                <span className="text-forest-900">{d.nom}</span>
                <span className="font-display font-bold text-forest-800">{d.moyenne}/20</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export default async function LivretScolairePage({
  searchParams,
}: {
  searchParams: Promise<{ eleve?: string }>;
}) {
  const u = await requireRole([
    "admin",
    "chef_etablissement",
    "adjoint_chef_etablissement",
    "inspecteur_orientation",
    "enseignant",
    "parent",
    "eleve",
  ]);
  const sp = await searchParams;

  if (u.roleReel === "eleve") {
    const periodes = await livret(u.id);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader titre="Mon livret scolaire" description="Vos moyennes par période et discipline." />
        <VueLivret periodes={periodes} />
      </div>
    );
  }

  if (u.roleReel === "parent") {
    const liens = await prisma.lienParentEleve.findMany({
      where: { parentId: u.id },
      include: { eleve: { select: { id: true, prenoms: true, nom: true, email: true } } },
    });
    const enfants = liens.map((l) => ({ id: l.eleve.id, nom: nomComplet(l.eleve) }));
    const sel = enfants.find((e) => e.id === sp.eleve) ?? enfants[0] ?? null;
    const periodes = sel ? await livret(sel.id) : [];
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader titre="Livret scolaire" description="Le parcours de vos enfants." />
        {enfants.length === 0 ? (
          <Card><p className="text-sm text-ink-700/70">Aucun enfant rattaché à votre compte.</p></Card>
        ) : (
          <>
            {enfants.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {enfants.map((e) => (
                  <Link
                    key={e.id}
                    href={`${BASE}?eleve=${e.id}`}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${sel?.id === e.id ? "bg-forest-800 text-cream-50" : "border border-cream-300 bg-white text-forest-800 hover:bg-forest-50"}`}
                  >
                    {e.nom}
                  </Link>
                ))}
              </div>
            )}
            <VueLivret periodes={periodes} />
          </>
        )}
      </div>
    );
  }

  // Personnel : le livret se consulte par élève depuis le bulletin (Notes & bulletins).
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titre="Livret scolaire" description="Parcours scolaire des élèves." />
      <Card>
        <p className="text-sm text-ink-700/70">
          Le livret d&apos;un élève (moyennes par période) est consultable depuis le bulletin.
        </p>
        <Link
          href="/app/vie-scolaire/notes-bulletins"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-forest-700"
        >
          Notes & bulletins <ArrowUpRight size={15} />
        </Link>
      </Card>
    </div>
  );
}
