import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { DemandeRdvForm, ActionsRdv } from "./components";

export const metadata: Metadata = { title: "Rendez-vous" };
export const dynamic = "force-dynamic";

const STATUT: Record<string, { texte: string; ton: "attente" | "succes" | "refus" | "neutre" }> = {
  demande: { texte: "En attente", ton: "attente" },
  confirme: { texte: "Confirmé", ton: "succes" },
  refuse: { texte: "Refusé", ton: "refus" },
  annule: { texte: "Annulé", ton: "neutre" },
};

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}
function dateHeure(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(d);
}

export default async function RendezVousPage() {
  const u = await requireRole([
    "admin",
    "chef_etablissement",
    "adjoint_chef_etablissement",
    "inspecteur_orientation",
    "enseignant",
    "educateur",
    "parent",
  ]);

  const [demandes, recus] = await Promise.all([
    prisma.rendezVous.findMany({
      where: { demandeurId: u.id },
      orderBy: { date: "desc" },
      take: 20,
      include: { destinataire: { select: { prenoms: true, nom: true, email: true } } },
    }),
    prisma.rendezVous.findMany({
      where: { destinataireId: u.id },
      orderBy: { date: "desc" },
      take: 20,
      include: { demandeur: { select: { prenoms: true, nom: true, email: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader titre="Rendez-vous" description="Prenez et gérez vos rendez-vous avec le personnel et les familles." />

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <CalendarClock size={18} /> Nouvelle demande
        </h2>
        <DemandeRdvForm />
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Demandes reçues</h2>
        {recus.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune demande reçue.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {recus.map((r) => {
              const st = STATUT[r.statut] ?? STATUT.demande;
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-forest-900">{nomComplet(r.demandeur)}</p>
                    <p className="text-xs text-ink-700/65">{r.motif}</p>
                    <p className="mt-0.5 text-xs text-ink-700/50">{dateHeure(r.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge ton={st.ton}>{st.texte}</Badge>
                    {r.statut === "demande" && <ActionsRdv id={r.id} role="destinataire" />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Mes demandes</h2>
        {demandes.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune demande envoyée.</p>
        ) : (
          <ul className="divide-y divide-cream-100">
            {demandes.map((r) => {
              const st = STATUT[r.statut] ?? STATUT.demande;
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-forest-900">{nomComplet(r.destinataire)}</p>
                    <p className="text-xs text-ink-700/65">{r.motif}</p>
                    <p className="mt-0.5 text-xs text-ink-700/50">{dateHeure(r.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge ton={st.ton}>{st.texte}</Badge>
                    {(r.statut === "demande" || r.statut === "confirme") && <ActionsRdv id={r.id} role="demandeur" />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
