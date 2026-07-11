import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, History, Star, BookOpenCheck, Users2 } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { RenduRiche } from "@/components/ui/rendu-riche";
import { BoutonEcouter } from "../../../../bouton-ecouter";
import { FormModifierPage, BoutonSupprimerPage, FormEvaluation } from "../wiki-forms";

export const metadata: Metadata = { title: "Page collaborative — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const nomDe = (u: { nom: string | null; prenoms: string | null; email: string } | null) =>
  u ? [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email : "—";

export default async function PageWikiDetail({ params }: { params: Promise<{ slug: string; pageId: string }> }) {
  const u = await requireUtilisateur();
  const { slug, pageId } = await params;
  const estAdmin = u.roleActif === "admin";

  const page = await prisma.pageWiki.findUnique({
    where: { id: pageId },
    select: {
      id: true, titre: true, contenu: true, creeParId: true, creeLe: true, misAJourLe: true,
      creePar: { select: { nom: true, prenoms: true, email: true } },
      misAJourPar: { select: { nom: true, prenoms: true, email: true } },
      cours: { select: { id: true, slug: true, titre: true, statut: true } },
      revisions: { orderBy: { creeLe: "desc" }, take: 15, select: { id: true, creeLe: true, auteur: { select: { nom: true, prenoms: true, email: true } } } },
      evaluations: {
        orderBy: { misAJourLe: "desc" },
        select: { type: true, note: true, commentaire: true, misAJourLe: true, evaluateurId: true, evaluateur: { select: { nom: true, prenoms: true, email: true } } },
      },
    },
  });
  if (!page || page.cours.slug !== slug) redirect(`${BASE}/cours/${slug}/wiki`);
  if (page.cours.statut !== "publie" && !estAdmin) redirect(`${BASE}/guides`);

  // Droits calculés côté serveur : tuteur/admin ou inscrit.
  const estTuteur = u.roleReel === "admin"
    || !!(await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId: page.cours.id, utilisateurId: u.id } }, select: { id: true } }));
  const inscrit = !!(await prisma.inscriptionCours.findUnique({ where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: page.cours.id } }, select: { id: true } }));
  const peutEditer = !u.apercuActif && !u.accesRestreint && (estTuteur || inscrit);
  const peutEvaluer = !u.apercuActif && !u.accesRestreint && (estTuteur || (inscrit && page.creeParId !== u.id));
  const monEval = page.evaluations.find((e) => e.evaluateurId === u.id);

  const notesPairs = page.evaluations.filter((e) => e.type === "pair" && e.note != null).map((e) => e.note!);
  const moyPairs = notesPairs.length ? Math.round((notesPairs.reduce((a, b) => a + b, 0) / notesPairs.length) * 10) / 10 : null;
  // Évaluations déjà triées par misAJourLe desc : la plus récente évaluation tuteur ayant une note.
  const evalTuteur = page.evaluations.find((e) => e.type === "tuteur" && e.note != null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/cours/${slug}/wiki`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Espace collaboratif
      </Link>

      <PageHeader titre={page.titre} description={`Cours « ${page.cours.titre} » · créée par ${nomDe(page.creePar)} le ${new Date(page.creeLe).toLocaleDateString("fr-FR")}`} />

      <div className="flex flex-wrap items-center gap-2">
        <Badge ton="neutre">Dernière révision : {new Date(page.misAJourLe).toLocaleDateString("fr-FR")} par {nomDe(page.misAJourPar)}</Badge>
        {moyPairs !== null && <Badge ton="succes">Pairs : {moyPairs}/20 ({notesPairs.length})</Badge>}
        {evalTuteur?.note != null && <Badge ton="succes">Formateur : {evalTuteur.note}/20</Badge>}
      </div>

      {/* Contenu (sanitisé à l'enregistrement) */}
      <Card>
        {page.contenu ? (
          <>
            <div className="mb-2"><BoutonEcouter texte={page.contenu} compact label="Écouter la page" /></div>
            <RenduRiche contenu={page.contenu} className="text-sm text-ink-800" />
          </>
        ) : (
          <p className="text-sm text-ink-700/60">Page vide pour l&apos;instant — lancez la rédaction !</p>
        )}
      </Card>

      {peutEditer && (
        <div className="flex flex-wrap items-center gap-2">
          <FormModifierPage page={{ id: page.id, titre: page.titre, contenu: page.contenu }} />
          {(estTuteur || page.creeParId === u.id) && <BoutonSupprimerPage pageId={page.id} />}
        </div>
      )}

      {/* Évaluations : pairs + formateur/tuteur */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-forest-900"><Star size={16} className="text-gold-600" /> Évaluations</h2>
        {page.evaluations.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Pas encore d&apos;évaluation — les pairs et le formateur peuvent évaluer ce travail.</p></Card>
        ) : (
          <div className="space-y-2">
            {page.evaluations.map((e, i) => (
              <Card key={i} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {e.type === "tuteur"
                    ? <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-2.5 py-0.5 text-xs font-semibold text-white"><BookOpenCheck size={12} /> Formateur / tuteur</span>
                    : <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-semibold text-forest-800"><Users2 size={12} /> Pair</span>}
                  <span className="font-medium text-forest-900">{nomDe(e.evaluateur)}</span>
                  {e.note != null && <span className="font-bold text-forest-800">{e.note}/20</span>}
                  <span className="ml-auto text-xs text-ink-700/50">{new Date(e.misAJourLe).toLocaleDateString("fr-FR")}</span>
                </div>
                {e.commentaire && <RenduRiche contenu={e.commentaire} className="mt-1.5 text-sm text-ink-800" />}
              </Card>
            ))}
          </div>
        )}
        {peutEvaluer && <FormEvaluation pageId={page.id} estTuteur={estTuteur} dejaEvaluee={monEval ? { note: monEval.note, commentaire: monEval.commentaire } : undefined} />}
      </section>

      {/* Historique des révisions */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-forest-900"><History size={16} className="text-forest-600" /> Historique des révisions</h2>
        <Card className="divide-y divide-cream-100 p-0">
          {page.revisions.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-ink-800">{nomDe(r.auteur)}</span>
              <span className="text-xs text-ink-700/55">{new Date(r.creeLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
