import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, Video, FileDown, ExternalLink, ListChecks, FileCheck2 } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  rendreTexteRiche, estHtmlRiche, CLASSE_HTML_RICHE, descriptionSolution, TYPES_CHOIX, TYPES_QUESTION, TYPES_MODULE,
} from "@/lib/lms";
import { BoutonImprimerLivret } from "./bouton-imprimer";

export const metadata: Metadata = {
  title: "Livret de formation — Aide et Formation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const ICONE_TYPE = { texte: FileText, video: Video, fichier: FileDown, lien: ExternalLink, quiz: ListChecks, devoir: FileCheck2 } as const;
const libelleTypeModule = (v: string) => TYPES_MODULE.find((t) => t.v === v)?.libelle ?? v;
const libelleTypeQuestion = (v: string) => TYPES_QUESTION.find((t) => t.v === v)?.libelle ?? v;
const dateJour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

/**
 * LIVRET IMPRIMABLE d'un cours (narrations théoriques + évaluations, avec corrigés). Réservé aux
 * ADMIN et TUTEURS du cours — document pédagogique du formateur, imprimable / exportable en PDF
 * via le navigateur. Non indexé (contient les corrigés).
 */
export default async function LivretPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;

  const cours = await prisma.cours.findUnique({
    where: { slug },
    select: {
      id: true, titre: true, description: true, dureeMinutes: true, niveau: true, estSeminaire: true,
      attestationSignataire: true, attestationFonction: true,
      categorie: { select: { nom: true } },
      modules: {
        orderBy: { ordre: "asc" },
        select: {
          id: true, titre: true, type: true, contenu: true, fichierNom: true, fichierUrl: true, dureeMinutes: true,
          quiz: {
            select: {
              consigne: true, mode: true, seuilReussite: true,
              questions: {
                orderBy: { ordre: "asc" },
                select: {
                  id: true, enonce: true, type: true, points: true, explication: true,
                  choix: { orderBy: { ordre: "asc" }, select: { id: true, texte: true, correct: true, apparie: true, ordre: true } },
                },
              },
            },
          },
          devoir: { select: { consigne: true, noteSur: true, dateLimite: true, accepteTexte: true, accepteFichier: true } },
        },
      },
    },
  });
  if (!cours) redirect(`${BASE}/guides`);

  // Accès : admin OU tuteur désigné du cours (document contenant les corrigés).
  const estAdmin = u.roleActif === "admin" || u.roleReel === "admin";
  const estTuteur = estAdmin || Boolean(
    await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId: cours.id, utilisateurId: u.id } }, select: { id: true } }),
  );
  if (!estTuteur) redirect(`${BASE}/cours/${slug}`);

  const nbEval = cours.modules.filter((m) => m.type === "quiz" || m.type === "devoir").length;
  const rubrique = cours.estSeminaire ? "Séminaire" : "Formation";

  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none print:space-y-0">
      {/* Barre d'action (masquée à l'impression) */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`${BASE}/cours/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Retour au cours</Link>
        <BoutonImprimerLivret />
      </div>

      <article className="rounded-3xl border border-cream-200 bg-white p-8 shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Couverture */}
        <header className="mb-8 border-b border-cream-200 pb-6 text-center print:break-after-avoid">
          <div className="mb-3 flex flex-col items-center gap-2">
            {/* Logo officiel EduWeb Planner (public/logo.png). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="EduWeb Planner" className="h-24 w-auto object-contain drop-shadow-sm" />
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-forest-700">EduWeb Planner · Académie</p>
          </div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-forest-600">{rubrique} · Livret de formation</p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-forest-900">{cours.titre}</h1>
          {cours.description && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-700/75">{cours.description}</p>}
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-700/60">
            {cours.categorie?.nom && <span>{cours.categorie.nom}</span>}
            <span>{cours.modules.length} module(s)</span>
            <span>{nbEval} évaluation(s)</span>
            {cours.dureeMinutes ? <span>Durée estimée {cours.dureeMinutes} min</span> : null}
          </p>
          <p className="mt-3 inline-block rounded-full bg-gold-50 px-3 py-1 text-[0.7rem] font-medium text-gold-700 print:border print:border-gold-200">
            Document du formateur — inclut les corrigés · Édité le {dateJour(new Date())}
          </p>
        </header>

        {/* Sommaire */}
        <nav className="mb-8 rounded-2xl bg-cream-50/60 p-5 print:break-inside-avoid print:bg-transparent print:p-0">
          <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">Sommaire</h2>
          <ol className="space-y-1 text-sm text-ink-800">
            {cours.modules.map((m, i) => (
              <li key={m.id} className="flex items-baseline gap-2">
                <span className="text-ink-700/45">{i + 1}.</span>
                <span className="font-medium">{m.titre}</span>
                <span className="text-xs text-ink-700/50">— {libelleTypeModule(m.type)}</span>
              </li>
            ))}
          </ol>
        </nav>

        {/* Contenu module par module */}
        <div className="space-y-8">
          {cours.modules.map((m, i) => {
            const Icone = ICONE_TYPE[m.type as keyof typeof ICONE_TYPE] ?? FileText;
            return (
              <section key={m.id} className="print:break-inside-avoid">
                <div className="mb-2 flex items-start gap-2 border-b border-cream-100 pb-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-700"><Icone size={15} /></span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold text-forest-900"><span className="text-ink-700/40">{i + 1}.</span> {m.titre}</h2>
                    <p className="text-xs uppercase tracking-wide text-ink-700/50">{libelleTypeModule(m.type)}{m.dureeMinutes ? ` · ${m.dureeMinutes} min` : ""}</p>
                  </div>
                </div>

                {/* Narration théorique (texte) */}
                {m.type === "texte" && m.contenu && (
                  <div
                    className={`text-sm leading-relaxed text-ink-800 ${estHtmlRiche(m.contenu) ? CLASSE_HTML_RICHE : ""}`}
                    dangerouslySetInnerHTML={{ __html: estHtmlRiche(m.contenu) ? m.contenu : rendreTexteRiche(m.contenu) }}
                  />
                )}

                {/* Ressources (vidéo / fichier / lien) : référencées, pas intégrées */}
                {m.type === "video" && m.contenu && (
                  <p className="text-sm text-ink-800">Ressource vidéo : <span className="break-all text-forest-700 underline">{m.contenu}</span></p>
                )}
                {m.type === "fichier" && (
                  <p className="text-sm text-ink-800">Document joint : <strong>{m.fichierNom ?? "fichier"}</strong>{m.fichierUrl ? <> — <span className="break-all text-forest-700 underline">{m.fichierUrl}</span></> : null}</p>
                )}
                {m.type === "lien" && m.contenu && (
                  <p className="text-sm text-ink-800">Ressource externe : <span className="break-all text-forest-700 underline">{m.contenu}</span></p>
                )}

                {/* Évaluation (quiz) — avec corrigé */}
                {m.type === "quiz" && m.quiz && (
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-forest-700">
                      Évaluation {m.quiz.mode === "sommatif" ? "sommative (notée)" : "formative"} · seuil {m.quiz.seuilReussite} %
                    </p>
                    {m.quiz.consigne && <p className="text-sm italic text-ink-700/75">{m.quiz.consigne}</p>}
                    <ol className="space-y-4">
                      {m.quiz.questions.map((q, qi) => {
                        const qcm = TYPES_CHOIX.includes(q.type);
                        return (
                          <li key={q.id} className="rounded-xl border border-cream-200 p-3 print:break-inside-avoid">
                            <p className="text-sm font-semibold text-ink-900">
                              <span className="text-ink-700/45">Q{qi + 1}.</span> {q.enonce}
                              <span className="ml-2 text-xs font-normal text-ink-700/50">({libelleTypeQuestion(q.type)} · {q.points} pt)</span>
                            </p>
                            {qcm ? (
                              <ul className="mt-2 space-y-1 text-sm">
                                {q.choix.map((c) => (
                                  <li key={c.id} className={c.correct ? "font-semibold text-forest-800" : "text-ink-800"}>
                                    <span className="mr-1.5">{c.correct ? "☑" : "☐"}</span>{c.texte}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-forest-800"><span className="font-semibold">Corrigé : </span>{descriptionSolution(q.type, q.choix)}</p>
                            )}
                            {q.explication && (
                              <p className="mt-2 rounded-lg bg-forest-50/70 p-2 text-xs leading-relaxed text-forest-900 print:bg-transparent print:border print:border-forest-200">
                                <span className="font-semibold">Explication : </span>{q.explication}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {/* Atelier / devoir */}
                {m.type === "devoir" && m.devoir && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-forest-700">Atelier / production évaluée · noté sur {m.devoir.noteSur}</p>
                    {m.devoir.consigne && (
                      <div
                        className={`text-sm leading-relaxed text-ink-800 ${estHtmlRiche(m.devoir.consigne) ? CLASSE_HTML_RICHE : ""}`}
                        dangerouslySetInnerHTML={{ __html: estHtmlRiche(m.devoir.consigne) ? m.devoir.consigne : rendreTexteRiche(m.devoir.consigne) }}
                      />
                    )}
                    <p className="text-xs text-ink-700/60">
                      Rendu attendu : {[m.devoir.accepteTexte && "texte en ligne", m.devoir.accepteFichier && "dépôt de fichier"].filter(Boolean).join(" ou ") || "—"}
                      {m.devoir.dateLimite ? ` · échéance le ${dateJour(m.devoir.dateLimite)}` : ""}
                    </p>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Pied */}
        <footer className="mt-10 border-t border-cream-200 pt-5 text-center text-xs text-ink-700/60 print:break-inside-avoid">
          {cours.attestationSignataire ? (
            <p>{cours.attestationSignataire}{cours.attestationFonction ? ` · ${cours.attestationFonction}` : ""}</p>
          ) : null}
          <p className="mt-1">Livret généré par EduWeb Planner — Centre de formation · {dateJour(new Date())}</p>
        </footer>
      </article>

      <p className="text-center text-xs text-ink-700/50 print:hidden">
        Utilisez « Imprimer / Enregistrer en PDF » pour télécharger ce livret. Réservé aux administrateurs et tuteurs (contient les corrigés).
      </p>
    </div>
  );
}
