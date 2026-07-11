import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users2, Star, ChevronRight, BookOpenCheck } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { FormNouvellePage } from "./wiki-forms";

export const metadata: Metadata = { title: "Espace collaboratif — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const nomDe = (u: { nom: string | null; prenoms: string | null; email: string } | null) =>
  u ? [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email : "—";

export default async function WikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;
  const estAdmin = u.roleActif === "admin";

  const cours = await prisma.cours.findUnique({
    where: { slug },
    select: { id: true, titre: true, statut: true },
  });
  if (!cours) redirect(`${BASE}/guides`);
  if (cours.statut !== "publie" && !estAdmin) redirect(`${BASE}/guides`);

  // Droits calculés côté serveur : seul un tuteur/admin ou un inscrit (cours publié) peut contribuer.
  const [estTuteur, inscrit, pages] = await Promise.all([
    u.roleReel === "admin"
      ? Promise.resolve(true)
      : prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId: cours.id, utilisateurId: u.id } }, select: { id: true } }).then(Boolean),
    prisma.inscriptionCours.findUnique({ where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: cours.id } }, select: { id: true } }).then(Boolean),
    prisma.pageWiki.findMany({
      where: { coursId: cours.id },
      orderBy: { misAJourLe: "desc" },
      select: {
        id: true, titre: true, misAJourLe: true,
        creePar: { select: { nom: true, prenoms: true, email: true } },
        misAJourPar: { select: { nom: true, prenoms: true, email: true } },
        _count: { select: { revisions: true, evaluations: true } },
        evaluations: { orderBy: { misAJourLe: "desc" }, select: { type: true, note: true } },
      },
    }),
  ]);
  const peutEditer = !u.apercuActif && !u.accesRestreint && (estTuteur || (inscrit && cours.statut === "publie"));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/cours/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Retour au cours
      </Link>

      <PageHeader
        titre="Espace collaboratif (wiki)"
        description={`Travaux collaboratifs du cours « ${cours.titre} » : pages co-rédigées par les apprenants, avec historique des révisions, évaluées par les pairs et par le formateur/tuteur.`}
        action={peutEditer ? <FormNouvellePage coursId={cours.id} /> : undefined}
      />

      {pages.length === 0 ? (
        <Card className="py-12 text-center">
          <Users2 size={30} className="mx-auto mb-3 text-forest-300" />
          <p className="text-sm text-ink-700/70">Aucune page pour l&apos;instant — créez la première page collaborative.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pages.map((p) => {
            const notesPairs = p.evaluations.filter((e) => e.type === "pair" && e.note != null).map((e) => e.note!);
            const notesTuteur = p.evaluations.filter((e) => e.type === "tuteur" && e.note != null).map((e) => e.note!);
            const moyPairs = notesPairs.length ? Math.round((notesPairs.reduce((a, b) => a + b, 0) / notesPairs.length) * 10) / 10 : null;
            return (
              <Link key={p.id} href={`${BASE}/cours/${slug}/wiki/${p.id}`} className="block rounded-2xl border border-cream-200 bg-white p-4 shadow-soft transition hover:border-forest-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold text-forest-900">{p.titre}</h2>
                    <p className="mt-0.5 text-xs text-ink-700/60">
                      Créée par {nomDe(p.creePar)} · dernière révision {new Date(p.misAJourLe).toLocaleDateString("fr-FR")} par {nomDe(p.misAJourPar)} · {p._count.revisions} révision(s)
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span className="inline-flex items-center gap-1 text-gold-700"><Star size={12} /> {p._count.evaluations} évaluation(s)</span>
                      {moyPairs !== null && <span className="text-forest-700">Pairs : {moyPairs}/20</span>}
                      {notesTuteur.length > 0 && <span className="inline-flex items-center gap-1 font-semibold text-forest-800"><BookOpenCheck size={12} /> Formateur : {notesTuteur[0]}/20</span>}
                    </p>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-forest-400" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
