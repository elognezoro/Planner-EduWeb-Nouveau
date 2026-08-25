import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock, GraduationCap, LogIn, UserPlus, AlertCircle, Ticket, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { avecRetour } from "@/lib/auth/retour";
import { RejoindreCours } from "./rejoindre-form";

export const metadata: Metadata = {
  title: "Inscription à un cours — EduWeb Planner",
  // Le jeton est une URL-capacité (quiconque la connaît peut demander l'inscription) :
  // jamais d'indexation par les moteurs ni les robots d'aperçu de liens.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const NIVEAUX: Record<string, string> = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé" };
const dureeLisible = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
};

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream-50 to-forest-50/40 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-cream-200 bg-white p-6 shadow-soft sm:p-8">{children}</div>
    </main>
  );
}

export default async function InvitationCoursPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const inv = await prisma.invitationCours.findUnique({
    where: { token },
    select: {
      actif: true, expiration: true, placesMax: true, coursId: true,
      cours: {
        select: { id: true, titre: true, slug: true, description: true, niveau: true, dureeMinutes: true, statut: true, imageUrl: true },
      },
    },
  });

  const placesAtteintes =
    inv && inv.placesMax != null && inv.placesMax > 0
      ? (await prisma.inscriptionCours.count({ where: { coursId: inv.coursId, source: "invitation" } })) >= inv.placesMax
      : false;

  const invalide =
    !inv || !inv.actif || (inv.expiration && inv.expiration < new Date()) || inv.cours.statut !== "publie" || placesAtteintes;

  if (invalide) {
    return (
      <Cadre>
        <div className="text-center">
          <AlertCircle size={34} className="mx-auto mb-3 text-amber-500" />
          <h1 className="font-display text-xl font-bold text-forest-900">Lien d&apos;inscription indisponible</h1>
          <p className="mt-2 text-sm text-ink-700/70">
            {placesAtteintes
              ? "Le nombre de places de ce lien est atteint."
              : "Ce lien d'inscription est invalide, désactivé, expiré, ou le cours n'est plus disponible."}
          </p>
          <Link href="/app/aide-formation/guides" className="mt-4 inline-block text-sm font-semibold text-forest-700 hover:text-forest-900">
            Voir les formations disponibles →
          </Link>
        </div>
      </Cadre>
    );
  }

  const c = inv.cours;
  const u = await getUtilisateurCourant();
  const cheminRetour = `/invitation/cours/${token}`;

  // Utilisateur déjà inscrit : on l'oriente directement vers le cours (pas de nouvelle adhésion).
  const dejaInscrit = u
    ? await prisma.inscriptionCours
        .findUnique({ where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: c.id } }, select: { id: true } })
        .then(Boolean)
    : false;

  return (
    <Cadre>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700">
        <Ticket size={14} /> Invitation à un cours
      </div>
      <h1 className="font-display text-2xl font-bold text-forest-900">{c.titre}</h1>
      {c.description && <p className="mt-2 text-sm text-ink-700/75">{c.description}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl bg-cream-50 p-4 text-sm text-ink-700/80">
        <span className="inline-flex items-center gap-2"><BookOpen size={15} className="text-forest-600" /> Formation en ligne</span>
        {c.niveau && (
          <span className="inline-flex items-center gap-2"><GraduationCap size={15} className="text-forest-600" /> {NIVEAUX[c.niveau] ?? c.niveau}</span>
        )}
        {c.dureeMinutes != null && c.dureeMinutes > 0 && (
          <span className="inline-flex items-center gap-2"><Clock size={15} className="text-forest-600" /> {dureeLisible(c.dureeMinutes)}</span>
        )}
      </div>

      {u ? (
        dejaInscrit ? (
          <div className="mt-5 rounded-2xl border border-forest-200 bg-forest-50/60 p-4 text-center">
            <CheckCircle2 size={30} className="mx-auto mb-2 text-forest-600" />
            <p className="text-sm font-semibold text-forest-900">Vous êtes déjà inscrit à ce cours.</p>
            <Link
              href={`/app/aide-formation/cours/${c.slug}`}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"
            >
              <BookOpen size={16} /> Accéder au cours
            </Link>
          </div>
        ) : (
          <div className="mt-5">
            <RejoindreCours token={token} />
          </div>
        )
      ) : (
        <div className="mt-5 rounded-2xl border border-cream-200 p-4 text-center">
          <p className="text-sm text-ink-700/75">Connectez-vous ou créez un compte pour rejoindre ce cours.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={avecRetour("/connexion", cheminRetour)} className="inline-flex items-center justify-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"><LogIn size={16} /> Se connecter</Link>
            <Link href={avecRetour("/inscription", cheminRetour)} className="inline-flex items-center justify-center gap-2 rounded-full border border-forest-200 px-5 py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50"><UserPlus size={16} /> Créer un compte</Link>
          </div>
        </div>
      )}
    </Cadre>
  );
}
