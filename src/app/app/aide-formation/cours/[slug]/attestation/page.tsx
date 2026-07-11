import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Award, GraduationCap } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { mentionAttestation } from "@/lib/lms-completion";
import { BoutonImprimerAttestation } from "./bouton-imprimer";

export const metadata: Metadata = { title: "Attestation — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

function formaterDate(d: Date | null): string {
  return (d ?? new Date()).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function AttestationPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;

  const cours = await prisma.cours.findUnique({
    where: { slug },
    select: {
      id: true, titre: true, dureeMinutes: true, seuilCompletion: true,
      attestationSignataire: true, attestationFonction: true, attestationMention: true,
      categorie: { select: { nom: true } },
      modules: { where: { type: "quiz" }, select: { id: true, quiz: { select: { id: true, mode: true } } } },
      _count: { select: { modules: true } },
    },
  });
  if (!cours) redirect(`${BASE}/guides`);

  const [inscription, apprenant] = await Promise.all([
    prisma.inscriptionCours.findUnique({
      where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: cours.id } },
      select: { id: true, progressionPct: true, dateFin: true, progressions: { where: { termine: true }, select: { moduleId: true } } },
    }),
    prisma.utilisateur.findUnique({ where: { id: u.id }, select: { nom: true, prenoms: true, email: true } }),
  ]);
  if (!inscription) redirect(`${BASE}/cours/${slug}`);

  // Éligibilité : seuil de complétion atteint ET tous les quiz sommatifs réussis.
  const seuil = Math.min(100, Math.max(1, cours.seuilCompletion ?? 100));
  const termines = new Set(inscription.progressions.map((p) => p.moduleId));
  const sommatifIds = cours.modules.filter((m) => m.quiz?.mode === "sommatif").map((m) => m.id);
  const sommatifsOk = sommatifIds.every((id) => termines.has(id));
  if (cours._count.modules === 0 || inscription.progressionPct < seuil || !sommatifsOk) redirect(`${BASE}/cours/${slug}`);

  // Score moyen aux évaluations NOTÉES (quiz sommatifs uniquement, meilleure tentative par quiz) → mention.
  const quizIds = cours.modules.filter((m) => m.quiz?.mode === "sommatif").map((m) => m.quiz?.id).filter((x): x is string => Boolean(x));
  let scoreMoyen: number | null = null;
  if (quizIds.length > 0) {
    const tentatives = await prisma.tentativeQuiz.findMany({
      where: { utilisateurId: u.id, quizId: { in: quizIds } },
      select: { quizId: true, pourcentage: true },
    });
    const meilleures = new Map<string, number>();
    for (const t of tentatives) meilleures.set(t.quizId, Math.max(meilleures.get(t.quizId) ?? 0, t.pourcentage));
    if (meilleures.size > 0) scoreMoyen = Math.round([...meilleures.values()].reduce((a, b) => a + b, 0) / meilleures.size);
  }

  const nomComplet = [apprenant?.prenoms, apprenant?.nom].filter(Boolean).join(" ").trim() || (apprenant?.email ?? "Apprenant");
  const reference = `EWB-${cours.id.slice(-6).toUpperCase()}-${inscription.id.slice(-6).toUpperCase()}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`${BASE}/cours/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Retour au cours</Link>
        <BoutonImprimerAttestation />
      </div>

      {/* Attestation */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-gold-300 bg-white p-8 shadow-soft print:rounded-none print:border print:shadow-none sm:p-12">
        <div className="pointer-events-none absolute inset-0 rounded-3xl border-[6px] border-forest-100 [margin:14px] print:hidden" />
        <div className="relative space-y-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-600 text-white"><GraduationCap size={28} /></span>
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-forest-700">EduWeb Planner · Académie</p>
          </div>

          <div className="flex items-center justify-center gap-3 text-gold-500">
            <span className="h-px w-12 bg-gold-300" /><Award size={26} /><span className="h-px w-12 bg-gold-300" />
          </div>

          <h1 className="font-display text-3xl font-black tracking-tight text-forest-900">Attestation de réussite</h1>
          <p className="text-sm text-ink-700/70">Le présent document atteste que</p>

          <p className="font-display text-2xl font-bold text-forest-800">{nomComplet}</p>

          <p className="mx-auto max-w-lg text-sm leading-relaxed text-ink-800">
            a suivi et validé avec succès la formation
          </p>
          <p className="mx-auto max-w-xl font-display text-xl font-bold text-forest-900">« {cours.titre} »</p>
          <p className="text-sm text-ink-700/70">
            {cours.categorie?.nom ? `${cours.categorie.nom} · ` : ""}Formation achevée le {formaterDate(inscription.dateFin)}
            {cours.dureeMinutes ? ` · Durée estimée ${cours.dureeMinutes} min` : ""}
          </p>

          {scoreMoyen !== null && (
            <div className="mx-auto inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-forest-50 px-5 py-2 text-sm text-forest-800">
              <span>Score moyen aux évaluations : <strong>{scoreMoyen} %</strong></span>
              <span className="text-forest-300">•</span>
              <span>Mention : <strong>{mentionAttestation(scoreMoyen)}</strong></span>
            </div>
          )}
          {cours.attestationMention && (
            <p className="mx-auto max-w-xl text-sm font-medium italic text-forest-700">{cours.attestationMention}</p>
          )}

          <div className="mt-6 flex flex-col items-end justify-between gap-6 border-t border-cream-200 pt-5 text-xs text-ink-700/60 sm:flex-row">
            <span className="self-center sm:self-end">Référence : <strong className="font-mono text-ink-800">{reference}</strong></span>
            {cours.attestationSignataire ? (
              <span className="text-center">
                <span className="mb-1 block h-8 w-40 border-b border-ink-700/25" />
                <strong className="text-ink-800">{cours.attestationSignataire}</strong>
                {cours.attestationFonction && <><br />{cours.attestationFonction}</>}
                <br />le {formaterDate(new Date())}
              </span>
            ) : (
              <span className="self-center text-right sm:self-end">Délivrée par la plateforme EduWeb Planner<br />le {formaterDate(new Date())}</span>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-ink-700/50 print:hidden">
        Utilisez « Imprimer / Enregistrer en PDF » pour conserver ou partager votre attestation.
      </p>
    </div>
  );
}
