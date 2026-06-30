import type { Metadata } from "next";
import { ListChecks, CheckCircle2, Clock } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { ChartBarVertical } from "../etablissement/charts";

export const metadata: Metadata = { title: "Suivi des recommandations" };
export const dynamic = "force-dynamic";

export default async function SuiviRecommandationsPage() {
  const u = await requireRole(["admin", "inspecteur", "drena", "conseiller_pedagogique"]);

  // Périmètre : admin = tout ; autres = visites des établissements de leur région
  // (ou leurs propres visites pour un inspecteur).
  let where: object = {};
  if (u.roleReel === "inspecteur") where = { visite: { inspecteurId: u.id } };
  else if (u.roleReel === "drena" || u.roleReel === "conseiller_pedagogique") {
    where = { visite: { etablissement: { regionId: u.portee.regionId ?? "__aucune__" } } };
  }

  let erreur = false;
  const parStatut = { ouverte: 0, en_cours: 0, traitee: 0 };
  const parPriorite = { basse: 0, moyenne: 0, haute: 0 };
  let total = 0;

  try {
    const recos = await prisma.recommandation.findMany({ where, select: { statut: true, priorite: true } });
    total = recos.length;
    for (const r of recos) {
      parStatut[r.statut] += 1;
      parPriorite[r.priorite] += 1;
    }
  } catch {
    erreur = true;
  }

  const traitees = parStatut.traitee;
  const tauxTraitement = total > 0 ? Math.round((traitees / total) * 100) : 0;

  const graphStatut = [
    { label: "Ouvertes", valeur: parStatut.ouverte },
    { label: "En cours", valeur: parStatut.en_cours },
    { label: "Traitées", valeur: parStatut.traitee },
  ];
  const graphPriorite = [
    { label: "Basse", valeur: parPriorite.basse },
    { label: "Moyenne", valeur: parPriorite.moyenne },
    { label: "Haute", valeur: parPriorite.haute },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Suivi des recommandations"
        description="État de traitement des recommandations issues des visites d'inspection."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger le suivi.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Recommandations" valeur={total} icone={<ListChecks size={22} />} />
            <StatCard libelle="Traitées" valeur={traitees} icone={<CheckCircle2 size={22} />} ton="gold" />
            <StatCard libelle="Taux de traitement" valeur={`${tauxTraitement}%`} icone={<Clock size={22} />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-display text-base font-bold text-forest-900">Par statut</h2>
              <ChartBarVertical data={graphStatut} nomSerie="Recommandations" couleur="#246a48" vide="Aucune recommandation." />
            </Card>
            <Card>
              <h2 className="mb-4 font-display text-base font-bold text-forest-900">Par priorité</h2>
              <ChartBarVertical data={graphPriorite} nomSerie="Recommandations" couleur="#c9a227" vide="Aucune recommandation." />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
