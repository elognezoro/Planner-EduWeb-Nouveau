import type { Metadata } from "next";
import Link from "next/link";
import { Stamp, CheckCircle2, ListChecks, Download, Check, Gauge } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { peutModifierVisite } from "@/lib/inspection/droits-visite";
import {
  lireReponsesGrille,
  noteDeriveeGrille,
  scoresParCompetence,
  libelleAppreciation,
} from "@/lib/inspection/grille-supervision";
import { PageHeader, Card, StatCard, Badge } from "@/components/app/ui";
import {
  BandeauAllerA,
  BandeauFiltres,
  RapportForm,
  RadarProfil,
  NavigateurFlottant,
} from "./components";

export const metadata: Metadata = { title: "Rapports d'inspection" };
export const dynamic = "force-dynamic";

const STATUT: Record<string, { texte: string; ton: "succes" | "attente" | "refus" }> = {
  planifiee: { texte: "Planifiée", ton: "attente" },
  realisee: { texte: "Réalisée", ton: "succes" },
  annulee: { texte: "Annulée", ton: "refus" },
};

/** Classes du badge qualitatif du score global, par ton renvoyé par `libelleAppreciation`. */
const TON_APPRECIATION: Record<string, string> = {
  vert: "bg-forest-700 text-cream-50",
  "vert-clair": "bg-forest-100 text-forest-800",
  dore: "bg-gold-100 text-gold-800",
  rouge: "bg-red-100 text-red-700",
};

const dateCourte = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(d);
const nomComplet = (p: { prenoms: string | null; nom: string | null; email: string }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;

/** Année scolaire de la date de visite (septembre → août) : « 2025-2026 ». */
function anneeScolaireDe(date: Date): string {
  const annee = date.getUTCFullYear();
  return date.getUTCMonth() >= 8 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
}

export default async function RapportsInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ visite?: string }>;
}) {
  const u = await requireRole(["admin", "inspecteur", "drena"]);
  const sp = await searchParams;

  // Périmètre de LECTURE inchangé : inspecteur → ses visites ; drena → sa région ; admin → tout.
  const where =
    u.roleReel === "inspecteur"
      ? { inspecteurId: u.id }
      : u.roleReel === "drena"
        ? { etablissement: { regionId: u.portee.regionId ?? "__aucune__" } }
        : {};

  const visites = await prisma.visite.findMany({
    where,
    orderBy: { date: "desc" },
    take: 30,
    include: { etablissement: { select: { nom: true } }, recommandations: { select: { statut: true } } },
  });

  const realisees = visites.filter((v) => v.statut === "realisee").length;
  const recosTotal = visites.reduce((s, v) => s + v.recommandations.length, 0);
  const recosOuvertes = visites.reduce((s, v) => s + v.recommandations.filter((r) => r.statut !== "traitee").length, 0);
  const notes = visites.filter((v) => v.noteGlobale != null).map((v) => v.noteGlobale as number);
  const moyenne = notes.length > 0 ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10 : null;

  // ── Visites proposées au FILTRE : même périmètre, limitées à celles avec enseignant. ──
  const visitesFiltre = await prisma.visite.findMany({
    where: { ...where, enseignantId: { not: null } },
    orderBy: { date: "desc" },
    take: 50,
    select: {
      id: true,
      date: true,
      enseignantId: true,
      etablissementId: true,
      etablissement: { select: { nom: true } },
      enseignant: { select: { prenoms: true, nom: true, email: true } },
    },
  });

  // Discipline de chaque enseignant DANS son établissement (CompetenceEnseignant), en une requête.
  const paires = visitesFiltre
    .filter((v) => v.enseignantId != null)
    .map((v) => ({ enseignantId: v.enseignantId as string, etablissementId: v.etablissementId }));
  const competences =
    paires.length > 0
      ? await prisma.competenceEnseignant.findMany({
          where: { OR: paires },
          select: { enseignantId: true, etablissementId: true, discipline: { select: { nom: true } } },
        })
      : [];
  const disciplinesPar = new Map<string, Set<string>>();
  for (const c of competences) {
    const cle = `${c.enseignantId}|${c.etablissementId}`;
    const ens = disciplinesPar.get(cle) ?? new Set<string>();
    ens.add(c.discipline.nom);
    disciplinesPar.set(cle, ens);
  }
  const libelleVisite = (v: (typeof visitesFiltre)[number]): string => {
    const enseignant = v.enseignant ? nomComplet(v.enseignant) : "Enseignant inconnu";
    const discipline = [...(disciplinesPar.get(`${v.enseignantId}|${v.etablissementId}`) ?? [])].join(" / ");
    return `${enseignant} — ${[discipline, v.etablissement.nom, dateCourte(v.date)].filter(Boolean).join(" · ")}`;
  };
  const optionsFiltre = visitesFiltre.map((v) => ({ id: v.id, nom: libelleVisite(v) }));

  // ?visite= REVALIDÉ dans le même périmètre (fail-closed) : hors liste → la plus récente.
  const demande = typeof sp.visite === "string" ? sp.visite : null;
  const retenue = (demande && visitesFiltre.find((v) => v.id === demande)) || visitesFiltre[0] || null;

  const visite = retenue
    ? await prisma.visite.findUnique({
        where: { id: retenue.id },
        include: {
          etablissement: { select: { nom: true } },
          enseignant: { select: { prenoms: true, nom: true, email: true } },
          grille: { select: { reponses: true, pointsForts: true, pointsAmeliorer: true, propositions: true } },
        },
      })
    : null;

  // Écriture : garde unique partagée avec l'action (le DRENA reste LECTEUR — textareas figés).
  const lectureSeule = visite ? !(await peutModifierVisite(u, visite.id)) : true;

  // Score global : noteGlobale de la visite si renseignée, SINON note dérivée de la grille.
  const reponses = lireReponsesGrille(visite?.grille?.reponses);
  const noteDerivee = visite?.grille ? noteDeriveeGrille(reponses) : null;
  const score = visite?.noteGlobale ?? noteDerivee;
  const scoreDerive = visite != null && visite.noteGlobale == null && noteDerivee != null;
  const appreciation = score != null ? libelleAppreciation(score) : null;
  const profil = scoresParCompetence(reponses).map((c) => ({ competence: c.libelleCourt, valeur: c.valeur }));

  // Badge de l'en-tête : pays consulté (helper serveur) + année scolaire de la visite retenue.
  const pays = (await paysConsulte()) || "Côte d'Ivoire";
  const anneeScolaire = anneeScolaireDe(visite?.date ?? new Date());

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Rapports d'inspection"
        description="Rédigez le rapport d'inspection à partir de la grille : points forts, axes de progrès, recommandations."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-800">
              {pays} · {anneeScolaire}
            </span>
            {visite && (
              <Link
                href={`/app/inspection/visites/${visite.id}/grille/imprimer`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50"
              >
                <Download size={15} /> Exporter
              </Link>
            )}
            {visite && !lectureSeule && (
              /* Soumet le formulaire du rapport (id partagé avec `components.tsx`). */
              <button
                type="submit"
                form="form-rapport-inspection"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 shadow-soft transition-all hover:-translate-y-0.5 hover:bg-forest-700"
              >
                <Check size={15} /> Valider
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard libelle="Visites" valeur={visites.length} icone={<Stamp size={22} />} />
        <StatCard libelle="Réalisées" valeur={realisees} icone={<CheckCircle2 size={22} />} ton="gold" />
        <StatCard libelle="Recommandations" valeur={recosTotal} icone={<ListChecks size={22} />} />
        <StatCard libelle="À suivre" valeur={recosOuvertes} icone={<ListChecks size={22} />} ton="gold" />
      </div>

      <BandeauAllerA />
      <BandeauFiltres
        options={optionsFiltre}
        defaut={retenue ? { id: retenue.id, nom: libelleVisite(retenue) } : null}
      />

      {visite ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Colonne GAUCHE (2/3) : les 3 sections éditables reliées à la grille de supervision. */}
          <div className="lg:col-span-2">
            <RapportForm
              visiteId={visite.id}
              lectureSeule={lectureSeule}
              initiale={{
                pointsForts: visite.grille?.pointsForts ?? "",
                pointsAmeliorer: visite.grille?.pointsAmeliorer ?? "",
                propositions: visite.grille?.propositions ?? "",
              }}
            />
          </div>

          {/* Colonne DROITE (1/3) : score global + profil d'évaluation par compétence. */}
          <div className="space-y-6">
            <Card id="score-global" className="scroll-mt-24">
              <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
                <Gauge size={18} /> Score global
              </h2>
              {score != null && appreciation ? (
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <p className="font-display text-5xl font-bold text-forest-900">
                    {score}
                    <span className="text-xl font-semibold text-ink-700/50">/20</span>
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TON_APPRECIATION[appreciation.ton]}`}
                  >
                    {appreciation.texte}
                  </span>
                  {scoreDerive && (
                    <p className="text-xs text-ink-700/55">
                      Note dérivée de la grille (moyenne des indicateurs appréciés).
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-2 text-sm text-ink-700/60">
                  Aucune note pour cette visite : renseignez la note globale du compte-rendu ou
                  appréciez les indicateurs de la grille de supervision.
                </p>
              )}
            </Card>

            <Card>
              <h2 className="font-display text-base font-bold text-forest-900">Profil d&apos;évaluation</h2>
              <p className="mt-0.5 mb-2 text-xs font-semibold text-ink-700/55">Par compétence de la grille</p>
              {visite.grille ? (
                <RadarProfil donnees={profil} />
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-cream-300 bg-cream-50 p-4">
                  <p className="text-sm text-ink-700/70">
                    Cette visite n&apos;a pas encore de grille de supervision : remplissez-la pour
                    obtenir le profil d&apos;évaluation par compétence.
                  </p>
                  <Link
                    href={`/app/inspection/visites/${visite.id}/grille`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-forest-700"
                  >
                    <ListChecks size={14} /> Remplir la grille
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-ink-700/60">
            Aucune visite avec un enseignant identifié dans votre périmètre : planifiez une visite
            de classe pour rédiger un rapport d&apos;inspection.
          </p>
        </Card>
      )}

      {/* Visites récentes (liste existante, conservée sous le bloc de rapport). */}
      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">
          Visites récentes{moyenne != null && ` · appréciation moyenne ${moyenne}/20`}
        </h2>
        {visites.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune visite enregistrée.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {visites.map((v) => {
              const st = STATUT[v.statut] ?? STATUT.planifiee;
              return (
                <li key={v.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-forest-900">{v.etablissement.nom}</p>
                    <p className="text-xs text-ink-700/60">
                      {v.objet} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(v.date)} ·{" "}
                      {v.recommandations.length} recommandation(s)
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {v.noteGlobale != null && (
                      <span className="rounded-full bg-forest-800 px-2 py-0.5 text-xs font-semibold text-gold-300">{v.noteGlobale}/20</span>
                    )}
                    <Badge ton={st.ton}>{st.texte}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <NavigateurFlottant />
    </div>
  );
}
