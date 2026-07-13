import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Users, CheckCircle2, Gauge, BookOpen } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";

export const metadata: Metadata = { title: "Travaux des participants" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const nomComplet = (nom: string | null, prenoms: string | null, email: string) =>
  [nom, prenoms].filter(Boolean).join(" ").trim() || email;

export default async function TravauxPage({ searchParams }: { searchParams: Promise<{ cours?: string }> }) {
  await requireRole(["admin"]);
  const sp = await searchParams;

  const coursListe = await prisma.cours.findMany({
    orderBy: [{ estGuide: "asc" }, { ordre: "asc" }, { titre: "asc" }],
    select: { id: true, titre: true, slug: true, estGuide: true, statut: true, _count: { select: { modules: true, inscriptions: true } } },
  });

  if (coursListe.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Travaux des participants" description="Taux d'exécution et liste nominative des tâches effectuées." />
        <Card><p className="text-sm text-ink-700/70">Aucun cours n&apos;existe encore.</p></Card>
      </div>
    );
  }

  const actif = coursListe.find((c) => c.slug === sp.cours) ?? coursListe[0];

  const cours = await prisma.cours.findUnique({
    where: { id: actif.id },
    select: {
      modules: { orderBy: { ordre: "asc" }, select: { id: true, titre: true, type: true, quiz: { select: { id: true } }, devoir: { select: { id: true } } } },
      inscriptions: {
        orderBy: [{ progressionPct: "desc" }, { derniereActivite: "desc" }],
        select: {
          progressionPct: true, statut: true, derniereActivite: true,
          utilisateur: { select: { id: true, nom: true, prenoms: true, email: true } },
          progressions: { where: { termine: true }, select: { moduleId: true } },
        },
      },
    },
  });

  const modules = cours?.modules ?? [];
  const inscriptions = cours?.inscriptions ?? [];
  const totalTaches = modules.length;

  // Cartographie quiz/devoir → module (pour créditer les tâches validées par évaluation).
  const quizModule = new Map<string, string>();
  const devoirModule = new Map<string, string>();
  for (const m of modules) {
    if (m.quiz) quizModule.set(m.quiz.id, m.id);
    if (m.devoir) devoirModule.set(m.devoir.id, m.id);
  }
  const quizIds = [...quizModule.keys()];
  const devoirIds = [...devoirModule.keys()];

  const [tentatives, soumissions] = await Promise.all([
    quizIds.length ? prisma.tentativeQuiz.findMany({ where: { quizId: { in: quizIds }, reussi: true }, select: { quizId: true, utilisateurId: true } }) : Promise.resolve([]),
    devoirIds.length ? prisma.soumissionDevoir.findMany({ where: { devoirId: { in: devoirIds } }, select: { devoirId: true, utilisateurId: true } }) : Promise.resolve([]),
  ]);

  const quizParUser = new Map<string, Set<string>>(); // userId → moduleIds (quiz réussi)
  for (const t of tentatives) {
    const mid = quizModule.get(t.quizId);
    if (!mid) continue;
    if (!quizParUser.has(t.utilisateurId)) quizParUser.set(t.utilisateurId, new Set());
    quizParUser.get(t.utilisateurId)!.add(mid);
  }
  const devoirParUser = new Map<string, Set<string>>();
  for (const s of soumissions) {
    const mid = devoirModule.get(s.devoirId);
    if (!mid) continue;
    if (!devoirParUser.has(s.utilisateurId)) devoirParUser.set(s.utilisateurId, new Set());
    devoirParUser.get(s.utilisateurId)!.add(mid);
  }

  const participants = inscriptions.map((i) => {
    const uid = i.utilisateur.id;
    const done = new Set<string>(i.progressions.map((p) => p.moduleId));
    quizParUser.get(uid)?.forEach((m) => done.add(m));
    devoirParUser.get(uid)?.forEach((m) => done.add(m));
    const taches = modules.filter((m) => done.has(m.id)).map((m) => m.titre);
    return {
      id: uid,
      nom: nomComplet(i.utilisateur.nom, i.utilisateur.prenoms, i.utilisateur.email),
      email: i.utilisateur.email,
      taux: i.progressionPct,
      termine: i.statut === "termine",
      nbFaites: taches.length,
      taches,
    };
  });

  const nbParticipants = participants.length;
  const tauxMoyen = nbParticipants ? Math.round(participants.reduce((s, p) => s + p.taux, 0) / nbParticipants) : 0;
  const nbTermines = participants.filter((p) => p.termine).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Travaux des participants"
        description="Taux d'exécution et liste nominative des tâches effectuées par cours."
        action={
          <Link href={`${BASE}/formations`} className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:border-forest-300">
            <ArrowLeft className="h-4 w-4" /> Formations
          </Link>
        }
      />

      {/* Sélecteur de cours (formulaire GET, sans JS) */}
      <form method="get" className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
        <label htmlFor="sel-cours" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-forest-600">Cours sélectionné</label>
        <div className="flex flex-wrap gap-2">
          <select id="sel-cours" name="cours" defaultValue={actif.slug} className="h-11 min-w-0 flex-1 rounded-xl border border-cream-300 bg-white px-3 text-sm font-medium outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200">
            {coursListe.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.titre}{c.estGuide ? " (guide)" : ""} · {c._count.inscriptions} inscrit{c._count.inscriptions > 1 ? "s" : ""} · {c._count.modules} tâche{c._count.modules > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-5 text-sm font-semibold text-white hover:bg-forest-800">Afficher</button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard libelle="Participants" valeur={nbParticipants} icone={<Users className="h-5 w-5" />} />
        <StatCard libelle="Taux d'exécution moyen" valeur={`${tauxMoyen}%`} icone={<Gauge className="h-5 w-5" />} ton="gold" />
        <StatCard libelle="Ont terminé" valeur={nbTermines} icone={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard libelle="Tâches du cours" valeur={totalTaches} icone={<BookOpen className="h-5 w-5" />} />
      </div>

      <Card className="space-y-1">
        <div className="mb-2 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-forest-700" />
          <h2 className="font-display text-base font-bold text-forest-900">{actif.titre}</h2>
        </div>
        {totalTaches === 0 ? (
          <p className="text-sm text-ink-700/60">Ce cours ne comporte encore aucune leçon.</p>
        ) : participants.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun participant inscrit à ce cours pour le moment.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {participants.map((p) => (
              <li key={p.id} className="py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-forest-900">
                      {p.nom}
                      {p.termine && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-forest-100 px-2 py-0.5 text-[0.65rem] font-semibold text-forest-800"><CheckCircle2 className="h-3 w-3" /> Terminé</span>}
                    </p>
                    <p className="truncate text-xs text-ink-700/55">{p.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-ink-700/60">{p.nbFaites}/{totalTaches} tâche{totalTaches > 1 ? "s" : ""}</span>
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-forest-500" style={{ width: `${p.taux}%` }} /></div>
                    <span className="w-10 text-right font-display text-sm font-bold text-forest-900">{p.taux}%</span>
                  </div>
                </div>
                {p.taches.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.taches.map((t, k) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full border border-forest-200 bg-forest-50/60 px-2.5 py-0.5 text-[0.7rem] text-forest-800"><CheckCircle2 className="h-3 w-3 text-forest-600" /> {t}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
