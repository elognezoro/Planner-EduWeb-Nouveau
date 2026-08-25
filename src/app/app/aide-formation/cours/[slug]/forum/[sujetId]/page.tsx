import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Pin, Lock, Sparkles, MessagesSquare } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { CLASSE_HTML_RICHE } from "@/lib/lms";
import {
  FormMessage,
  FormModifierMessage,
  BoutonSupprimerMessage,
  BoutonSupprimerSujet,
  BoutonsModerationSujet,
  BoutonSyntheseForum,
} from "../forum-forms";

export const metadata: Metadata = { title: "Fil de discussion — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const nomDe = (u: { nom: string | null; prenoms: string | null; email: string } | null) =>
  u ? [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email : "Utilisateur retiré";
const dateHeure = (d: Date) => new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function SujetForumPage({ params }: { params: Promise<{ slug: string; sujetId: string }> }) {
  const u = await requireUtilisateur();
  const { slug, sujetId } = await params;
  const estAdmin = u.roleActif === "admin";

  const sujet = await prisma.sujetForum.findUnique({
    where: { id: sujetId },
    select: {
      id: true, coursId: true, titre: true, description: true, epingle: true, ferme: true, creeParId: true,
      creePar: { select: { nom: true, prenoms: true, email: true } },
      cours: { select: { slug: true, titre: true, statut: true } },
      messages: {
        orderBy: { creeLe: "asc" },
        select: { id: true, contenu: true, creeLe: true, misAJourLe: true, auteurId: true, auteur: { select: { nom: true, prenoms: true, email: true } } },
      },
      syntheses: { orderBy: { creeLe: "desc" }, select: { id: true, contenu: true, nbMessages: true, creeLe: true } },
    },
  });
  if (!sujet || sujet.cours.slug !== slug) redirect(`${BASE}/cours/${slug}/forum`);
  if (sujet.cours.statut !== "publie" && !estAdmin) redirect(`${BASE}/guides`);

  const [estTuteur, inscrit] = await Promise.all([
    u.roleReel === "admin"
      ? Promise.resolve(true)
      : prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId: sujet.coursId, utilisateurId: u.id } }, select: { id: true } }).then(Boolean),
    prisma.inscriptionCours.findUnique({ where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: sujet.coursId } }, select: { id: true } }).then(Boolean),
  ]);
  const peutEcrire = !u.apercuActif && !u.accesRestreint && (estTuteur || (inscrit && sujet.cours.statut === "publie"));
  const peutSupprimerSujet = !u.apercuActif && (estTuteur || sujet.creeParId === u.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/cours/${slug}/forum`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Retour au forum
      </Link>

      <PageHeader
        titre={sujet.titre}
        description={`Forum du cours « ${sujet.cours.titre} »${sujet.description ? ` — ${sujet.description}` : ""}`}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 text-ink-700/60"><MessagesSquare size={13} className="text-forest-600" /> {sujet.messages.length} message(s)</span>
        {sujet.epingle && <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 font-semibold text-gold-700"><Pin size={11} /> Épinglé</span>}
        {sujet.ferme && <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2 py-0.5 font-semibold text-ink-700/70"><Lock size={11} /> Clos</span>}
      </div>

      {estTuteur && (
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">Espace formateur / tuteur</p>
          <BoutonSyntheseForum sujetId={sujet.id} nbMessages={sujet.messages.length} />
          <div className="flex flex-wrap items-center gap-3 border-t border-cream-100 pt-3">
            <BoutonsModerationSujet sujetId={sujet.id} epingle={sujet.epingle} ferme={sujet.ferme} />
          </div>
        </Card>
      )}

      {sujet.syntheses.length > 0 && (
        <Card className="space-y-3 border-gold-200 bg-gold-50/40">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-forest-900"><Sparkles size={16} className="text-gold-500" /> Synthèse des échanges — EduWeb Planner</p>
          {sujet.syntheses.map((s) => (
            <div key={s.id} className="rounded-xl border border-cream-200 bg-white p-3">
              <p className="whitespace-pre-line text-sm text-ink-800">{s.contenu}</p>
              <p className="mt-2 text-[0.68rem] text-ink-700/50">{dateHeure(s.creeLe)} · {s.nbMessages} message(s) synthétisé(s)</p>
            </div>
          ))}
        </Card>
      )}

      <div className="space-y-3">
        {sujet.messages.length === 0 ? (
          <Card className="py-8 text-center text-sm text-ink-700/60">Aucun message — soyez le premier à contribuer.</Card>
        ) : (
          sujet.messages.map((m) => {
            const peutEditer = !u.apercuActif && (m.auteurId === u.id || estTuteur);
            return (
              <Card key={m.id} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-forest-900">{nomDe(m.auteur)}</span>
                  <span className="text-xs text-ink-700/50">
                    {dateHeure(m.creeLe)}
                    {new Date(m.misAJourLe).getTime() - new Date(m.creeLe).getTime() > 1000 ? " · modifié" : ""}
                  </span>
                </div>
                <div className={CLASSE_HTML_RICHE} dangerouslySetInnerHTML={{ __html: m.contenu }} />
                {peutEditer && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-cream-100 pt-2">
                    <FormModifierMessage message={{ id: m.id, contenu: m.contenu }} />
                    <BoutonSupprimerMessage messageId={m.id} />
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {peutEcrire && !sujet.ferme ? (
        <FormMessage sujetId={sujet.id} />
      ) : sujet.ferme ? (
        <Card className="text-center text-sm text-ink-700/60"><Lock size={14} className="mr-1 inline" /> Ce fil est clos : plus de nouveaux messages.</Card>
      ) : (
        <Card className="text-center text-sm text-ink-700/60">Inscrivez-vous au cours pour participer à la discussion.</Card>
      )}

      {peutSupprimerSujet && (
        <div className="flex justify-end">
          <BoutonSupprimerSujet sujetId={sujet.id} />
        </div>
      )}
    </div>
  );
}
