import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessagesSquare, ChevronRight, Pin, Lock, Sparkles } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { FormNouveauSujet } from "./forum-forms";

export const metadata: Metadata = { title: "Forum — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const nomDe = (u: { nom: string | null; prenoms: string | null; email: string } | null) =>
  u ? [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email : "—";

export default async function ForumPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;
  const estAdmin = u.roleActif === "admin";

  const cours = await prisma.cours.findUnique({ where: { slug }, select: { id: true, titre: true, statut: true } });
  if (!cours) redirect(`${BASE}/guides`);
  if (cours.statut !== "publie" && !estAdmin) redirect(`${BASE}/guides`);

  const [estTuteur, inscrit, sujets] = await Promise.all([
    u.roleReel === "admin"
      ? Promise.resolve(true)
      : prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId: cours.id, utilisateurId: u.id } }, select: { id: true } }).then(Boolean),
    prisma.inscriptionCours.findUnique({ where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: cours.id } }, select: { id: true } }).then(Boolean),
    prisma.sujetForum.findMany({
      where: { coursId: cours.id },
      orderBy: [{ epingle: "desc" }, { misAJourLe: "desc" }],
      select: {
        id: true, titre: true, epingle: true, ferme: true, misAJourLe: true,
        creePar: { select: { nom: true, prenoms: true, email: true } },
        _count: { select: { messages: true, syntheses: true } },
      },
    }),
  ]);
  const peutEcrire = !u.apercuActif && !u.accesRestreint && (estTuteur || (inscrit && cours.statut === "publie"));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/cours/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Retour au cours
      </Link>

      <PageHeader
        titre="Forum de discussion"
        description={`Échangez entre apprenants du cours « ${cours.titre} » : questions, expériences, bonnes pratiques. Le formateur peut demander une synthèse des échanges par EduWeb Planner.`}
        action={peutEcrire ? <FormNouveauSujet coursId={cours.id} /> : undefined}
      />

      {!peutEcrire && !estTuteur && (
        <Card className="text-sm text-ink-700/70">
          {u.accesRestreint
            ? "Votre demande de rôle est en attente : l'accès au forum est limité."
            : "Inscrivez-vous à ce cours pour ouvrir un fil et publier des messages."}
        </Card>
      )}

      {sujets.length === 0 ? (
        <Card className="py-12 text-center">
          <MessagesSquare size={30} className="mx-auto mb-3 text-forest-300" />
          <p className="text-sm text-ink-700/70">Aucun fil de discussion pour l&apos;instant — ouvrez le premier.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sujets.map((s) => (
            <Link key={s.id} href={`${BASE}/cours/${slug}/forum/${s.id}`} className="block rounded-2xl border border-cream-200 bg-white p-4 shadow-soft transition hover:border-forest-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-forest-900">
                    {s.epingle && <Pin size={14} className="shrink-0 text-gold-600" />}
                    {s.ferme && <Lock size={14} className="shrink-0 text-ink-700/40" />}
                    {s.titre}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-700/60">
                    Ouvert par {nomDe(s.creePar)} · dernière activité {new Date(s.misAJourLe).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1 text-forest-700"><MessagesSquare size={12} /> {s._count.messages} message(s)</span>
                    {s._count.syntheses > 0 && <span className="inline-flex items-center gap-1 text-gold-700"><Sparkles size={12} /> {s._count.syntheses} synthèse(s)</span>}
                  </p>
                </div>
                <ChevronRight size={18} className="mt-1 shrink-0 text-forest-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
