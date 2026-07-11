import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, Video, FileDown, ExternalLink, CheckCircle2, HelpCircle, Award } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { rendreTexteRiche, urlIntegrationVideo } from "@/lib/lms";
import { BoutonLecon } from "../../boutons-lms";
import { QuizPassage } from "../../quiz-passage";

export const metadata: Metadata = { title: "Cours — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const ICONE_TYPE = { texte: FileText, video: Video, fichier: FileDown, lien: ExternalLink, quiz: HelpCircle } as const;

export default async function CoursPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;
  const estAdmin = u.roleActif === "admin";

  const cours = await prisma.cours.findUnique({
    where: { slug },
    select: {
      id: true, titre: true, description: true, statut: true, dureeMinutes: true,
      categorie: { select: { nom: true } },
      modules: { orderBy: { ordre: "asc" }, select: {
        id: true, titre: true, type: true, contenu: true, fichierUrl: true, fichierNom: true, dureeMinutes: true,
        quiz: { select: { consigne: true, seuilReussite: true, questions: { orderBy: { ordre: "asc" }, select: { id: true, enonce: true, type: true, points: true, choix: { orderBy: { ordre: "asc" }, select: { id: true, texte: true } } } } } },
      } },
    },
  });
  if (!cours) redirect(`${BASE}/guides`);
  if (cours.statut !== "publie" && !estAdmin) redirect(`${BASE}/guides`);

  const inscription = await prisma.inscriptionCours.findUnique({
    where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: cours.id } },
    select: { progressionPct: true, progressions: { where: { termine: true }, select: { moduleId: true } } },
  });
  const termines = new Set(inscription?.progressions.map((p) => p.moduleId) ?? []);
  const pct = inscription?.progressionPct ?? 0;

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
          <span className="font-semibold text-forest-800">{pct === 100 ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> Terminé</span> : `${pct}%`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      {pct === 100 && (
        <Link href={`${BASE}/cours/${slug}/attestation`} className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-forest-950 shadow-soft hover:bg-gold-400">
          <Award size={16} /> Obtenir mon attestation
        </Link>
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
                  {m.type === "quiz"
                    ? fait && <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700"><CheckCircle2 size={14} /> Validé</span>
                    : <BoutonLecon moduleId={m.id} termine={fait} />}
                </div>

                <div className="mt-3">
                  {m.type === "texte" && m.contenu && (
                    <div className="text-sm text-ink-800" dangerouslySetInnerHTML={{ __html: rendreTexteRiche(m.contenu) }} />
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
                      ? <QuizPassage moduleId={m.id} questions={m.quiz.questions} consigne={m.quiz.consigne} seuil={m.quiz.seuilReussite} dejaReussi={fait} />
                      : <p className="text-sm text-ink-700/60">Quiz en préparation.</p>
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
