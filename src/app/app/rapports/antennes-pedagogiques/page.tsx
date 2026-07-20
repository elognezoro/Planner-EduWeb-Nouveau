import type { Metadata } from "next";
import { Network, Users, BookMarked } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleApfc, termeApfcCourant, paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { StatCard } from "@/components/app/ui";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { EnTeteOfficielApfc, PiedSignatureApfc, type ApfcEnTeteInfo, type ApfcSignatureInfo } from "@/components/app/en-tete-officiel-apfc";
import { BoutonImprimerApfc } from "@/components/app/bouton-imprimer-apfc";

export async function generateMetadata(): Promise<Metadata> {
  return { title: appliquerTermeApfc("Rapports d'antennes pédagogiques", await termeApfcCourant()) };
}
export const dynamic = "force-dynamic";

export default async function RapportsAntennesPage() {
  const u = await requireRole(["admin", "drena", "chef_antenne", "apfc_admin"]);
  const terme = await libelleApfc(await paysConsulte());
  const T = (s: string) => appliquerTermeApfc(s, terme);

  // Portée « antenne » : apfc_admin ET chef_antenne partagent le même champ Utilisateur.apfcId ;
  // drena est borné aux antennes de SA région (même cloisonnement que supervision-apfc).
  const estRoleAntenne = u.roleReel === "apfc_admin" || u.roleReel === "chef_antenne";
  const where = estRoleAntenne
    ? { id: u.portee.apfcId ?? "__aucune__" }
    : u.roleReel === "drena"
      ? { regionId: u.portee.regionId ?? "__aucune__" }
      : {};

  let lignes: { id: string; nom: string; region: string; sessions: number; participants: number }[] = [];
  let erreur = false;
  // Document d'UNE antenne précise (apfc_admin/chef_antenne, une seule APFC dans le périmètre) :
  // visuels propres en en-tête/pied officiels. `null` pour un document agrégé (admin, DRENA).
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
        cohortes: { select: { _count: { select: { apprenants: true } } } },
      },
    });

    lignes = apfcs.map((a) => ({
      id: a.id,
      nom: a.nom,
      region: a.region?.nom ?? "—",
      sessions: a.cohortes.length,
      participants: a.cohortes.reduce((s, c) => s + c._count.apprenants, 0),
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
    console.error("[rapports-antennes-pedagogiques] chargement :", e);
    erreur = true;
  }

  const kpis = {
    antennes: lignes.length,
    sessions: lignes.reduce((s, l) => s + l.sessions, 0),
    participants: lignes.reduce((s, l) => s + l.participants, 0),
  };

  // Document agrégé (multi-antennes) : en-tête générique du pays consulté, SANS logo/cachet/
  // signature d'une antenne particulière.
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
            titre={T("Rapports d'antennes pédagogiques")}
            sousTitre="Activité de formation continue"
            terme={terme}
          />
        ) : (
          <EnTeteOfficielDoc
            etab={{ nom: T("Réseau national des antennes (APFC)"), pays: paysAgrege, ministere: null, sloganBulletin: null, anneeScolaire: null, emblemeUrl: null }}
            titre={T("Rapports d'antennes pédagogiques")}
            sousTitre="Activité de formation continue (APFC)"
          />
        )}

        {erreur ? (
          <p className="text-sm text-ink-700/70">Impossible de charger les rapports d&apos;antennes.</p>
        ) : (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-3">
              <StatCard libelle={T("Antennes (APFC)")} valeur={kpis.antennes} icone={<Network size={22} />} />
              <StatCard libelle="Sessions" valeur={kpis.sessions} icone={<BookMarked size={22} />} ton="gold" />
              <StatCard libelle="Participants" valeur={kpis.participants} icone={<Users size={22} />} />
            </div>

            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Détail par antenne</h2>
            {lignes.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucune APFC enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                      <th className="py-2.5 pr-3 font-semibold">Antenne</th>
                      <th className="px-2 py-2.5 font-semibold">Région</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Sessions</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Participants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.id} className="border-b border-cream-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-forest-900">{l.nom}</td>
                        <td className="px-2 py-2.5 text-ink-700/70">{l.region}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/80">{l.sessions}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.participants}</td>
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
