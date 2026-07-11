import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileCheck2, Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { FormReglagesDevoir } from "./devoir-editeur";

export const metadata: Metadata = { title: "Devoir — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

export default async function DevoirEditeurPage({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  await requireRole(["admin"]);
  const { id: coursId, moduleId } = await params;

  const lecon = await prisma.moduleCours.findFirst({
    where: { id: moduleId, coursId },
    select: { titre: true, devoir: { select: { consigne: true, accepteTexte: true, accepteFichier: true, noteSur: true, dateLimite: true, _count: { select: { soumissions: true } } } } },
  });
  if (!lecon) redirect(`${BASE}/gestion/cours/${coursId}`);
  const devoir = lecon.devoir ?? (await prisma.devoir.create({ data: { moduleId }, select: { consigne: true, accepteTexte: true, accepteFichier: true, noteSur: true, dateLimite: true, _count: { select: { soumissions: true } } } }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/gestion/cours/${coursId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Édition du cours</Link>
      <PageHeader titre={`Devoir — ${lecon.titre}`} description="Consigne, mode de dépôt et barème. Les apprenants déposent leur travail ; les tuteurs du cours le corrigent." />

      <section className="space-y-2">
        <h2 className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-700/55"><FileCheck2 size={16} /> Réglages</h2>
        <FormReglagesDevoir moduleId={moduleId} coursId={coursId} devoir={devoir} />
      </section>

      <Card className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-50 text-forest-700"><Inbox size={20} /></span>
        <div>
          <p className="font-display text-lg font-bold text-forest-900">{devoir._count.soumissions}</p>
          <p className="text-xs text-ink-700/60">dépôt(s) reçu(s) — corrigez-les depuis <Link href={`${BASE}/corrections`} className="font-semibold text-forest-700 hover:underline">Corrections</Link></p>
        </div>
      </Card>
    </div>
  );
}
