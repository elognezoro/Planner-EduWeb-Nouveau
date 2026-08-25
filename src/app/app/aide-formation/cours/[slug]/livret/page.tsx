import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft, FileText, Video, FileDown, ExternalLink, ListChecks, FileCheck2,
  Layers, Clock, GraduationCap, CheckCircle2, Circle, PenLine,
} from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  rendreTexteRiche, estHtmlRiche, CLASSE_HTML_RICHE, descriptionSolution, TYPES_CHOIX, TYPES_QUESTION,
} from "@/lib/lms";
import { BoutonImprimerLivret } from "./bouton-imprimer";

export const metadata: Metadata = {
  title: "Livret de formation — Aide et Formation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const NIVEAUX_LABEL: Record<string, string> = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé" };
const libelleTypeQuestion = (v: string) => TYPES_QUESTION.find((t) => t.v === v)?.libelle ?? v;
const dateJour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const dureeLisible = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
};
const estFinaleTitre = (t: string) => /évaluation sommative|production finale|questionnaire de satisfaction|évaluation finale/i.test(t);

// Feuille de style d'impression : justification + césure, et conservation des aplats de couleur
// (l'infographie) dans le PDF (les navigateurs les suppriment par défaut).
const STYLE_IMPRESSION = `
  .livret-doc { -webkit-hyphens: auto; hyphens: auto; }
  .livret-prose p, .livret-prose li { text-align: justify; text-justify: inter-word; }
  .livret-prose { line-height: 1.7; }
  @media print {
    @page { margin: 16mm 14mm; }
    .livret-doc, .livret-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .eviter-coupure { break-inside: avoid; }
    .saut-apres { break-after: page; }
  }
`;

type PastilleDef = { label: string; cls: string; Icone: typeof FileText };
const PASTILLES: Record<string, PastilleDef> = {
  texte: { label: "Leçon", cls: "border-forest-200 bg-forest-50 text-forest-700", Icone: FileText },
  quiz: { label: "Évaluation", cls: "border-gold-300 bg-gold-50 text-gold-700", Icone: ListChecks },
  devoir: { label: "Atelier", cls: "border-gold-300 bg-gold-50 text-gold-700", Icone: FileCheck2 },
  video: { label: "Vidéo", cls: "border-cream-300 bg-cream-100 text-ink-700", Icone: Video },
  fichier: { label: "Document", cls: "border-cream-300 bg-cream-100 text-ink-700", Icone: FileDown },
  lien: { label: "Ressource", cls: "border-cream-300 bg-cream-100 text-ink-700", Icone: ExternalLink },
};
function PastilleType({ type }: { type: string }) {
  const d = PASTILLES[type] ?? PASTILLES.texte;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide ${d.cls}`}>
      <d.Icone size={12} /> {d.label}
    </span>
  );
}

/** Carte de statistique de couverture (infographie). */
function StatCarte({ Icone, valeur, libelle }: { Icone: typeof FileText; valeur: string | number; libelle: string }) {
  return (
    <div className="eviter-coupure flex flex-col items-center gap-1 rounded-2xl border border-cream-200 bg-cream-50/70 px-3 py-4 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-600 text-white"><Icone size={17} /></span>
      <span className="font-display text-xl font-black text-forest-900">{valeur}</span>
      <span className="text-[0.68rem] font-medium uppercase tracking-wide text-ink-700/60">{libelle}</span>
    </div>
  );
}

/** Version APPRENANT : présente les éléments d'une question non-QCM SANS révéler la solution. */
function QuestionSansReponse({ q }: { q: { type: string; choix: { id: string; texte: string; apparie: string | null }[] } }) {
  if (q.type === "association") {
    const droites = q.choix.map((c) => c.apparie ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
    return (
      <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><p className="mb-1 text-[0.66rem] font-semibold uppercase tracking-wide text-ink-700/50">À relier</p><ul className="list-disc space-y-0.5 pl-4">{q.choix.map((c) => <li key={c.id}>{c.texte}</li>)}</ul></div>
        <div><p className="mb-1 text-[0.66rem] font-semibold uppercase tracking-wide text-ink-700/50">avec (dans le désordre)</p><ul className="list-disc space-y-0.5 pl-4">{droites.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      </div>
    );
  }
  if (q.type === "remise_en_ordre") {
    const items = q.choix.map((c) => c.texte).sort((a, b) => a.localeCompare(b, "fr"));
    return (
      <div className="mt-2 text-sm">
        <p className="mb-1 text-[0.66rem] font-semibold uppercase tracking-wide text-ink-700/50">Éléments à remettre dans l&apos;ordre</p>
        <ul className="list-disc space-y-0.5 pl-4">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
    );
  }
  return <p className="mt-2 text-sm italic text-ink-700/55">Complétez les espaces indiqués dans l&apos;énoncé.</p>;
}

/**
 * LIVRET IMPRIMABLE d'un cours (narrations théoriques + évaluations). DEUX versions :
 *  - « apprenant » (par défaut) : sans les bonnes réponses ni corrigés ;
 *  - « formateur » (?corrige=1, admin/tuteur uniquement) : corrections commentées incluses.
 * Imprimable / exportable en PDF. Non indexé.
 */
export default async function LivretPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ corrige?: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;
  const { corrige: corrigeParam } = await searchParams;

  const cours = await prisma.cours.findUnique({
    where: { slug },
    select: {
      id: true, titre: true, description: true, dureeMinutes: true, niveau: true, statut: true, estSeminaire: true, modulesGroupes: true,
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

  const estAdmin = u.roleActif === "admin" || u.roleReel === "admin";
  const estTuteur = estAdmin || Boolean(
    await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId: cours.id, utilisateurId: u.id } }, select: { id: true } }),
  );

  // Accès au cours : mêmes gardes que la page du cours (publié pour tous, brouillon/démo = admin).
  if (cours.statut !== "publie" && !estAdmin) redirect(`${BASE}/guides`);
  if (slug.startsWith("demo-") && !estAdmin) redirect(`${BASE}/guides`);

  // DEUX VERSIONS. « apprenant » (par défaut) : sans les réponses ni corrigés — accessible à tout
  // apprenant du cours. « formateur » (?corrige=1) : corrections commentées — RÉSERVÉE aux admin et
  // tuteurs. Un apprenant qui vise l'URL des corrigés est renvoyé vers la version sans réponses.
  if (corrigeParam === "1" && !estTuteur) redirect(`${BASE}/cours/${slug}/livret`);
  const corrige = corrigeParam === "1" && estTuteur;

  type ModuleLivret = (typeof cours.modules)[number];

  // Chapitrage : chaque leçon « texte » ouvre un module ; les activités suivantes s'y rattachent ;
  // les évaluations de clôture forment un chapitre final. (Cohérent avec l'affichage du cours.)
  const chapitres: { cle: string; titre: string; finale: boolean; activites: ModuleLivret[] }[] = [];
  if (cours.modulesGroupes) {
    let courant: (typeof chapitres)[number] | null = null;
    let finale: (typeof chapitres)[number] | null = null;
    for (const m of cours.modules) {
      if (estFinaleTitre(m.titre)) {
        if (!finale) finale = { cle: "__finale__", titre: "Évaluation finale et clôture", finale: true, activites: [] };
        finale.activites.push(m);
        continue;
      }
      if (m.type === "texte" || courant === null) {
        courant = { cle: m.id, titre: m.titre, finale: false, activites: [] };
        chapitres.push(courant);
      }
      courant.activites.push(m);
    }
    if (finale) chapitres.push(finale);
  } else {
    for (const m of cours.modules) chapitres.push({ cle: m.id, titre: m.titre, finale: false, activites: [m] });
  }

  const nbModules = cours.modulesGroupes ? chapitres.filter((c) => !c.finale).length : cours.modules.length;
  const nbEval = cours.modules.filter((m) => m.type === "quiz" || m.type === "devoir").length;
  const rubrique = cours.estSeminaire ? "Séminaire" : "Formation";

  // Intercalaires : seulement pour les cours réellement chapitrés par module (sinon chaque activité
  // isolée gonflerait inutilement le PDF). Le titre de module occupe alors sa propre page à
  // l'impression, et le contenu du module démarre à la page suivante.
  const intercalaires = cours.modulesGroupes;
  const clsHeaderPrint = intercalaires
    ? "print:min-h-[75vh] print:flex-col print:items-center print:justify-center print:gap-6 print:border-b-0 print:pb-0 print:text-center print:break-before-page print:break-after-page"
    : "";
  const clsNumPrint = intercalaires ? "print:h-28 print:w-28 print:rounded-[2rem] print:text-5xl" : "";
  const clsTitrePrint = intercalaires ? "print:mx-auto print:max-w-2xl print:text-balance print:text-4xl" : "";

  // Contenu interne d'une activité (narration, ressource, quiz corrigé, atelier).
  const contenuActivite = (m: ModuleLivret) => (
    <>
      {m.type === "texte" && m.contenu && (
        <div
          className={`livret-prose text-[0.92rem] text-ink-800 ${estHtmlRiche(m.contenu) ? CLASSE_HTML_RICHE : ""}`}
          dangerouslySetInnerHTML={{ __html: estHtmlRiche(m.contenu) ? m.contenu : rendreTexteRiche(m.contenu) }}
        />
      )}

      {m.type === "video" && m.contenu && (
        <p className="text-sm text-ink-800">Ressource vidéo : <span className="break-all text-forest-700 underline">{m.contenu}</span></p>
      )}
      {m.type === "fichier" && (
        <p className="text-sm text-ink-800">Document joint : <strong>{m.fichierNom ?? "fichier"}</strong>{m.fichierUrl ? <> — <span className="break-all text-forest-700 underline">{m.fichierUrl}</span></> : null}</p>
      )}
      {m.type === "lien" && m.contenu && (
        <p className="text-sm text-ink-800">Ressource externe : <span className="break-all text-forest-700 underline">{m.contenu}</span></p>
      )}

      {m.type === "quiz" && m.quiz && (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-forest-100 px-2.5 py-0.5 font-bold uppercase tracking-wide text-forest-800">
              {m.quiz.mode === "sommatif" ? "Sommative (notée)" : "Formative"}
            </span>
            <span className="text-ink-700/60">Seuil de réussite : {m.quiz.seuilReussite} %</span>
          </p>
          {m.quiz.consigne && <p className="livret-prose text-sm italic text-ink-700/75">{m.quiz.consigne}</p>}
          <ol className="space-y-3">
            {m.quiz.questions.map((q, qi) => {
              const qcm = TYPES_CHOIX.includes(q.type);
              return (
                <li key={q.id} className="eviter-coupure rounded-xl border border-cream-200 bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[0.92rem] font-semibold text-ink-900">
                      <span className="mr-1 font-display text-forest-600">Q{qi + 1}.</span>{q.enonce}
                    </p>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-cream-100 px-2 py-0.5 text-[0.66rem] font-semibold text-ink-700/70">{q.points} pt</span>
                  </div>
                  <p className="mt-0.5 text-[0.66rem] uppercase tracking-wide text-ink-700/45">{libelleTypeQuestion(q.type)}</p>
                  {qcm ? (
                    <ul className="mt-2 space-y-1">
                      {q.choix.map((c) => {
                        const bon = corrige && c.correct;
                        return (
                          <li key={c.id} className={`flex items-start gap-2 rounded-lg px-2 py-1 text-sm ${bon ? "bg-forest-50 font-semibold text-forest-800" : "text-ink-800"}`}>
                            {bon ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-forest-600" /> : <Circle size={15} className="mt-0.5 shrink-0 text-ink-700/30" />}
                            <span>{c.texte}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : corrige ? (
                    <p className="mt-2 rounded-lg bg-forest-50 px-2.5 py-1.5 text-sm text-forest-900"><span className="font-semibold">Réponse attendue : </span>{descriptionSolution(q.type, q.choix)}</p>
                  ) : (
                    <QuestionSansReponse q={q} />
                  )}
                  {corrige && q.explication && (
                    <div className="mt-2 border-l-2 border-gold-300 bg-gold-50/60 py-1.5 pl-3 pr-2 text-[0.82rem] leading-relaxed text-ink-800">
                      <span className="font-semibold text-gold-700">Corrigé — </span><span className="livret-prose">{q.explication}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {m.type === "devoir" && m.devoir && (
        <div className="rounded-xl border border-gold-200 bg-gold-50/40 p-4">
          <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gold-700">
            <PenLine size={13} /> Production évaluée
            <span className="rounded-full bg-white px-2 py-0.5 text-[0.66rem] text-ink-700/70">noté sur {m.devoir.noteSur}</span>
          </p>
          {m.devoir.consigne && (
            <div
              className={`livret-prose text-[0.9rem] text-ink-800 ${estHtmlRiche(m.devoir.consigne) ? CLASSE_HTML_RICHE : ""}`}
              dangerouslySetInnerHTML={{ __html: estHtmlRiche(m.devoir.consigne) ? m.devoir.consigne : rendreTexteRiche(m.devoir.consigne) }}
            />
          )}
          <p className="mt-2 text-xs text-ink-700/60">
            Rendu attendu : {[m.devoir.accepteTexte && "texte en ligne", m.devoir.accepteFichier && "dépôt de fichier"].filter(Boolean).join(" ou ") || "—"}
            {m.devoir.dateLimite ? ` · échéance le ${dateJour(m.devoir.dateLimite)}` : ""}
          </p>
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none print:space-y-0">
      <style dangerouslySetInnerHTML={{ __html: STYLE_IMPRESSION }} />

      {/* Barre d'action (masquée à l'impression) */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`${BASE}/cours/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Retour au cours</Link>
        <BoutonImprimerLivret />
      </div>

      <article lang="fr" className="livret-doc overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft print:rounded-none print:border-0 print:shadow-none">
        {/* ── Couverture ─────────────────────────────────────────────── */}
        <header className="saut-apres relative overflow-hidden bg-gradient-to-br from-forest-50 via-white to-gold-50/50 px-8 pb-9 pt-10 text-center print:bg-white">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-forest-600 via-gold-400 to-forest-600" aria-hidden />
          <div className="mb-4 flex flex-col items-center gap-2.5">
            {/* Logo officiel EduWeb Planner (public/logo.png). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="EduWeb Planner" className="h-28 w-auto object-contain drop-shadow-sm" />
            <p className="font-display text-xs font-bold uppercase tracking-[0.28em] text-forest-700">EduWeb Planner · Académie</p>
          </div>
          <div className="mx-auto mb-4 flex max-w-md items-center gap-3 text-gold-400">
            <span className="h-px flex-1 bg-gold-300" /><span className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-gold-600">{rubrique} · Livret {corrige ? "du formateur" : "de l'apprenant"}</span><span className="h-px flex-1 bg-gold-300" />
          </div>
          <h1 className="mx-auto max-w-2xl text-balance font-display text-[1.75rem] font-black leading-tight tracking-tight text-forest-900 sm:text-4xl">{cours.titre}</h1>
          {cours.description && <p className="livret-doc mx-auto mt-4 max-w-xl text-justify text-[0.92rem] leading-relaxed text-ink-700/80">{cours.description}</p>}

          {/* Infographie de couverture */}
          <div className="mx-auto mt-7 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCarte Icone={Layers} valeur={nbModules} libelle="Modules" />
            <StatCarte Icone={ListChecks} valeur={nbEval} libelle="Évaluations" />
            {cours.dureeMinutes ? <StatCarte Icone={Clock} valeur={dureeLisible(cours.dureeMinutes)} libelle="Durée" /> : null}
            {cours.niveau ? <StatCarte Icone={GraduationCap} valeur={NIVEAUX_LABEL[cours.niveau] ?? cours.niveau} libelle="Niveau" /> : null}
          </div>

          <p className="mt-6 inline-block rounded-full border border-gold-200 bg-white/70 px-4 py-1 text-[0.7rem] font-medium text-gold-700">
            {cours.categorie?.nom ? `${cours.categorie.nom} · ` : ""}{corrige ? "Document du formateur (corrigés inclus)" : "Livret de l'apprenant (sans les réponses)"} · Édité le {dateJour(new Date())}
          </p>
        </header>

        <div className="px-8 py-8">
          {/* ── Sommaire ─────────────────────────────────────────────── */}
          <nav className="eviter-coupure mb-9">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.16em] text-forest-700">
              <span className="h-4 w-1 rounded-full bg-gold-400" /> Sommaire
            </h2>
            <ol className="divide-y divide-cream-100 overflow-hidden rounded-2xl border border-cream-200">
              {chapitres.map((ch, ci) => (
                <li key={ch.cle} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-forest-50 font-display text-sm font-bold text-forest-700">{ci + 1}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">{ch.titre}</span>
                  <span className="shrink-0 text-xs text-ink-700/50">{ch.activites.length} activité{ch.activites.length > 1 ? "s" : ""}</span>
                </li>
              ))}
            </ol>
          </nav>

          {/* ── Chapitres (modules) ─────────────────────────────────── */}
          <div className="space-y-9">
            {chapitres.map((ch, ci) => (
              <section key={ch.cle} className="space-y-4">
                {/* Titre de module = page intercalaire à l'impression (isolé sur sa page, le contenu
                    du module démarre à la page suivante). À l'écran : simple en-tête. */}
                <header className={`eviter-coupure flex items-center gap-3 border-b-2 border-forest-100 pb-2.5 ${clsHeaderPrint}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-600 font-display text-lg font-black text-white ${clsNumPrint}`}>{String(ci + 1).padStart(2, "0")}</span>
                  <div className={intercalaires ? "print:space-y-3" : ""}>
                    {intercalaires && <p className="hidden font-display text-xs font-bold uppercase tracking-[0.28em] text-gold-600 print:block">{ch.finale ? "Clôture" : `Module ${ci + 1}`}</p>}
                    <h2 className={`font-display text-xl font-bold leading-tight text-forest-900 ${clsTitrePrint}`}>{ch.titre}</h2>
                    {intercalaires && <p className="hidden text-sm text-ink-700/55 print:block">{ch.activites.length} activité{ch.activites.length > 1 ? "s" : ""}</p>}
                  </div>
                </header>

                <div className="space-y-5">
                  {ch.activites.map((m, ai) => (
                    <div key={m.id} className="eviter-coupure">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <PastilleType type={m.type} />
                        <h3 className="font-display text-base font-bold text-forest-900">
                          <span className="text-ink-700/40">{ci + 1}.{ai + 1}</span> {m.titre}
                        </h3>
                        {m.dureeMinutes ? <span className="text-xs text-ink-700/50">· {m.dureeMinutes} min</span> : null}
                      </div>
                      <div className="pl-1">{contenuActivite(m)}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* ── Pied ─────────────────────────────────────────────────── */}
          <footer className="eviter-coupure mt-12 flex flex-col items-center gap-1 border-t border-cream-200 pt-6 text-center text-xs text-ink-700/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" aria-hidden className="mb-1 h-9 w-auto opacity-80" />
            {cours.attestationSignataire ? <p className="font-medium text-ink-800">{cours.attestationSignataire}{cours.attestationFonction ? ` · ${cours.attestationFonction}` : ""}</p> : null}
            <p>Livret généré par EduWeb Planner — Centre de formation · {dateJour(new Date())}</p>
          </footer>
        </div>
      </article>

      <p className="text-center text-xs text-ink-700/50 print:hidden">
        Utilisez « Imprimer / Enregistrer en PDF » pour télécharger ce livret.{corrige ? " Version formateur — réservée aux administrateurs et tuteurs (contient les corrigés)." : " Version apprenant — sans les réponses."}
      </p>
    </div>
  );
}
