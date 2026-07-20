import type { Metadata } from "next";
import { Radar, Network, Users, Layers, Building2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleApfc, termeApfcCourant, paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { StatCard, Badge } from "@/components/app/ui";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { EnTeteOfficielApfc, PiedSignatureApfc, type ApfcEnTeteInfo, type ApfcSignatureInfo } from "@/components/app/en-tete-officiel-apfc";
import { BoutonImprimerApfc } from "@/components/app/bouton-imprimer-apfc";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTermeApfc("Supervision APFC", await termeApfcCourant()) };
}
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
  const pays = await paysConsulte();
  const terme = await libelleApfc(pays);
  const T = (s: string) => appliquerTermeApfc(s, terme);

  // Portée « antenne » (chef_antenne / conseiller_pedagogique) et « apfc » (apfc_admin)
  // partagent le même champ Utilisateur.apfcId ; drena est borné à sa région. Pour les périmètres
  // « global » / « pays » (admin, superviseur international, super_admin_apfc, représentant-pays),
  // on croise EXPLICITEMENT avec le pays consulté (region.pays) — cloisonnement par pays (consigne
  // client) : sans ce filtre, un périmètre global verrait les antennes de TOUS les pays, quel que
  // soit le sélecteur de la barre du haut.
  const estRoleAntenne = u.roleReel === "apfc_admin" || u.roleReel === "chef_antenne" || u.roleReel === "conseiller_pedagogique";
  const where = estRoleAntenne
    ? { id: u.portee.apfcId ?? "__aucune__" }
    : u.roleReel === "drena"
      ? { regionId: u.portee.regionId ?? "__aucune__" }
      : { region: { pays } };

  let lignes: {
    id: string;
    nom: string;
    region: string;
    cohortesActives: number;
    cohortesCloturees: number;
    apprenants: number;
    chefAntenne: boolean;
    conseillers: number;
    etablissementsCouverts: number;
  }[] = [];
  let erreur = false;
  // Document d'UNE antenne précise (portée apfc_admin/chef_antenne/conseiller_pedagogique, une
  // seule APFC dans le périmètre) : visuels propres à afficher en en-tête/pied officiels. `null`
  // pour un document agrégé multi-antennes (admin, DRENA, superviseur…) : voir en bas de fichier.
  let antenneEntete: ApfcEnTeteInfo | null = null;
  let antenneSignature: ApfcSignatureInfo | null = null;

  try {
    const apfcs = await prisma.apfc.findMany({
      where,
      orderBy: { nom: "asc" },
      select: {
        id: true,
        nom: true,
        region: { select: { nom: true, pays: true } },
        logoUrl: true,
        cachetUrl: true,
        signatureUrl: true,
        chefAntenneNom: true,
        chefAntennePrenoms: true,
        cohortes: { select: { statut: true, _count: { select: { apprenants: true } } } },
        utilisateurs: { select: { roleActif: { select: { nomTechnique: true } } } },
        _count: { select: { couvertures: true } },
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
      etablissementsCouverts: a._count.couvertures,
    }));

    if (estRoleAntenne && apfcs.length === 1) {
      const a = apfcs[0];
      const pays = await paysEffectifApfc(a.region?.pays ?? null);
      antenneEntete = { nom: a.nom, regionNom: a.region?.nom ?? null, pays, logoUrl: a.logoUrl };
      antenneSignature = {
        chefAntenneNom: a.chefAntenneNom,
        chefAntennePrenoms: a.chefAntennePrenoms,
        cachetUrl: a.cachetUrl,
        signatureUrl: a.signatureUrl,
      };
    }
  } catch (e) {
    console.error("[supervision-apfc] chargement :", e);
    erreur = true;
  }

  const kpis = {
    antennes: lignes.length,
    cohortesActives: lignes.reduce((s, l) => s + l.cohortesActives, 0),
    sansChefAntenne: lignes.filter((l) => !l.chefAntenne).length,
    etablissementsCouverts: lignes.reduce((s, l) => s + l.etablissementsCouverts, 0),
  };

  // Document agrégé (multi-antennes) : en-tête générique du pays consulté, SANS logo/cachet/
  // signature d'une antenne particulière — on ne prête jamais les visuels d'UNE antenne à une
  // vue qui en couvre plusieurs.
  const paysAgrege = await paysEffectifApfc(null);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex justify-end print:hidden">
        <BoutonImprimerApfc />
      </div>

      <div className="apfc-feuille rounded-2xl border border-cream-200 bg-white p-6 shadow-soft sm:p-8">
        <style
          dangerouslySetInnerHTML={{
            __html: `@media print { @page { size: A4 portrait; margin: 12mm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .apfc-feuille { border: 0 !important; box-shadow: none !important; padding: 0 !important; } }`,
          }}
        />

        {antenneEntete ? (
          <EnTeteOfficielApfc
            apfc={antenneEntete}
            titre={T("Supervision APFC")}
            sousTitre="Vue d'ensemble : cohortes en cours et encadrement"
            terme={terme}
          />
        ) : (
          <EnTeteOfficielDoc
            etab={{ nom: T("Réseau national des antennes (APFC)"), pays: paysAgrege, ministere: null, sloganBulletin: null, anneeScolaire: null, emblemeUrl: null }}
            titre={T("Supervision APFC")}
            sousTitre="Vue d'ensemble du réseau des antennes : cohortes en cours et encadrement"
          />
        )}

        {erreur ? (
          <p className="text-sm text-ink-700/70">{T("Impossible de charger la supervision des APFC.")}</p>
        ) : (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard libelle={T("Antennes (APFC)")} valeur={kpis.antennes} icone={<Network size={22} />} />
              <StatCard libelle="Cohortes actives" valeur={kpis.cohortesActives} icone={<Layers size={22} />} ton="gold" />
              <StatCard libelle="Sans chef d'antenne" valeur={kpis.sansChefAntenne} icone={<Radar size={22} />} />
              <StatCard libelle="Établissements couverts" valeur={kpis.etablissementsCouverts} icone={<Building2 size={22} />} ton="gold" />
            </div>

            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Par antenne</h2>
            {lignes.length === 0 ? (
              <p className="text-sm text-ink-700/60">{T("Aucune APFC dans votre périmètre.")}</p>
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
                      <th className="px-2 py-2.5 text-right font-semibold">Étab. couverts</th>
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
                        <td className="px-2 py-2.5 text-right text-ink-700/70">{l.etablissementsCouverts}</td>
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

            {antenneSignature && <PiedSignatureApfc apfc={antenneSignature} terme={terme} />}
          </>
        )}
      </div>
    </div>
  );
}
