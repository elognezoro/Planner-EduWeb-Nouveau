import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Route, Award, Layers, Users, Pencil } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_IDS, ROLES } from "@/lib/rbac/roles";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { classeBadge } from "@/lib/lms";
import { FormParcours, BoutonPublierParcours, SupprimerParcoursBtn, FormBadge, SupprimerBadgeBtn } from "./parcours-formulaires";

export const metadata: Metadata = { title: "Parcours & badges — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

export default async function GestionParcoursPage() {
  await requireRole(["admin"]);

  const [parcours, badges] = await Promise.all([
    prisma.parcours.findMany({
      orderBy: [{ statut: "asc" }, { creeLe: "desc" }],
      select: { id: true, titre: true, description: true, niveau: true, publicCible: true, statut: true, badgeId: true, badge: { select: { nom: true, couleur: true } }, _count: { select: { etapes: true, inscriptions: true } } },
    }),
    prisma.badge.findMany({ orderBy: { creeLe: "desc" }, select: { id: true, nom: true, description: true, icone: true, couleur: true, _count: { select: { parcours: true, obtentions: true } } } }),
  ]);

  const opts = { roles: ROLE_IDS.map((id) => ({ id, libelle: ROLES[id].libelle })), badges: badges.map((b) => ({ id: b.id, nom: b.nom })) };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link href={`${BASE}/gestion`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Gestion du contenu</Link>
      <PageHeader titre="Parcours & badges" description="Regroupez des cours en parcours ordonnés ; la complétion d'un parcours décerne un badge." />

      {/* Parcours */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><Route size={18} className="text-forest-600" /> Parcours <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">{parcours.length}</span></h2>
          <FormParcours opts={opts} />
        </div>
        {parcours.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucun parcours. Créez-en un avec « Nouveau parcours ».</p></Card>
        ) : (
          <Card className="divide-y divide-cream-100 p-0">
            {parcours.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-forest-900">{p.titre}</span>
                    <Badge ton={p.statut === "publie" ? "succes" : "attente"}>{p.statut === "publie" ? "Publié" : "Brouillon"}</Badge>
                    {p.badge && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${classeBadge(p.badge.couleur)}`}><Award size={11} /> {p.badge.nom}</span>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-700/55">
                    <span className="inline-flex items-center gap-1"><Layers size={12} /> {p._count.etapes} cours</span>
                    <span className="inline-flex items-center gap-1"><Users size={12} /> {p._count.inscriptions} inscrit(s)</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`${BASE}/gestion/parcours/${p.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-forest-300 bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"><Pencil size={13} /> Cours & fiche</Link>
                  <BoutonPublierParcours id={p.id} publie={p.statut === "publie"} />
                  <SupprimerParcoursBtn id={p.id} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Badges */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-forest-900"><Award size={18} className="text-gold-600" /> Badges <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">{badges.length}</span></h2>
          <FormBadge />
        </div>
        {badges.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucun badge. Créez-en un pour récompenser la complétion d&apos;un parcours.</p></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((b) => (
              <Card key={b.id} className="flex items-start justify-between gap-2 py-4">
                <div className="min-w-0">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${classeBadge(b.couleur)}`}><Award size={13} /> {b.nom}</span>
                  {b.description && <p className="mt-1.5 line-clamp-2 text-xs text-ink-700/60">{b.description}</p>}
                  <p className="mt-1 text-[11px] text-ink-700/45">{b._count.parcours} parcours · {b._count.obtentions} obtenu(s)</p>
                </div>
                <div className="flex shrink-0 items-center">
                  <FormBadge badge={{ id: b.id, nom: b.nom, description: b.description, icone: b.icone, couleur: b.couleur }} />
                  <SupprimerBadgeBtn id={b.id} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
