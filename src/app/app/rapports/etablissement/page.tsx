import type { Metadata } from "next";
import { School, Users, GraduationCap, DoorOpen, CalendarCheck, Stamp } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { etablissementsOperationnels } from "@/lib/etablissements/operationnels";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";

export const metadata: Metadata = { title: "Rapport d'établissement" };
export const dynamic = "force-dynamic";

const BASE = "/app/rapports/etablissement";
const ROLES_CHOIX = ["admin", "drena"];

export default async function RapportEtablissementPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const u = await requireRole(["admin", "chef_etablissement", "etablissements_admin", "drena"]);
  const sp = await searchParams;
  const peutChoisir = ROLES_CHOIX.includes(u.roleReel);

  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  if (peutChoisir) {
    etablissements = await etablissementsOperationnels();
    etabId = sp.etab && etablissements.some((e) => e.id === sp.etab) ? sp.etab : null;
  } else {
    etabId = u.portee.etablissementId;
  }

  if (!etabId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader titre="Rapport d'établissement" description="Choisissez un établissement." />
        {peutChoisir ? (
          <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
        ) : (
          <Card><p className="text-sm text-ink-700/70">Aucun établissement rattaché à votre périmètre.</p></Card>
        )}
      </div>
    );
  }

  const [etab, classes, eleves, salles, creneaux, affs, presGroupes, notes, visites] = await Promise.all([
    prisma.etablissement.findUnique({ where: { id: etabId }, select: { nom: true, ville: true, region: { select: { nom: true } } } }),
    prisma.classe.count({ where: { etablissementId: etabId } }),
    prisma.inscription.count({ where: { classe: { etablissementId: etabId } } }),
    prisma.salle.count({ where: { etablissementId: etabId } }),
    prisma.creneau.count({ where: { etablissementId: etabId } }),
    prisma.affectationEnseignant.findMany({ where: { classe: { etablissementId: etabId } }, select: { enseignantId: true } }),
    prisma.presence.groupBy({ by: ["statut"], where: { appel: { classe: { etablissementId: etabId } } }, _count: { _all: true } }),
    prisma.note.findMany({ where: { classe: { etablissementId: etabId } }, select: { valeur: true, sur: true } }),
    prisma.visite.count({ where: { etablissementId: etabId } }),
  ]);

  const enseignants = new Set(affs.map((a) => a.enseignantId)).size;
  const totalPres = presGroupes.reduce((s, g) => s + g._count._all, 0);
  const presents = presGroupes.find((g) => g.statut === "present")?._count._all ?? 0;
  const tauxPresence = totalPres > 0 ? Math.round((presents / totalPres) * 100) : null;
  const notesValides = notes.filter((n) => n.sur > 0);
  const moyenne = notesValides.length > 0
    ? Math.round((notesValides.reduce((s, n) => s + (n.valeur / n.sur) * 20, 0) / notesValides.length) * 10) / 10
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre={`Rapport — ${etab?.nom ?? "Établissement"}`}
        description={[etab?.ville, etab?.region?.nom].filter(Boolean).join(" · ") || "Synthèse de l'établissement."}
      />
      {peutChoisir && <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard libelle="Classes" valeur={classes} icone={<School size={22} />} />
        <StatCard libelle="Élèves inscrits" valeur={eleves} icone={<Users size={22} />} ton="gold" />
        <StatCard libelle="Enseignants" valeur={enseignants} icone={<GraduationCap size={22} />} />
        <StatCard libelle="Salles" valeur={salles} icone={<DoorOpen size={22} />} />
        <StatCard libelle="Créneaux planifiés" valeur={creneaux} icone={<CalendarCheck size={22} />} ton="gold" />
        <StatCard libelle="Visites d'inspection" valeur={visites} icone={<Stamp size={22} />} />
      </div>

      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Indicateurs pédagogiques</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-cream-200 bg-cream-50/50 p-4">
            <dt className="text-xs text-ink-700/60">Moyenne générale</dt>
            <dd className="font-display text-2xl font-bold text-forest-900">{moyenne != null ? `${moyenne}/20` : "—"}</dd>
          </div>
          <div className="rounded-xl border border-cream-200 bg-cream-50/50 p-4">
            <dt className="text-xs text-ink-700/60">Taux de présence</dt>
            <dd className="font-display text-2xl font-bold text-forest-900">{tauxPresence != null ? `${tauxPresence}%` : "—"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
