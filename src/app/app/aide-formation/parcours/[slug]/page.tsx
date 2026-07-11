import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Award, CheckCircle2, Circle, ArrowRight, BookOpen } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { classeBadge } from "@/lib/lms";
import { BoutonInscriptionParcours } from "../../parcours-boutons";

export const metadata: Metadata = { title: "Parcours — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

export default async function ParcoursPage({ params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;
  const estAdmin = u.roleActif === "admin";

  const parcours = await prisma.parcours.findUnique({
    where: { slug },
    select: {
      id: true, titre: true, description: true, statut: true, badgeId: true,
      badge: { select: { nom: true, description: true, couleur: true } },
      etapes: { orderBy: { ordre: "asc" }, select: { id: true, cours: { select: { id: true, slug: true, titre: true, description: true, _count: { select: { modules: true } } } } } },
    },
  });
  if (!parcours) redirect(`${BASE}/parcours`);
  if (parcours.statut !== "publie" && !estAdmin) redirect(`${BASE}/parcours`);

  const coursIds = parcours.etapes.map((e) => e.cours.id);
  const [inscription, coursTermines, badgeObtenu] = await Promise.all([
    prisma.inscriptionParcours.findUnique({ where: { utilisateurId_parcoursId: { utilisateurId: u.id, parcoursId: parcours.id } }, select: { progressionPct: true, statut: true } }),
    coursIds.length ? prisma.inscriptionCours.findMany({ where: { utilisateurId: u.id, coursId: { in: coursIds }, statut: "termine" }, select: { coursId: true } }) : Promise.resolve([]),
    parcours.badgeId ? prisma.badgeObtenu.findUnique({ where: { utilisateurId_badgeId: { utilisateurId: u.id, badgeId: parcours.badgeId } }, select: { id: true } }) : Promise.resolve(null),
  ]);

  const termines = new Set(coursTermines.map((c) => c.coursId));
  const inscrit = !!inscription;
  const total = parcours.etapes.length;
  const faits = parcours.etapes.filter((e) => termines.has(e.cours.id)).length;
  // Dérivé en direct (faits/total) pour rester cohérent avec le libellé « x/y » et « Terminé ».
  const pct = total ? Math.round((faits / total) * 100) : 0;
  const acheve = total > 0 && faits >= total;
  const prochain = parcours.etapes.find((e) => !termines.has(e.cours.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/parcours`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Tous les parcours</Link>
      <PageHeader titre={parcours.titre} description={parcours.description ?? undefined} action={<BoutonInscriptionParcours parcoursId={parcours.id} slug={slug} inscrit={inscrit} />} />
      {parcours.statut !== "publie" && <Badge ton="attente">Brouillon — aperçu administrateur</Badge>}

      {/* Badge + progression */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {parcours.badge ? (
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${classeBadge(parcours.badge.couleur)} ${badgeObtenu ? "" : "opacity-40 grayscale"}`}><Award size={24} /></span>
            <div>
              <p className="font-display text-sm font-bold text-forest-900">{parcours.badge.nom}</p>
              <p className="text-xs text-ink-700/60">{badgeObtenu ? "Badge obtenu 🎉" : "À débloquer en terminant le parcours"}</p>
            </div>
          </div>
        ) : <div className="text-sm text-ink-700/55">Parcours de {total} cours</div>}
        <div className="min-w-[180px] flex-1 sm:max-w-xs">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-ink-700/60">{faits}/{total} cours</span>
            <span className="font-semibold text-forest-800">{acheve ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> Terminé</span> : `${pct}%`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cream-200"><div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
      </Card>

      {/* Cours */}
      {parcours.etapes.length === 0 ? (
        <Card><p className="text-sm text-ink-700/70">Ce parcours n&apos;a pas encore de cours.</p></Card>
      ) : (
        <div className="space-y-2">
          {parcours.etapes.map((e, i) => {
            const fait = termines.has(e.cours.id);
            const estProchain = prochain?.id === e.id;
            return (
              <Link key={e.id} href={`${BASE}/cours/${e.cours.slug}`}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-soft transition-colors hover:border-forest-200 ${estProchain ? "border-forest-300 ring-1 ring-forest-200" : "border-cream-200"}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${fait ? "bg-forest-100 text-forest-700" : "bg-cream-100 text-ink-700/50"}`}>
                  {fait ? <CheckCircle2 size={18} /> : <Circle size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-forest-900"><span className="text-ink-700/40">{i + 1}.</span> {e.cours.titre}</p>
                  <p className="flex items-center gap-1 text-xs text-ink-700/55"><BookOpen size={11} /> {e.cours._count.modules} leçon(s){fait ? " · terminé" : ""}</p>
                </div>
                {estProchain && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest-600 px-3 py-1 text-xs font-semibold text-white">Continuer <ArrowRight size={13} /></span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
