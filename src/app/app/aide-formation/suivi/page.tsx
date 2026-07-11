import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, Settings2, BookOpen, Users, ClipboardList, CheckCircle2, Target, CalendarDays,
  ListChecks, Video, MapPin, GraduationCap, Activity,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard, Badge } from "@/components/app/ui";
import { FORMATS_SESSION } from "@/lib/lms";
import { TableauCours, type LigneCours } from "./suivi-table";
import { ChartInscriptionsCategorie, ChartInscriptionsTemps, ChartAvancement } from "./suivi-charts";

export const metadata: Metadata = { title: "Suivi des apprenants — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const SANS_CAT = "Sans catégorie";

const formatSession = (v: string) => FORMATS_SESSION.find((f) => f.v === v)?.libelle ?? v;
const dateCourte = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const dateHeure = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const nomApprenant = (u: { nom: string | null; prenoms: string | null; email: string }) =>
  [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email;

function SectionTitre({ icone, titre, sousTitre }: { icone: React.ReactNode; titre: string; sousTitre?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">{icone}</span>
      <div>
        <h2 className="font-display text-base font-bold text-forest-900">{titre}</h2>
        {sousTitre && <p className="text-sm text-ink-700/60">{sousTitre}</p>}
      </div>
    </div>
  );
}

export default async function SuiviApprenantsPage() {
  await requireRole(["admin"]);
  const now = new Date();

  const [coursCatalogue, inscriptions, quizCatalogue, tentatives, sessions, recemmentActifs] = await Promise.all([
    prisma.cours.findMany({
      orderBy: [{ statut: "asc" }, { titre: "asc" }],
      select: { id: true, slug: true, titre: true, statut: true, categorie: { select: { nom: true } }, _count: { select: { modules: true } } },
    }),
    prisma.inscriptionCours.findMany({
      select: { coursId: true, utilisateurId: true, progressionPct: true, statut: true, dateInscription: true },
    }),
    prisma.quiz.findMany({
      select: { id: true, seuilReussite: true, module: { select: { titre: true, cours: { select: { titre: true } } } }, _count: { select: { questions: true } } },
    }),
    prisma.tentativeQuiz.findMany({ select: { quizId: true, pourcentage: true, reussi: true } }),
    prisma.sessionFormation.findMany({
      orderBy: { dateDebut: "asc" },
      select: { id: true, titre: true, format: true, dateDebut: true, placesMax: true, statut: true, _count: { select: { inscriptions: true } } },
    }),
    prisma.inscriptionCours.findMany({
      orderBy: { derniereActivite: "desc" },
      take: 8,
      select: { progressionPct: true, statut: true, derniereActivite: true, cours: { select: { titre: true } }, utilisateur: { select: { nom: true, prenoms: true, email: true } } },
    }),
  ]);

  // ── KPIs globaux ────────────────────────────────────────────
  const totalInscriptions = inscriptions.length;
  const termineesTotal = inscriptions.filter((i) => i.statut === "termine").length;
  const tauxCompletion = totalInscriptions ? Math.round((termineesTotal / totalInscriptions) * 100) : 0;
  const apprenants = new Set(inscriptions.map((i) => i.utilisateurId)).size;
  const coursPublies = coursCatalogue.filter((c) => c.statut === "publie").length;
  const tentativesTotal = tentatives.length;
  const tauxReussite = tentativesTotal ? Math.round((tentatives.filter((t) => t.reussi).length / tentativesTotal) * 100) : 0;

  // ── Agrégation par cours ────────────────────────────────────
  const parCours = new Map<string, { inscrits: number; sommeProg: number; termines: number }>();
  for (const i of inscriptions) {
    const e = parCours.get(i.coursId) ?? { inscrits: 0, sommeProg: 0, termines: 0 };
    e.inscrits++; e.sommeProg += i.progressionPct; if (i.statut === "termine") e.termines++;
    parCours.set(i.coursId, e);
  }
  const catParCours = new Map(coursCatalogue.map((c) => [c.id, c.categorie?.nom ?? SANS_CAT]));
  const lignesCours: LigneCours[] = coursCatalogue.map((c) => {
    const e = parCours.get(c.id);
    const inscrits = e?.inscrits ?? 0;
    return {
      id: c.id, slug: c.slug, titre: c.titre, categorie: c.categorie?.nom ?? SANS_CAT,
      publie: c.statut === "publie", lecons: c._count.modules, inscrits,
      avancement: inscrits ? Math.round(e!.sommeProg / inscrits) : 0,
      termines: e?.termines ?? 0,
      completion: inscrits ? Math.round(((e?.termines ?? 0) / inscrits) * 100) : 0,
    };
  });

  // ── Graphique : inscriptions par catégorie ──────────────────
  const parCat = new Map<string, number>();
  for (const i of inscriptions) {
    const nom = catParCours.get(i.coursId) ?? SANS_CAT;
    parCat.set(nom, (parCat.get(nom) ?? 0) + 1);
  }
  const dataCategorie = [...parCat.entries()].map(([categorie, n]) => ({ categorie, inscriptions: n })).sort((a, b) => b.inscriptions - a.inscriptions);

  // ── Graphique : adoption sur 12 mois ────────────────────────
  const moisLabels: { cle: string; label: string }[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    moisLabels.push({ cle: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) });
  }
  const compteMois = new Map<string, number>();
  for (const i of inscriptions) {
    const d = i.dateInscription;
    const cle = `${d.getFullYear()}-${d.getMonth()}`;
    if (compteMois.has(cle) || moisLabels.some((m) => m.cle === cle)) compteMois.set(cle, (compteMois.get(cle) ?? 0) + 1);
  }
  const dataTemps = moisLabels.map((m) => ({ label: m.label, inscriptions: compteMois.get(m.cle) ?? 0 }));

  // ── Graphique : répartition de l'avancement ─────────────────
  const bornes: { tranche: string; test: (p: number) => boolean }[] = [
    { tranche: "0 %", test: (p) => p <= 0 },
    { tranche: "1–25", test: (p) => p > 0 && p <= 25 },
    { tranche: "26–50", test: (p) => p > 25 && p <= 50 },
    { tranche: "51–75", test: (p) => p > 50 && p <= 75 },
    { tranche: "76–99", test: (p) => p > 75 && p < 100 },
    { tranche: "100 %", test: (p) => p >= 100 },
  ];
  const dataAvancement = bornes.map((b) => ({ tranche: b.tranche, inscriptions: inscriptions.filter((i) => b.test(i.progressionPct)).length }));

  // ── Tableau des quiz ────────────────────────────────────────
  const parQuiz = new Map<string, { n: number; somme: number; reussies: number }>();
  for (const t of tentatives) {
    const e = parQuiz.get(t.quizId) ?? { n: 0, somme: 0, reussies: 0 };
    e.n++; e.somme += t.pourcentage; if (t.reussi) e.reussies++;
    parQuiz.set(t.quizId, e);
  }
  const lignesQuiz = quizCatalogue
    .map((q) => {
      const e = parQuiz.get(q.id);
      const n = e?.n ?? 0;
      return {
        id: q.id, cours: q.module.cours.titre, lecon: q.module.titre, questions: q._count.questions, seuil: q.seuilReussite,
        tentatives: n, reussite: n ? Math.round((e!.reussies / n) * 100) : 0, scoreMoyen: n ? Math.round(e!.somme / n) : 0,
      };
    })
    .sort((a, b) => b.tentatives - a.tentatives);

  // ── Sessions ────────────────────────────────────────────────
  const estAvenir = (s: (typeof sessions)[number]) => s.statut !== "annulee" && s.dateDebut >= now;
  const estPassee = (s: (typeof sessions)[number]) => s.statut !== "annulee" && s.dateDebut < now;
  const sessionsAvenir = sessions.filter(estAvenir);
  const sessionsPassees = sessions.filter(estPassee).sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime());
  const sessionsAnnulees = sessions.filter((s) => s.statut === "annulee").sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime());

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Gestion du contenu</Link>
      <PageHeader
        titre="Suivi des apprenants"
        description="Adoption des cours, avancement, réussite aux quiz et sessions de formation — sur l'ensemble du LMS."
        action={<Link href={`${BASE}/gestion`} className="inline-flex h-10 items-center gap-2 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-cream-100"><Settings2 size={15} /> Gérer le contenu</Link>}
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard libelle="Cours publiés" valeur={coursPublies} icone={<BookOpen size={22} />} />
        <StatCard libelle="Apprenants" valeur={apprenants} ton="gold" icone={<Users size={22} />} />
        <StatCard libelle="Inscriptions" valeur={totalInscriptions} icone={<ClipboardList size={22} />} />
        <StatCard libelle="Taux de complétion" valeur={`${tauxCompletion}%`} ton="gold" icone={<CheckCircle2 size={22} />} />
        <StatCard libelle="Réussite aux quiz" valeur={tentativesTotal ? `${tauxReussite}%` : "—"} icone={<Target size={22} />} />
        <StatCard libelle="Sessions à venir" valeur={sessionsAvenir.length} ton="gold" icone={<CalendarDays size={22} />} />
      </div>

      {/* Graphiques */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitre icone={<GraduationCap size={17} />} titre="Inscriptions par catégorie" sousTitre="Répartition des inscriptions dans le catalogue" />
          <ChartInscriptionsCategorie data={dataCategorie} />
        </Card>
        <Card>
          <SectionTitre icone={<Activity size={17} />} titre="Adoption sur 12 mois" sousTitre="Nouvelles inscriptions par mois" />
          <ChartInscriptionsTemps data={dataTemps} />
        </Card>
      </div>
      <Card>
        <SectionTitre icone={<Target size={17} />} titre="Répartition de l'avancement" sousTitre={`Avancement moyen global : ${totalInscriptions ? Math.round(inscriptions.reduce((s, i) => s + i.progressionPct, 0) / totalInscriptions) : 0}%`} />
        <ChartAvancement data={dataAvancement} />
      </Card>

      {/* Tableau par cours */}
      <Card>
        <SectionTitre icone={<BookOpen size={17} />} titre="Détail par cours" sousTitre="Inscrits, avancement moyen et taux de complétion — colonnes triables" />
        <TableauCours lignes={lignesCours} />
      </Card>

      {/* Quiz */}
      <Card>
        <SectionTitre icone={<ListChecks size={17} />} titre="Performance des quiz" sousTitre="Tentatives, taux de réussite et score moyen par évaluation" />
        {lignesQuiz.length === 0 ? (
          <p className="rounded-xl bg-cream-50 px-4 py-8 text-center text-sm text-ink-700/55">Aucun quiz n&apos;a encore été créé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-ink-700/60">
                  <th className="py-2.5 pr-3 font-semibold">Quiz</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Questions</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Seuil</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Tentatives</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Réussite</th>
                  <th className="py-2.5 text-right font-semibold">Score moyen</th>
                </tr>
              </thead>
              <tbody>
                {lignesQuiz.map((q) => (
                  <tr key={q.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/60">
                    <td className="py-2.5 pr-3"><p className="font-medium text-forest-900">{q.lecon}</p><p className="text-xs text-ink-700/50">{q.cours}</p></td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink-700/75">{q.questions}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-ink-700/75">{q.seuil}%</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-forest-800">{q.tentatives}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {q.tentatives === 0 ? <span className="text-ink-700/40">—</span> : <Badge ton={q.reussite >= 70 ? "succes" : "attente"}>{q.reussite}%</Badge>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink-700/75">{q.tentatives === 0 ? "—" : `${q.scoreMoyen}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sessions + activité récente */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitre icone={<CalendarDays size={17} />} titre="Sessions de formation" sousTitre="Remplissage des sessions à venir et passées" />
          {sessions.length === 0 ? (
            <p className="rounded-xl bg-cream-50 px-4 py-8 text-center text-sm text-ink-700/55">Aucune session programmée.</p>
          ) : (
            <div className="space-y-4">
              {sessionsAvenir.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-forest-700/60">À venir</p>
                  <ul className="space-y-2">{sessionsAvenir.map((s) => <LigneSession key={s.id} s={s} />)}</ul>
                </div>
              )}
              {sessionsPassees.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700/45">Passées</p>
                  <ul className="space-y-2">{sessionsPassees.slice(0, 5).map((s) => <LigneSession key={s.id} s={s} passee />)}</ul>
                </div>
              )}
              {sessionsAnnulees.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-700/45">Annulées</p>
                  <ul className="space-y-2">{sessionsAnnulees.slice(0, 5).map((s) => <LigneSession key={s.id} s={s} passee />)}</ul>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitre icone={<Activity size={17} />} titre="Activité récente" sousTitre="Derniers apprenants actifs sur un cours" />
          {recemmentActifs.length === 0 ? (
            <p className="rounded-xl bg-cream-50 px-4 py-8 text-center text-sm text-ink-700/55">Aucune activité pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {recemmentActifs.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-forest-900">{nomApprenant(a.utilisateur)}</p>
                    <p className="truncate text-xs text-ink-700/55">{a.cours.titre}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-forest-800">{a.statut === "termine" ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Terminé</span> : `${a.progressionPct}%`}</p>
                    <p className="text-[11px] text-ink-700/45">{dateCourte(a.derniereActivite)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function LigneSession({ s, passee }: { s: { titre: string; format: string; dateDebut: Date; placesMax: number | null; statut: string; _count: { inscriptions: number } }; passee?: boolean }) {
  // Capacité définie seulement si placesMax > 0 (un champ laissé vide peut valoir 0 en base).
  const cap = s.placesMax != null && s.placesMax > 0 ? s.placesMax : null;
  const complet = cap != null && s._count.inscriptions >= cap;
  const remplissage = cap != null ? Math.round((s._count.inscriptions / cap) * 100) : null;
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-cream-200 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-forest-900">{s.titre}</p>
          {s.statut === "annulee" && <Badge ton="refus">Annulée</Badge>}
          {complet && s.statut !== "annulee" && <Badge ton="attente">Complet</Badge>}
        </div>
        <p className="flex items-center gap-1.5 truncate text-xs text-ink-700/55">
          {s.format === "presentiel" ? <MapPin size={11} /> : <Video size={11} />} {formatSession(s.format)} · {dateHeure(s.dateDebut)}
        </p>
      </div>
      <div className={`shrink-0 text-right ${passee ? "opacity-70" : ""}`}>
        <p className="text-sm font-semibold text-forest-800">{s._count.inscriptions}{cap != null ? `/${cap}` : ""}</p>
        <p className="text-[11px] text-ink-700/45">{remplissage != null ? `${remplissage}% rempli` : "inscrits"}</p>
      </div>
    </li>
  );
}
