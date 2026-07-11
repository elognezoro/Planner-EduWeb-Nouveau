import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, Video, FileDown, ExternalLink, CheckCircle2, HelpCircle, Award, FileCheck2, Route, LineChart } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { rendreTexteRiche, urlIntegrationVideo, descriptionSolution, TYPES_CHOIX } from "@/lib/lms";
import { BoutonLecon } from "../../boutons-lms";
import { QuizPassage } from "../../quiz-passage";
import { BoutonEcouter } from "../../bouton-ecouter";
import { DevoirDepot } from "../../devoir-depot";

export const metadata: Metadata = { title: "Cours — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const ICONE_TYPE = { texte: FileText, video: Video, fichier: FileDown, lien: ExternalLink, quiz: HelpCircle, devoir: FileCheck2 } as const;

export default async function CoursPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;
  const estAdmin = u.roleActif === "admin";

  const cours = await prisma.cours.findUnique({
    where: { slug },
    select: {
      id: true, titre: true, description: true, statut: true, dureeMinutes: true, seuilCompletion: true,
      categorie: { select: { nom: true } },
      modules: { orderBy: { ordre: "asc" }, select: {
        id: true, titre: true, type: true, contenu: true, fichierUrl: true, fichierNom: true, dureeMinutes: true,
        quiz: { select: { consigne: true, seuilReussite: true, revelationSolutions: true, mode: true, questions: { orderBy: { ordre: "asc" }, select: { id: true, enonce: true, type: true, points: true, explication: true, choix: { orderBy: { ordre: "asc" }, select: { id: true, texte: true, correct: true, apparie: true, ordre: true } } } } } },
        devoir: { select: { consigne: true, accepteTexte: true, accepteFichier: true, noteSur: true, dateLimite: true } },
      } },
    },
  });
  if (!cours) redirect(`${BASE}/guides`);
  if (cours.statut !== "publie" && !estAdmin) redirect(`${BASE}/guides`);

  const [inscription, soumissions] = await Promise.all([
    prisma.inscriptionCours.findUnique({
      where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: cours.id } },
      select: { progressionPct: true, progressions: { where: { termine: true }, select: { moduleId: true } } },
    }),
    prisma.soumissionDevoir.findMany({
      where: { utilisateurId: u.id, devoir: { module: { coursId: cours.id } } },
      select: { texte: true, fichierUrl: true, fichierNom: true, statut: true, note: true, appreciation: true, dateSoumission: true, devoir: { select: { moduleId: true } } },
    }),
  ]);
  const termines = new Set(inscription?.progressions.map((p) => p.moduleId) ?? []);
  const pct = inscription?.progressionPct ?? 0;
  const soumParModule = new Map(soumissions.map((s) => [s.devoir.moduleId, s]));

  // Hub unifié du cours : parcours qui contiennent ce cours + (admin) suivi des apprenants de CE cours.
  const [parcoursDuCours, suiviCours, nbInscrits] = await Promise.all([
    prisma.parcours.findMany({
      where: { statut: "publie", etapes: { some: { coursId: cours.id } } },
      orderBy: { titre: "asc" },
      select: {
        id: true, titre: true, slug: true,
        _count: { select: { etapes: true } },
        badge: { select: { nom: true } },
        inscriptions: { where: { utilisateurId: u.id }, select: { progressionPct: true }, take: 1 },
      },
    }),
    estAdmin
      ? prisma.inscriptionCours.findMany({
          where: { coursId: cours.id },
          orderBy: { derniereActivite: "desc" },
          take: 50,
          select: { progressionPct: true, statut: true, derniereActivite: true, utilisateur: { select: { nom: true, prenoms: true, email: true } } },
        })
      : Promise.resolve([] as { progressionPct: number; statut: string; derniereActivite: Date; utilisateur: { nom: string | null; prenoms: string | null; email: string } }[]),
    estAdmin ? prisma.inscriptionCours.count({ where: { coursId: cours.id } }) : Promise.resolve(0),
  ]);

  // Attestation disponible : seuil de complétion atteint ET tous les quiz sommatifs réussis.
  const seuilCompletion = Math.min(100, Math.max(1, cours.seuilCompletion ?? 100));
  const sommatifIds = cours.modules.filter((m) => m.type === "quiz" && m.quiz?.mode === "sommatif").map((m) => m.id);
  const sommatifsOk = sommatifIds.every((id) => termines.has(id));
  const attestationDispo = cours.modules.length > 0 && pct >= seuilCompletion && sommatifsOk;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/guides`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Tous les guides
      </Link>

      <PageHeader titre={cours.titre} description={cours.description ?? undefined} />
      {cours.statut !== "publie" && <Badge ton="attente">Brouillon — aperçu administrateur</Badge>}

      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-ink-700/60">{cours.categorie?.nom ?? ""}</span>
          <span className="font-semibold text-forest-800">{attestationDispo ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> Terminé</span> : `${pct}%`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      {attestationDispo && (
        <Link href={`${BASE}/cours/${slug}/attestation`} className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-forest-950 shadow-soft hover:bg-gold-400">
          <Award size={16} /> Obtenir mon attestation
        </Link>
      )}

      {parcoursDuCours.length > 0 && (
        <Card className="space-y-2.5">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-forest-900"><Route size={16} className="text-forest-600" /> Ce cours fait partie d&apos;un parcours</h2>
          {parcoursDuCours.map((p) => {
            const pp = p.inscriptions[0]?.progressionPct;
            return (
              <Link key={p.id} href={`${BASE}/parcours/${p.slug}`} className="block rounded-xl border border-cream-200 p-3 transition hover:border-forest-300">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-medium text-forest-900">{p.titre}</span>
                  <span className="text-xs text-ink-700/60">{p._count.etapes} cours{p.badge ? ` · badge « ${p.badge.nom} »` : ""}{pp !== undefined ? ` · ${pp}%` : ""}</span>
                </div>
                {pp !== undefined && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-forest-500" style={{ width: `${pp}%` }} /></div>}
              </Link>
            );
          })}
        </Card>
      )}

      {estAdmin && (
        <details className="rounded-3xl border border-cream-200 bg-white p-4 shadow-soft">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-sm font-bold text-forest-900">
            <LineChart size={16} className="text-forest-600" /> Suivi des apprenants — ce cours ({nbInscrits})
          </summary>
          <div className="mt-3">
            {suiviCours.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucun apprenant inscrit à ce cours pour l&apos;instant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-700/50"><th className="py-1 pr-2 font-semibold">Apprenant</th><th className="pr-2 font-semibold">Progression</th><th className="pr-2 font-semibold">Statut</th><th className="font-semibold">Activité</th></tr></thead>
                  <tbody>
                    {suiviCours.map((s, i) => (
                      <tr key={i} className="border-t border-cream-100">
                        <td className="py-1.5 pr-2 text-ink-800">{[s.utilisateur.prenoms, s.utilisateur.nom].filter(Boolean).join(" ") || s.utilisateur.email}</td>
                        <td className="pr-2 font-semibold text-forest-800">{s.progressionPct}%</td>
                        <td className="pr-2">{s.statut === "termine" ? <span className="text-forest-700">Terminé</span> : <span className="text-ink-700/60">En cours</span>}</td>
                        <td className="text-xs text-ink-700/60">{new Date(s.derniereActivite).toLocaleDateString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {nbInscrits > suiviCours.length && (
              <p className="mt-2 text-xs text-ink-700/55">Affichage des {suiviCours.length} apprenants les plus récemment actifs, sur {nbInscrits} inscrits.</p>
            )}
            <Link href={`${BASE}/suivi`} className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:text-forest-900">Suivi complet (tous les cours) →</Link>
          </div>
        </details>
      )}

      {cours.modules.length === 0 ? (
        <Card><p className="text-sm text-ink-700/70">Ce cours n&apos;a pas encore de leçon.</p></Card>
      ) : (
        <div className="space-y-4">
          {cours.modules.map((m, i) => {
            const Icone = ICONE_TYPE[m.type as keyof typeof ICONE_TYPE] ?? FileText;
            const videoUrl = m.type === "video" ? urlIntegrationVideo(m.contenu) : null;
            const fait = termines.has(m.id);
            return (
              <Card key={m.id} className={fait ? "border-forest-200" : ""}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-700"><Icone size={16} /></span>
                    <div>
                      <h2 className="font-display text-base font-bold text-forest-900">
                        <span className="text-ink-700/40">{i + 1}.</span> {m.titre}
                      </h2>
                      {m.dureeMinutes ? <p className="text-xs text-ink-700/55">{m.dureeMinutes} min</p> : null}
                    </div>
                  </div>
                  {m.type === "quiz" || m.type === "devoir"
                    ? fait && <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700"><CheckCircle2 size={14} /> Validé</span>
                    : <BoutonLecon moduleId={m.id} termine={fait} />}
                </div>

                <div className="mt-3">
                  {m.type === "texte" && m.contenu && (
                    <div>
                      <div className="mb-2"><BoutonEcouter texte={m.contenu} /></div>
                      <div className="text-sm text-ink-800" dangerouslySetInnerHTML={{ __html: rendreTexteRiche(m.contenu) }} />
                    </div>
                  )}
                  {m.type === "video" &&
                    (videoUrl ? (
                      <div className="aspect-video overflow-hidden rounded-xl border border-cream-200">
                        <iframe src={videoUrl} className="h-full w-full" allowFullScreen title={m.titre} />
                      </div>
                    ) : m.contenu ? (
                      <a href={m.contenu} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 hover:underline">
                        <Video size={15} /> Ouvrir la vidéo
                      </a>
                    ) : null)}
                  {m.type === "fichier" && m.fichierUrl && (
                    <a href={m.fichierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-cream-300 px-4 py-2.5 text-sm font-semibold text-forest-800 hover:bg-cream-100">
                      <FileDown size={16} /> {m.fichierNom ?? "Télécharger le document"}
                    </a>
                  )}
                  {m.type === "lien" && m.contenu && (
                    <a href={m.contenu} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 hover:underline">
                      <ExternalLink size={15} /> Ouvrir la ressource
                    </a>
                  )}
                  {m.type === "quiz" && (
                    m.quiz
                      ? <BlocQuiz quiz={m.quiz} moduleId={m.id} fait={fait} />
                      : <p className="text-sm text-ink-700/60">Quiz en préparation.</p>
                  )}
                  {m.type === "devoir" && (
                    m.devoir
                      ? <DevoirDepot moduleId={m.id} devoir={m.devoir} soumission={soumParModule.get(m.id) ?? null} />
                      : <p className="text-sm text-ink-700/60">Devoir en préparation.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Prépare les données du quiz pour le composant client : les propositions envoyées
 * n'incluent JAMAIS `correct`. Les solutions ne sont transmises (mode révision) que si
 * la politique de révélation est « toujours » ; sinon elles ne reviennent qu'après soumission.
 */
function melanger<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Mélange en évitant de retomber sur l'ordre d'origine (sinon l'auto-remplissage donnerait les points sans action). */
function melangerNonIdentite(textes: string[]): string[] {
  if (textes.length < 2) return [...textes];
  for (let essai = 0; essai < 6; essai++) {
    const m = melanger(textes);
    if (m.some((t, i) => t !== textes[i])) return m;
  }
  return [...textes.slice(1), textes[0]];
}

type ChoixDb = { id: string; texte: string; correct: boolean; apparie: string | null; ordre: number };
type QuestionDb = { id: string; enonce: string; type: string; points: number; explication: string | null; choix: ChoixDb[] };

function BlocQuiz({ quiz, moduleId, fait }: {
  quiz: { consigne: string | null; seuilReussite: number; revelationSolutions: string; questions: QuestionDb[] };
  moduleId: string;
  fait: boolean;
}) {
  const questions = quiz.questions.map((q) => {
    const base = { id: q.id, enonce: q.enonce, type: q.type, points: q.points };
    if (q.type === "association") {
      return { ...base, choix: q.choix.map((c) => ({ id: c.id, texte: c.texte })), droites: melanger(q.choix.map((c) => c.apparie ?? "").filter(Boolean)) };
    }
    if (q.type === "remise_en_ordre") {
      // Positions opaques (p0, p1…) — jamais l'id de base ; l'apprenant soumet les TEXTES dans l'ordre.
      const correct = [...q.choix].sort((a, b) => a.ordre - b.ordre).map((c) => c.texte);
      return { ...base, choix: melangerNonIdentite(correct).map((texte, i) => ({ id: `p${i}`, texte })) };
    }
    if (q.type === "texte_a_trous") {
      return { ...base, choix: [] as { id: string; texte: string }[], nbTrous: q.choix.length };
    }
    return { ...base, choix: q.choix.map((c) => ({ id: c.id, texte: c.texte })) };
  });
  const solutions = quiz.revelationSolutions === "toujours"
    ? quiz.questions.map((q) => TYPES_CHOIX.includes(q.type)
        ? { questionId: q.id, bonnes: q.choix.filter((c) => c.correct).map((c) => c.id), explication: q.explication }
        : { questionId: q.id, bonnes: [] as string[], solution: descriptionSolution(q.type, q.choix), explication: q.explication })
    : undefined;
  return <QuizPassage moduleId={moduleId} questions={questions} consigne={quiz.consigne} seuil={quiz.seuilReussite} dejaReussi={fait} solutions={solutions} />;
}
