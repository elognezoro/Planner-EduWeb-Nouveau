import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Ticket, Clock, CalendarClock } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { FORMATS_SESSION } from "@/lib/lms";
import { FormNouvelleInvitation, LigneInvitation, BoutonsDemande } from "./invitation-forms";

export const metadata: Metadata = { title: "Invitations & demandes — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const libelleFormat = (v: string) => FORMATS_SESSION.find((f) => f.v === v)?.libelle ?? v;
const nomDe = (u: { nom: string | null; prenoms: string | null; email: string }) =>
  [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email;

export default async function InvitationsPage() {
  await requireRole(["admin"]);

  const [sessions, demandes] = await Promise.all([
    prisma.sessionFormation.findMany({
      where: { statut: "planifiee" },
      orderBy: { dateDebut: "desc" },
      select: {
        id: true, titre: true, format: true, dateDebut: true,
        invitations: { orderBy: { creeLe: "desc" }, select: { id: true, token: true, code: true, actif: true, placesMax: true, expiration: true } },
      },
    }),
    prisma.inscriptionSession.findMany({
      where: { statut: "en_attente" },
      orderBy: { dateInscription: "asc" },
      select: {
        id: true, dateInscription: true,
        utilisateur: { select: { nom: true, prenoms: true, email: true } },
        session: { select: { titre: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Retour à la gestion</Link>
      <PageHeader
        titre="Invitations & demandes d'inscription"
        description="Créez des liens d'invitation par formation (validation par l'admin, ou auto-validation par code) et traitez les demandes en attente."
      />

      {/* Demandes en attente */}
      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Clock size={18} className="text-gold-600" /> Demandes en attente
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800">{demandes.length}</span>
        </h2>
        {demandes.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucune demande en attente.</p></Card>
        ) : (
          <Card className="divide-y divide-cream-100 p-0">
            {demandes.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-forest-900">{nomDe(d.utilisateur)}</p>
                  <p className="text-xs text-ink-700/60">{d.utilisateur.email} · {d.session.titre} · demandé le {new Date(d.dateInscription).toLocaleDateString("fr-FR")}</p>
                </div>
                <BoutonsDemande inscriptionId={d.id} />
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Liens d'invitation par session */}
      <section className="space-y-3">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><Ticket size={18} className="text-forest-600" /> Liens d&apos;invitation par formation</h2>
        {sessions.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucune session planifiée. Créez une session depuis « Gestion ».</p></Card>
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => (
              <Card key={s.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-bold text-forest-900">{s.titre}</h3>
                  <Badge ton="neutre">{libelleFormat(s.format)}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-ink-700/55"><CalendarClock size={12} /> {new Date(s.dateDebut).toLocaleDateString("fr-FR")}</span>
                </div>
                {s.invitations.length > 0 && (
                  <div className="space-y-2">
                    {s.invitations.map((inv) => (
                      <LigneInvitation key={inv.id} inv={{ ...inv, expiration: inv.expiration ? inv.expiration.toISOString() : null }} />
                    ))}
                  </div>
                )}
                <div className="rounded-xl bg-cream-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/50">Nouveau lien</p>
                  <FormNouvelleInvitation sessionId={s.id} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
