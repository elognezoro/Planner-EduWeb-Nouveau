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

  // Périmètre : admin = tout ; inspecteur = ses propres visites ; drena = sa région ;
  // conseiller_pedagogique = les établissements couverts par SON antenne (CouvertureApfc,
  // fail-closed : page vide tant que la couverture territoriale n'est pas renseignée).
  let where: object = {};
  if (u.roleReel === "inspecteur") where = { visite: { inspecteurId: u.id } };
  else if (u.roleReel === "drena") {
    where = { visite: { etablissement: { regionId: u.portee.regionId ?? "__aucune__" } } };
  } else if (u.roleReel === "conseiller_pedagogique") {
    where = { visite: { etablissement: { couvertureApfc: { apfcId: u.portee.apfcId ?? "__aucune__" } } } };
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

  // `couleur` : téléphone seulement (l'ordinateur garde une couleur par graphique) — statut lisible
  // d'un coup d'œil, priorité « Haute » en rouge.
  const graphStatut = [
    { label: "Ouvertes", valeur: parStatut.ouverte, couleur: "#c9a227" },
    { label: "En cours", valeur: parStatut.en_cours, couleur: "#57a47b" },
    { label: "Traitées", valeur: parStatut.traitee, couleur: "#246a48" },
  ];
  const graphPriorite = [
    { label: "Basse", valeur: parPriorite.basse, couleur: "#8cc4a4" },
    { label: "Moyenne", valeur: parPriorite.moyenne, couleur: "#c9a227" },
    { label: "Haute", valeur: parPriorite.haute, couleur: "#dc2626" },
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
          {/* Téléphone : KPI en 2 colonnes compactes, le dernier en pleine largeur. */}
          <div className="grid gap-4 sm:grid-cols-3 mobile:grid-cols-2 mobile:gap-3 mobile:*:flex-col mobile:*:items-start mobile:*:gap-2 mobile:*:p-4 mobile:*:last:odd:col-span-2 mobile:*:last:odd:flex-row mobile:*:last:odd:items-center mobile:*:last:odd:gap-4">
            <StatCard libelle="Recommandations" valeur={total} icone={<ListChecks size={22} />} />
            <StatCard libelle="Traitées" valeur={traitees} icone={<CheckCircle2 size={22} />} ton="gold" />
            <StatCard libelle="Taux de traitement" valeur={`${tauxTraitement}%`} icone={<Clock size={22} />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-display text-base font-bold text-forest-900">Par statut</h2>
              {/* Téléphone : 3 lignes compactes, ordre conservé, échelle = total des recommandations. */}
              <ChartBarVertical data={graphStatut} nomSerie="Recommandations" couleur="#246a48" vide="Aucune recommandation." ordonne max={total} />
            </Card>
            <Card>
              <h2 className="mb-4 font-display text-base font-bold text-forest-900">Par priorité</h2>
              <ChartBarVertical data={graphPriorite} nomSerie="Recommandations" couleur="#c9a227" vide="Aucune recommandation." ordonne max={total} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
