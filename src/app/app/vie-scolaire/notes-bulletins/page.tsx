import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileBarChart } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { infosRegime, type InfosRegime } from "@/lib/vie-scolaire/regime";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import { NotesForm } from "./form";

export const metadata: Metadata = { title: "Notes & bulletins" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/notes-bulletins";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function NotesBulletinsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string; classe?: string; discipline?: string; periode?: string }>;
}) {
  const u = await requireRole([
    "admin",
    "super_admin_etablissements",
    "chef_etablissement",
    "adjoint_chef_etablissement",
    "inspecteur_orientation",
    "educateur",
    "enseignant",
  ]);
  const sp = await searchParams;

  let classes: { id: string; nom: string }[] = [];
  let disciplines: { id: string; nom: string }[] = [];
  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let adminSansEtab = false;
  let regime: InfosRegime = infosRegime();
  let erreur = false;

  try {
    const config = await prisma.configuration.findUnique({ where: { id: "global" } });

    if (u.roleReel === "enseignant") {
      const affs = await prisma.affectationEnseignant.findMany({
        where: { enseignantId: u.id },
        include: { classe: { select: { id: true, nom: true } }, discipline: { select: { id: true, nom: true } } },
      });
      const mapC = new Map(affs.map((a) => [a.classe.id, a.classe]));
      const mapD = new Map(affs.map((a) => [a.discipline.id, a.discipline]));
      classes = [...mapC.values()].sort((a, b) => a.nom.localeCompare(b.nom));
      disciplines = [...mapD.values()].sort((a, b) => a.nom.localeCompare(b.nom));
    } else if (
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement" ||
      u.roleReel === "inspecteur_orientation" ||
      u.roleReel === "educateur"
    ) {
      etabId = u.portee.etablissementId;
      if (etabId) {
        [classes, disciplines] = await Promise.all([
          prisma.classe.findMany({ where: { etablissementId: etabId }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
          prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
        ]);
      }
    } else {
      const ctx = await resoudreEtablissement(u, sp.etab);
      etablissements = ctx.etablissements;
      etabId = ctx.etabId;
      if (!etabId) adminSansEtab = true;
      else {
        [classes, disciplines] = await Promise.all([
          prisma.classe.findMany({ where: { etablissementId: etabId }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
          prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
        ]);
      }
    }

    // Régime de notation : celui choisi par l'établissement concerné, sinon Configuration générale.
    const etabRegimeId = etabId ?? u.portee.etablissementId ?? null;
    const etabRegime = etabRegimeId
      ? await prisma.etablissement.findUnique({
          where: { id: etabRegimeId },
          select: { regimeNotation: true, nbSequences: true },
        })
      : null;
    regime = infosRegime(etabRegime?.regimeNotation, etabRegime?.nbSequences, config?.regimeNotation);
  } catch (e) {
    console.error("[notes] DB indisponible :", e);
    erreur = true;
  }

  if (adminSansEtab) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader titre="Notes & bulletins" description="Choisissez un établissement." />
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
      </div>
    );
  }

  const periodes = Array.from({ length: regime.nbPeriodes }, (_, i) => i + 1);
  const libellePeriode = regime.libellePeriode;
  const classeSel = classes.find((c) => c.id === sp.classe) ?? null;
  const disciplineSel = disciplines.find((d) => d.id === sp.discipline) ?? null;
  const periodeSel = periodes.includes(Number(sp.periode)) ? Number(sp.periode) : 1;

  let eleves: { eleveId: string; nom: string }[] = [];
  let notesRecentes: { id: string; eleveNom: string; libelle: string; valeur: number; sur: number }[] = [];

  if (!erreur && classeSel && disciplineSel) {
    try {
      const [inscriptions, notes] = await Promise.all([
        prisma.inscription.findMany({
          where: { classeId: classeSel.id },
          include: { eleve: { select: { id: true, prenoms: true, nom: true, email: true } } },
        }),
        prisma.note.findMany({
          where: { classeId: classeSel.id, disciplineId: disciplineSel.id, periode: periodeSel },
          orderBy: { creeLe: "desc" },
          take: 30,
          include: { eleve: { select: { prenoms: true, nom: true, email: true } } },
        }),
      ]);
      eleves = inscriptions
        .map((i) => ({ eleveId: i.eleve.id, nom: nomComplet(i.eleve) }))
        .sort((a, b) => a.nom.localeCompare(b.nom));
      notesRecentes = notes.map((n) => ({
        id: n.id,
        eleveNom: nomComplet(n.eleve),
        libelle: n.libelle,
        valeur: n.valeur,
        sur: n.sur,
      }));
    } catch (e) {
      console.error("[notes] chargement :", e);
      erreur = true;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        titre="Notes & bulletins"
        description="Saisissez les notes par classe, discipline et période, puis générez les bulletins."
        action={
          classeSel ? (
            <Link
              href={`${BASE}/bulletin?classe=${classeSel.id}&periode=${periodeSel}${etabId ? `&etab=${etabId}` : ""}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50"
            >
              <FileBarChart size={16} /> Voir le bulletin
            </Link>
          ) : undefined
        }
      />

      {(u.roleReel === "admin" || u.roleReel === "super_admin_etablissements") && etabId && (
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
      )}

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les données.</p>
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            {u.roleReel === "enseignant"
              ? "Vous n'êtes affecté à aucune classe."
              : "Aucune classe disponible."}
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
              {etabId && <input type="hidden" name="etab" value={etabId} />}
              <div className="min-w-[9rem] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Classe</label>
                <select name="classe" defaultValue={classeSel?.id ?? ""} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  <option value="" disabled>Choisir…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div className="min-w-[9rem] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Discipline</label>
                <select name="discipline" defaultValue={disciplineSel?.id ?? ""} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  <option value="" disabled>Choisir…</option>
                  {disciplines.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Période</label>
                <select name="periode" defaultValue={periodeSel} className="h-11 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
                  {periodes.map((p) => <option key={p} value={p}>{libellePeriode} {p}</option>)}
                </select>
              </div>
              <button type="submit" className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700">
                Charger
              </button>
            </form>
          </Card>

          {classeSel && disciplineSel && (
            <Card>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
                <BookOpen size={18} /> {classeSel.nom} · {disciplineSel.nom} · {libellePeriode} {periodeSel}
              </h2>
              <NotesForm
                classeId={classeSel.id}
                disciplineId={disciplineSel.id}
                periode={periodeSel}
                eleves={eleves}
              />
            </Card>
          )}

          {classeSel && disciplineSel && notesRecentes.length > 0 && (
            <Card>
              <h2 className="mb-3 font-display text-base font-bold text-forest-900">
                Notes saisies ({notesRecentes.length})
              </h2>
              <ul className="divide-y divide-cream-100 text-sm">
                {notesRecentes.map((n) => (
                  <li key={n.id} className="flex items-center justify-between py-2">
                    <span className="text-forest-900">{n.eleveNom}</span>
                    <span className="text-ink-700/70">
                      {n.libelle} · <span className="font-semibold text-forest-800">{n.valeur}</span>/{n.sur}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
