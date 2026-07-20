import type { Metadata } from "next";
import { Network, Stamp, ListChecks } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleApfc, paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { StatCard } from "@/components/app/ui";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { EnTeteOfficielApfc, PiedSignatureApfc, type ApfcEnTeteInfo, type ApfcSignatureInfo } from "@/components/app/en-tete-officiel-apfc";
import { BoutonImprimerApfc } from "@/components/app/bouton-imprimer-apfc";

export const metadata: Metadata = { title: "Rapports d'antennes" };
export const dynamic = "force-dynamic";

const ROLES_ANTENNE = ["apfc_admin", "chef_antenne", "conseiller_pedagogique"];

export default async function RapportsAntennesInspectionPage() {
  const u = await requireRole(["admin", "drena", "chef_antenne", "conseiller_pedagogique", "apfc_admin"]);
  const terme = await libelleApfc(await paysConsulte());
  const T = (s: string) => appliquerTermeApfc(s, terme);

  // Cloisonnement par périmètre : les rôles d'antenne ne voient que les visites des
  // établissements sous leur compétence territoriale (CouvertureApfc). Tant que la couverture
  // n'est pas renseignée pour l'antenne, la page est VIDE (fail-closed, pas de repli national :
  // un repli non filtré recréerait la fuite que ce cloisonnement corrige).
  const estRoleAntenne = ROLES_ANTENNE.includes(u.roleReel);
  const where = estRoleAntenne
    ? { etablissement: { couvertureApfc: { apfcId: u.portee.apfcId ?? "__aucune__" } } }
    : u.roleReel === "drena"
      ? { etablissement: { regionId: u.portee.regionId ?? "__aucune__" } }
      : {};
  const visites = await prisma.visite.findMany({
    where,
    select: {
      statut: true,
      noteGlobale: true,
      etablissement: { select: { nom: true } },
      recommandations: { select: { statut: true } },
    },
  });

  const parEtab = new Map<string, { visites: number; realisees: number; recos: number; recosOuvertes: number; sommeNote: number; nNote: number }>();
  for (const v of visites) {
    const nom = v.etablissement.nom;
    const o = parEtab.get(nom) ?? { visites: 0, realisees: 0, recos: 0, recosOuvertes: 0, sommeNote: 0, nNote: 0 };
    o.visites += 1;
    if (v.statut === "realisee") o.realisees += 1;
    o.recos += v.recommandations.length;
    o.recosOuvertes += v.recommandations.filter((r) => r.statut !== "traitee").length;
    if (v.noteGlobale != null) {
      o.sommeNote += v.noteGlobale;
      o.nNote += 1;
    }
    parEtab.set(nom, o);
  }
  const lignes = [...parEtab.entries()]
    .map(([nom, o]) => ({ nom, ...o, moyenne: o.nNote > 0 ? Math.round((o.sommeNote / o.nNote) * 10) / 10 : null }))
    .sort((a, b) => b.visites - a.visites);

  const kpis = {
    etablissements: lignes.length,
    visites: visites.length,
    recosOuvertes: lignes.reduce((s, l) => s + l.recosOuvertes, 0),
  };

  // Distinguer « couverture territoriale non renseignée » (nouvelle fonctionnalité, encore
  // vide pour beaucoup d'antennes) de « aucune visite dans le périmètre ».
  const couvertureVide =
    estRoleAntenne &&
    visites.length === 0 &&
    (await prisma.couvertureApfc.count({ where: { apfcId: u.portee.apfcId ?? "__aucune__" } })) === 0;

  // Ce rapport n'est pas rattaché à une Apfc en base (il agrège les visites d'inspection par
  // établissement) : pour un utilisateur d'antenne (apfc_admin/chef_antenne/conseiller_pedagogique),
  // on charge SA propre APFC séparément, uniquement pour les visuels d'en-tête/pied officiels.
  let antenneEntete: ApfcEnTeteInfo | null = null;
  let antenneSignature: ApfcSignatureInfo | null = null;
  if (estRoleAntenne && u.portee.apfcId) {
    try {
      const a = await prisma.apfc.findUnique({
        where: { id: u.portee.apfcId },
        select: {
          nom: true,
          region: { select: { nom: true, pays: true } },
          logoUrl: true,
          cachetUrl: true,
          signatureUrl: true,
          chefAntenneNom: true,
          chefAntennePrenoms: true,
        },
      });
      if (a) {
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
      console.error("[rapports-antennes] chargement APFC :", e);
    }
  }

  // Document agrégé (multi-antennes/multi-établissements) : en-tête générique du pays consulté,
  // SANS logo/cachet/signature d'une antenne particulière.
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
          <EnTeteOfficielApfc apfc={antenneEntete} titre="Rapports d'antennes" sousTitre="Suivi de l'inspection par établissement" terme={terme} />
        ) : (
          <EnTeteOfficielDoc
            etab={{ nom: T("Réseau national des antennes (APFC)"), pays: paysAgrege, ministere: null, sloganBulletin: null, anneeScolaire: null, emblemeUrl: null }}
            titre="Rapports d'antennes"
            sousTitre="Suivi de l'inspection par établissement"
          />
        )}

        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard libelle="Établissements visités" valeur={kpis.etablissements} icone={<Network size={22} />} />
          <StatCard libelle="Visites" valeur={kpis.visites} icone={<Stamp size={22} />} ton="gold" />
          <StatCard libelle="Recommandations à suivre" valeur={kpis.recosOuvertes} icone={<ListChecks size={22} />} />
        </div>

        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Par établissement</h2>
        {lignes.length === 0 ? (
          <p className="text-sm text-ink-700/60">
            {couvertureVide
              ? T(
                  "Aucun établissement n'est encore rattaché à votre antenne : renseignez le bloc « Établissements couverts » de la fiche APFC pour alimenter ce rapport.",
                )
              : "Aucune visite enregistrée."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                  <th className="py-2.5 pr-3 font-semibold">Établissement</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Visites</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Réalisées</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Reco. à suivre</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Moy. /20</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.nom} className="border-b border-cream-100 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-forest-900">{l.nom}</td>
                    <td className="px-2 py-2.5 text-right text-ink-700/80">{l.visites}</td>
                    <td className="px-2 py-2.5 text-right text-ink-700/70">{l.realisees}</td>
                    <td className="px-2 py-2.5 text-right text-gold-700">{l.recosOuvertes}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.moyenne ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {antenneSignature && <PiedSignatureApfc apfc={antenneSignature} terme={terme} />}
      </div>
    </div>
  );
}
