import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Compass, ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { estFormateurDesigne } from "@/lib/manuel/formateurs";
import { FormateursForm } from "../manuel/formateurs-form";
import { CatalogueCours } from "../catalogue-cours";

export const metadata: Metadata = { title: "Guides d'utilisateurs — Aide et Formation" };
export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const u = await requireUtilisateur();
  const estAdmin = u.roleActif === "admin";
  // Manuel du formateur (Word, corrigés inclus) : admin + formateurs désignés uniquement.
  const formateur = await estFormateurDesigne(u);
  let emailsFormateurs = "";
  if (estAdmin) {
    const cfg = await prisma.configuration
      .findUnique({ where: { id: "global" }, select: { emailsFormateurs: true } })
      .catch(() => null);
    emailsFormateurs = cfg?.emailsFormateurs ?? "";
  }

  // Cette page ne liste QUE les « guides d'utilisation » (par rôle) : cours marqués `estGuide`.
  // Les autres formations figurent sur « Formations » (cf. estGuide dans la fiche du cours).
  const [cours, inscriptions] = await Promise.all([
    prisma.cours.findMany({
      where: {
        statut: "publie",
        estGuide: true,
        ...(estAdmin ? {} : { NOT: { slug: { startsWith: "demo-" } } }),
        OR: [{ publicCible: { isEmpty: true } }, { publicCible: { has: u.roleActif } }],
      },
      orderBy: [{ categorie: { ordre: "asc" } }, { ordre: "asc" }, { titre: "asc" }],
      select: {
        id: true, titre: true, slug: true, description: true, niveau: true, dureeMinutes: true,
        categorie: { select: { id: true, nom: true } },
        _count: { select: { modules: true } },
      },
    }),
    prisma.inscriptionCours.findMany({ where: { utilisateurId: u.id }, select: { coursId: true, progressionPct: true } }),
  ]);
  const progressionPar = new Map(inscriptions.map((i) => [i.coursId, i.progressionPct]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Guides d'utilisateurs et formation à l'utilisation"
        description="Guides pratiques pour prendre en main EduWeb Planner selon votre rôle, à votre rythme."
      />

      <Link
        href="/app/aide-formation/guides/plateforme"
        className="group flex items-center gap-4 rounded-2xl border border-gold-200 bg-gradient-to-r from-gold-50 to-forest-50/40 p-5 shadow-soft transition hover:border-gold-300"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-600 text-white"><Compass size={24} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-forest-900">Guide complet de la plateforme</h2>
          <p className="text-sm text-ink-700/70">Prise en main, usage détaillé de chaque rôle et chapitre approfondi sur le centre de formation (badges et certificats compris).</p>
        </div>
        <ArrowRight size={20} className="shrink-0 text-forest-600 transition group-hover:translate-x-0.5" />
      </Link>

      {/* Manuel du formateur — visible UNIQUEMENT des formateurs désignés (et de l'admin). */}
      {formateur && (
        <Link
          href="/app/aide-formation/manuel"
          className="group flex items-center gap-4 rounded-2xl border border-forest-300 bg-gradient-to-r from-forest-50 to-cream-50 p-5 shadow-soft transition hover:border-forest-400"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-800 text-gold-300"><FileText size={24} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-forest-900">
              Manuel du formateur — formation générale (Word)
              <span className="inline-flex items-center gap-1 rounded-full bg-forest-800 px-2.5 py-0.5 text-[0.65rem] font-semibold text-cream-50">
                <ShieldCheck size={11} /> Formateurs désignés
              </span>
            </h2>
            <p className="text-sm text-ink-700/70">
              Document complet de formation à la maîtrise de la plateforme, rôle par rôle : guides détaillés,
              formations interactives et corrigés des évaluations. Téléchargeable en Word et en PDF.
            </p>
          </div>
          <ArrowRight size={20} className="shrink-0 text-forest-600 transition group-hover:translate-x-0.5" />
        </Link>
      )}

      {/* Désignation des formateurs (admin système). */}
      {estAdmin && (
        <Card>
          <FormateursForm emails={emailsFormateurs} />
        </Card>
      )}

      {cours.length === 0 ? (
        <Card className="py-10 text-center">
          <BookOpen size={30} className="mx-auto mb-3 text-forest-300" />
          <p className="text-sm text-ink-700/70">Le guide complet ci-dessus couvre l&apos;usage de la plateforme pour chaque rôle.</p>
          <p className="mt-1 text-xs text-ink-700/55">Les guides d&apos;utilisation dédiés apparaîtront ici. Les formations (DHFC-EBiS, etc.) sont dans « Formations ».</p>
          {estAdmin && (
            <Link href="/app/aide-formation/formations" className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:text-forest-900">
              Gérer le contenu depuis « Formations » →
            </Link>
          )}
        </Card>
      ) : (
        <CatalogueCours cours={cours} progressionPar={progressionPar} categorieParDefaut="Guides d'utilisation" />
      )}
    </div>
  );
}
