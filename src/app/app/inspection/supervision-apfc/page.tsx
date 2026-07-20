import type { Metadata } from "next";
import { Radar, Network, Users, Layers } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard, Badge } from "@/components/app/ui";

export const metadata: Metadata = { title: "Supervision APFC" };
export const dynamic = "force-dynamic";

export default async function SupervisionApfcPage() {
  const u = await requireRole([
    "admin",
    "superviseur_international",
    "super_admin_apfc",
    "representant_pays",
    "apfc_admin",
    "drena",
    "chef_antenne",
    "conseiller_pedagogique",
  ]);

  // Portée « antenne » (chef_antenne / conseiller_pedagogique) et « apfc » (apfc_admin)
  // partagent le même champ Utilisateur.apfcId ; drena est borné à sa région.
  const where =
    u.roleReel === "apfc_admin" || u.roleReel === "chef_antenne" || u.roleReel === "conseiller_pedagogique"
      ? { id: u.portee.apfcId ?? "__aucune__" }
      : u.roleReel === "drena"
        ? { regionId: u.portee.regionId ?? "__aucune__" }
        : {};

  let lignes: {
    id: string;
    nom: string;
    region: string;
    cohortesActives: number;
    cohortesCloturees: number;
    apprenants: number;
    chefAntenne: boolean;
    conseillers: number;
  }[] = [];
  let erreur = false;

  try {
    const apfcs = await prisma.apfc.findMany({
      where,
      orderBy: { nom: "asc" },
      select: {
        id: true,
        nom: true,
        region: { select: { nom: true } },
        cohortes: { select: { statut: true, _count: { select: { apprenants: true } } } },
        utilisateurs: { select: { roleActif: { select: { nomTechnique: true } } } },
      },
    });

    lignes = apfcs.map((a) => ({
      id: a.id,
      nom: a.nom,
      region: a.region?.nom ?? "—",
      cohortesActives: a.cohortes.filter((c) => c.statut === "active").length,
      cohortesCloturees: a.cohortes.filter((c) => c.statut === "cloturee").length,
      apprenants: a.cohortes.reduce((s, c) => s + c._count.apprenants, 0),
      chefAntenne: a.utilisateurs.some((x) => x.roleActif.nomTechnique === "chef_antenne"),
      conseillers: a.utilisateurs.filter((x) => x.roleActif.nomTechnique === "conseiller_pedagogique").length,
    }));
  } catch (e) {
    console.error("[supervision-apfc] chargement :", e);
    erreur = true;
  }

  const kpis = {
    antennes: lignes.length,
    cohortesActives: lignes.reduce((s, l) => s + l.cohortesActives, 0),
    sansChefAntenne: lignes.filter((l) => !l.chefAntenne).length,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Supervision APFC"
        description="Vue d'ensemble du réseau des antennes pédagogiques : cohortes en cours et encadrement."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger la supervision des APFC.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Antennes (APFC)" valeur={kpis.antennes} icone={<Network size={22} />} />
            <StatCard libelle="Cohortes actives" valeur={kpis.cohortesActives} icone={<Layers size={22} />} ton="gold" />
            <StatCard libelle="Sans chef d'antenne" valeur={kpis.sansChefAntenne} icone={<Radar size={22} />} />
          </div>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Par antenne</h2>
            {lignes.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucune APFC dans votre périmètre.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                      <th className="py-2.5 pr-3 font-semibold">Antenne</th>
                      <th className="px-2 py-2.5 font-semibold">Région</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Cohortes actives</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Clôturées</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Apprenants</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Encadrement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.id} className="border-b border-cream-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-forest-900">{l.nom}</td>
                        <td className="px-2 py-2.5 text-ink-700/70">{l.region}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/80">{l.cohortesActives}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/70">{l.cohortesCloturees}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.apprenants}</td>
                        <td className="px-2 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {l.chefAntenne ? (
                              <Badge ton="succes">Chef d&apos;antenne</Badge>
                            ) : (
                              <Badge ton="attente">Sans chef</Badge>
                            )}
                            {l.conseillers > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-ink-700/60">
                                <Users size={13} /> {l.conseillers}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
