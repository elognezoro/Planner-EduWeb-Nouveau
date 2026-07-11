import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Award, BookOpen } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_IDS, ROLES } from "@/lib/rbac/roles";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { classeBadge } from "@/lib/lms";
import { FormParcours, BoutonPublierParcours, FormEtape, BoutonsOrdreEtape, SupprimerEtapeBtn } from "../parcours-formulaires";

export const metadata: Metadata = { title: "Édition du parcours — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

export default async function EditionParcoursPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;

  const [parcours, badges, cours] = await Promise.all([
    prisma.parcours.findUnique({
      where: { id },
      select: {
        id: true, titre: true, description: true, niveau: true, publicCible: true, statut: true, badgeId: true,
        badge: { select: { nom: true, couleur: true } },
        etapes: { orderBy: { ordre: "asc" }, select: { id: true, coursId: true, cours: { select: { titre: true, statut: true, _count: { select: { modules: true } } } } } },
      },
    }),
    prisma.badge.findMany({ orderBy: { creeLe: "desc" }, select: { id: true, nom: true } }),
    prisma.cours.findMany({ orderBy: [{ statut: "asc" }, { titre: "asc" }], select: { id: true, titre: true } }),
  ]);
  if (!parcours) redirect(`${BASE}/gestion/parcours`);

  const dejaDans = new Set(parcours.etapes.map((e) => e.coursId));
  const coursDispo = cours.filter((c) => !dejaDans.has(c.id));
  const opts = { roles: ROLE_IDS.map((rid) => ({ id: rid, libelle: ROLES[rid].libelle })), badges };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/gestion/parcours`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Parcours & badges</Link>
      <PageHeader
        titre={parcours.titre}
        description={parcours.description ?? undefined}
        action={<div className="flex items-center gap-2"><FormParcours opts={opts} parcours={parcours} /><BoutonPublierParcours id={parcours.id} publie={parcours.statut === "publie"} /></div>}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge ton={parcours.statut === "publie" ? "succes" : "attente"}>{parcours.statut === "publie" ? "Publié" : "Brouillon"}</Badge>
        {parcours.badge && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${classeBadge(parcours.badge.couleur)}`}><Award size={12} /> {parcours.badge.nom}</span>}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">Cours du parcours ({parcours.etapes.length})</h2>
        <Card><FormEtape parcoursId={parcours.id} coursDispo={coursDispo} /></Card>

        {parcours.etapes.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucun cours. Ajoutez-en pour composer le parcours ; l&apos;ordre définit la progression attendue.</p></Card>
        ) : (
          <div className="space-y-2">
            {parcours.etapes.map((e, i) => (
              <Card key={e.id} className="flex items-center gap-3 py-3">
                <BoutonsOrdreEtape id={e.id} />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-700"><BookOpen size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-forest-900"><span className="text-ink-700/40">{i + 1}.</span> {e.cours.titre}</p>
                  <p className="text-xs text-ink-700/55">{e.cours._count.modules} leçon(s) · {e.cours.statut === "publie" ? "publié" : "brouillon"}</p>
                </div>
                {e.cours.statut !== "publie" && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-gold-800">Cours non publié</span>}
                <SupprimerEtapeBtn id={e.id} />
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
