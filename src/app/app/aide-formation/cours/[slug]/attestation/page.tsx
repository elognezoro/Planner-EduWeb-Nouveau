import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Award, GraduationCap } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
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
    select: { id: true, titre: true, dureeMinutes: true, categorie: { select: { nom: true } } },
  });
  if (!cours) redirect(`${BASE}/guides`);

  const [inscription, apprenant] = await Promise.all([
    prisma.inscriptionCours.findUnique({
      where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: cours.id } },
      select: { id: true, progressionPct: true, dateFin: true },
    }),
    prisma.utilisateur.findUnique({ where: { id: u.id }, select: { nom: true, prenoms: true, email: true } }),
  ]);

  // L'attestation n'est délivrée qu'au terme du cours (100 %).
  if (!inscription || inscription.progressionPct < 100) redirect(`${BASE}/cours/${slug}`);

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
            a suivi et validé avec succès l&apos;intégralité du parcours de formation
          </p>
          <p className="mx-auto max-w-xl font-display text-xl font-bold text-forest-900">« {cours.titre} »</p>
          <p className="text-sm text-ink-700/70">
            {cours.categorie?.nom ? `${cours.categorie.nom} · ` : ""}Formation achevée le {formaterDate(inscription.dateFin)}
            {cours.dureeMinutes ? ` · Durée estimée ${cours.dureeMinutes} min` : ""}
          </p>

          <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-cream-200 pt-5 text-xs text-ink-700/60 sm:flex-row">
            <span>Référence : <strong className="font-mono text-ink-800">{reference}</strong></span>
            <span className="text-right">Délivrée par la plateforme EduWeb Planner<br />le {formaterDate(new Date())}</span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-ink-700/50 print:hidden">
        Utilisez « Imprimer / Enregistrer en PDF » pour conserver ou partager votre attestation.
      </p>
    </div>
  );
}
