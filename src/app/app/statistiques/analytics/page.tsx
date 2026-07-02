import type { Metadata } from "next";
import { School, Users, GraduationCap, CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { ChartBarVertical, ChartAssiduite } from "../etablissement/charts";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const u = await requireRole(["admin", "drena", "chef_etablissement"]);

  let erreur = false;
  let kpis = { etablissements: 0, classes: 0, eleves: 0, enseignants: 0, creneaux: 0 };
  let parEtab: { label: string; valeur: number }[] = [];
  let assiduite: { statut: string; valeur: number }[] = [];
  let titreContexte = "";

  try {
    // Périmètre des établissements.
    const whereEtab =
      u.roleReel === "drena"
        ? { regionId: u.portee.regionId ?? "__aucune__" }
        : u.roleReel === "chef_etablissement"
          ? { id: u.portee.etablissementId ?? "__aucune__" }
          : {};
    // Seuls les établissements réellement actifs (avec classes) entrent dans l'analyse —
    // le répertoire national importé (40 000+ entrées) n'y contribue pas.
    const etabs = await prisma.etablissement.findMany({
      where: { ...whereEtab, classes: { some: {} } },
      select: { id: true, nom: true },
    });
    const ids = etabs.map((e) => e.id);
    titreContexte = u.roleReel === "drena" ? "votre région" : u.roleReel === "chef_etablissement" ? "votre établissement" : "tout le réseau";

    const [classes, inscriptions, affs, creneaux, presGroupes, inscParClasse, classesEtab] = await Promise.all([
      prisma.classe.count({ where: { etablissementId: { in: ids } } }),
      prisma.inscription.count({ where: { classe: { etablissementId: { in: ids } } } }),
      prisma.affectationEnseignant.findMany({ where: { classe: { etablissementId: { in: ids } } }, select: { enseignantId: true } }),
      prisma.creneau.count({ where: { etablissementId: { in: ids } } }),
      prisma.presence.groupBy({ by: ["statut"], where: { appel: { classe: { etablissementId: { in: ids } } } }, _count: { _all: true } }),
      prisma.inscription.groupBy({ by: ["classeId"], where: { classe: { etablissementId: { in: ids } } }, _count: { _all: true } }),
      prisma.classe.findMany({ where: { etablissementId: { in: ids } }, select: { id: true, etablissementId: true } }),
    ]);

    const enseignants = new Set(affs.map((a) => a.enseignantId)).size;
    kpis = { etablissements: etabs.length, classes, eleves: inscriptions, enseignants, creneaux };

    // Élèves par établissement.
    const classeToEtab = new Map(classesEtab.map((c) => [c.id, c.etablissementId]));
    const elevesParEtab = new Map<string, number>();
    for (const g of inscParClasse) {
      const etab = classeToEtab.get(g.classeId);
      if (etab) elevesParEtab.set(etab, (elevesParEtab.get(etab) ?? 0) + g._count._all);
    }
    parEtab = etabs
      .map((e) => ({ label: e.nom, valeur: elevesParEtab.get(e.id) ?? 0 }))
      .sort((a, b) => b.valeur - a.valeur)
      .slice(0, 10);

    const cpt = (s: string) => presGroupes.find((g) => g.statut === s)?._count._all ?? 0;
    assiduite = [
      { statut: "Présences", valeur: cpt("present") },
      { statut: "Absences", valeur: cpt("absent") },
      { statut: "Retards", valeur: cpt("retard") },
      { statut: "Excusés", valeur: cpt("excuse") },
    ];
  } catch (e) {
    console.error("[analytics] :", e);
    erreur = true;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader titre="Analytics" description={`Vue d'ensemble — ${titreContexte || "réseau"}.`} />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les analytics.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard libelle="Établissements" valeur={kpis.etablissements} icone={<School size={22} />} />
            <StatCard libelle="Classes" valeur={kpis.classes} icone={<GraduationCap size={22} />} ton="gold" />
            <StatCard libelle="Élèves" valeur={kpis.eleves} icone={<Users size={22} />} />
            <StatCard libelle="Enseignants" valeur={kpis.enseignants} icone={<Users size={22} />} ton="gold" />
            <StatCard libelle="Créneaux" valeur={kpis.creneaux} icone={<CalendarDays size={22} />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-display text-base font-bold text-forest-900">Élèves par établissement</h2>
              <ChartBarVertical data={parEtab} nomSerie="Élèves" vide="Aucun effectif inscrit." />
            </Card>
            <Card>
              <h2 className="mb-4 font-display text-base font-bold text-forest-900">Assiduité globale</h2>
              <ChartAssiduite data={assiduite} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
