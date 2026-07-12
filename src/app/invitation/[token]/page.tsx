import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Users, MapPin, Video, BookOpen, LogIn, UserPlus, AlertCircle, Ticket } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { FORMATS_SESSION } from "@/lib/lms";
import { AccepterInvitation } from "./accepter-form";

export const metadata: Metadata = { title: "Invitation à une formation — EduWeb Planner" };
export const dynamic = "force-dynamic";

const libelleFormat = (v: string) => FORMATS_SESSION.find((f) => f.v === v)?.libelle ?? v;
const dateHeure = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(d);

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-cream-50 to-forest-50/40 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-cream-200 bg-white p-6 shadow-soft sm:p-8">{children}</div>
    </main>
  );
}

export default async function InvitationPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { token } = await params;
  const { code } = await searchParams;

  const inv = await prisma.invitationFormation.findUnique({
    where: { token },
    select: {
      actif: true, code: true, expiration: true,
      session: {
        select: {
          id: true, titre: true, description: true, format: true, animateur: true, dateDebut: true, dateFin: true,
          lieu: true, lienVisio: true, statut: true, coursIds: true,
        },
      },
    },
  });

  const invalide = !inv || !inv.actif || (inv.expiration && inv.expiration < new Date()) || inv.session.statut !== "planifiee";
  if (invalide) {
    return (
      <Cadre>
        <div className="text-center">
          <AlertCircle size={34} className="mx-auto mb-3 text-amber-500" />
          <h1 className="font-display text-xl font-bold text-forest-900">Invitation indisponible</h1>
          <p className="mt-2 text-sm text-ink-700/70">Ce lien d&apos;invitation est invalide, désactivé, expiré, ou la formation n&apos;accepte plus d&apos;inscription.</p>
          <Link href="/app/aide-formation/formations" className="mt-4 inline-block text-sm font-semibold text-forest-700 hover:text-forest-900">Voir les formations disponibles →</Link>
        </div>
      </Cadre>
    );
  }

  const s = inv.session;
  const coursLies = s.coursIds.length
    ? await prisma.cours.findMany({ where: { id: { in: s.coursIds }, statut: "publie" }, select: { id: true, titre: true } })
    : [];
  const u = await getUtilisateurCourant();
  const cheminRetour = `/invitation/${token}${code ? `?code=${encodeURIComponent(code)}` : ""}`;

  return (
    <Cadre>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700">
        <Ticket size={14} /> Invitation à une formation
      </div>
      <h1 className="font-display text-2xl font-bold text-forest-900">{s.titre}</h1>
      {s.description && <p className="mt-2 text-sm text-ink-700/75">{s.description}</p>}

      <div className="mt-4 space-y-1.5 rounded-2xl bg-cream-50 p-4 text-sm text-ink-700/80">
        <p className="inline-flex items-center gap-2"><span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-semibold text-forest-800">{libelleFormat(s.format)}</span></p>
        <p className="flex items-center gap-2"><CalendarClock size={15} className="text-forest-600" /> {dateHeure(s.dateDebut)}{s.dateFin ? ` → ${dateHeure(s.dateFin)}` : ""}</p>
        {s.animateur && <p className="flex items-center gap-2"><Users size={15} className="text-forest-600" /> {s.animateur}</p>}
        {s.lieu && <p className="flex items-center gap-2"><MapPin size={15} className="text-forest-600" /> {s.lieu}</p>}
        {s.lienVisio && <p className="flex items-center gap-2"><Video size={15} className="text-forest-600" /> En ligne</p>}
        {coursLies.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 pt-1">
            <BookOpen size={15} className="text-forest-600" />
            <span className="font-medium">Donne accès à :</span>
            {coursLies.map((c) => <span key={c.id} className="rounded-full border border-forest-200 bg-forest-50 px-2 py-0.5 text-xs text-forest-700">{c.titre}</span>)}
          </p>
        )}
      </div>

      {u ? (
        <div className="mt-5">
          <AccepterInvitation token={token} aCode={!!inv.code} codeInitial={code ?? ""} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-cream-200 p-4 text-center">
          <p className="text-sm text-ink-700/75">Connectez-vous ou créez un compte pour rejoindre cette formation.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/connexion?callbackUrl=${encodeURIComponent(cheminRetour)}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"><LogIn size={16} /> Se connecter</Link>
            <Link href={`/inscription?callbackUrl=${encodeURIComponent(cheminRetour)}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-forest-200 px-5 py-2.5 text-sm font-semibold text-forest-800 hover:bg-forest-50"><UserPlus size={16} /> Créer un compte</Link>
          </div>
        </div>
      )}
    </Cadre>
  );
}
