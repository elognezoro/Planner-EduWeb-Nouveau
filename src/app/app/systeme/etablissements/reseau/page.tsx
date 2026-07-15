import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Church, Download } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { filtreEtablissements } from "@/lib/rbac";
import { PageHeader, Card } from "@/components/app/ui";
import { lignesReseau, moyenneGenerale, tauxPresence } from "@/lib/reseau-catholique/agregats";

export const metadata: Metadata = { title: "Statistiques du réseau" };
export const dynamic = "force-dynamic";

/**
 * Statistiques du réseau catholique (lecture seule) :
 *  - SEDEC : agrégats de SON diocèse + tableau par établissement ;
 *  - SENEC : agrégats nationaux + tableau par diocèse, avec téléchargement du
 *    RAPPORT DE SEDEC (Word, ajustable) pour chaque diocèse — réservé au SENEC.
 */
export default async function StatistiquesReseauPage() {
  const u = await requireRole(["senec", "sedec"]);
  const filtre = filtreEtablissements(u.portee);
  const [lignes, presence, notes] = await Promise.all([
    lignesReseau(filtre),
    tauxPresence(filtre),
    moyenneGenerale(filtre),
  ]);

  const totaux = lignes.reduce(
    (t, l) => ({ etabs: t.etabs + 1, eleves: t.eleves + l.eleves, enseignants: t.enseignants + l.enseignants, classes: t.classes + l.classes }),
    { etabs: 0, eleves: 0, enseignants: 0, classes: 0 },
  );
  const kpis = [
    { libelle: "Établissements", valeur: totaux.etabs.toLocaleString("fr-FR") },
    { libelle: "Élèves (comptes)", valeur: totaux.eleves.toLocaleString("fr-FR") },
    { libelle: "Enseignants", valeur: totaux.enseignants.toLocaleString("fr-FR") },
    { libelle: "Classes", valeur: totaux.classes.toLocaleString("fr-FR") },
    { libelle: "Taux de présence", valeur: presence.taux != null ? `${presence.taux.toLocaleString("fr-FR")} %` : "—" },
    { libelle: "Moyenne générale", valeur: notes.moyenne != null ? `${notes.moyenne.toLocaleString("fr-FR")} /20` : "—" },
  ];

  // Regroupement par diocèse (le SEDEC n'en a qu'un ; le SENEC les voit tous).
  const parDiocese = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const d = l.diocese ?? "(sans diocèse)";
    parDiocese.set(d, [...(parDiocese.get(d) ?? []), l]);
  }
  const dioceses = [...parDiocese.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre={u.roleActif === "senec" ? "Statistiques du réseau — SENEC" : `Statistiques — ${u.portee.diocese ?? "mon diocèse"}`}
        description={
          u.roleActif === "senec"
            ? "Vue nationale de l'enseignement catholique (réseau SEDEC), par diocèse — consultation."
            : "Vue d'ensemble des établissements catholiques de votre diocèse — consultation."
        }
      />
      <Link href="/app/systeme/etablissements" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={15} /> Retour aux établissements
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.libelle} className="p-4">
            <p className="font-display text-xl font-bold text-forest-900">{k.valeur}</p>
            <p className="text-xs text-ink-700/60">{k.libelle}</p>
          </Card>
        ))}
      </div>

      {u.roleActif === "senec" ? (
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Church size={17} className="text-forest-600" /> Par diocèse (SEDEC)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-2 pr-2">Diocèse</th>
                  <th className="py-2 pr-2 text-right">Étab.</th>
                  <th className="py-2 pr-2 text-right">Élèves</th>
                  <th className="py-2 pr-2 text-right">Enseignants</th>
                  <th className="py-2 pr-2 text-right">Classes</th>
                  <th className="py-2 text-right">Rapport de SEDEC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {dioceses.map(([d, ls]) => {
                  const t = ls.reduce((x, l) => ({ eleves: x.eleves + l.eleves, ens: x.ens + l.enseignants, cls: x.cls + l.classes }), { eleves: 0, ens: 0, cls: 0 });
                  const sansDiocese = d === "(sans diocèse)";
                  return (
                    <tr key={d}>
                      <td className="py-2 pr-2 font-medium text-forest-900">
                        {sansDiocese ? d : (
                          <Link href={`/app/systeme/etablissements?diocese=${encodeURIComponent(d)}`} className="hover:underline">{d}</Link>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">{ls.length}</td>
                      <td className="py-2 pr-2 text-right">{t.eleves.toLocaleString("fr-FR")}</td>
                      <td className="py-2 pr-2 text-right">{t.ens.toLocaleString("fr-FR")}</td>
                      <td className="py-2 pr-2 text-right">{t.cls}</td>
                      <td className="py-2 text-right">
                        {sansDiocese ? (
                          <span className="text-xs text-ink-700/45">—</span>
                        ) : (
                          <a
                            href={`/app/systeme/etablissements/reseau/rapport-sedec?diocese=${encodeURIComponent(d)}`}
                            className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-3 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50"
                          >
                            <Download size={13} /> Word
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-700/50">
            Le rapport de SEDEC s&apos;ouvre dans Word et peut être ajusté avant diffusion.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <Church size={17} className="text-forest-600" /> Établissements du diocèse
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-2 pr-2">Établissement</th>
                  <th className="py-2 pr-2">Localité</th>
                  <th className="py-2 pr-2 text-right">Élèves</th>
                  <th className="py-2 pr-2 text-right">Enseignants</th>
                  <th className="py-2 text-right">Classes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {lignes.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-2 font-medium text-forest-900">
                      <Link href={`/app/systeme/etablissements/${l.id}`} className="hover:underline">{l.nom}</Link>
                    </td>
                    <td className="py-2 pr-2">{l.ville ?? "—"}</td>
                    <td className="py-2 pr-2 text-right">{l.eleves.toLocaleString("fr-FR")}</td>
                    <td className="py-2 pr-2 text-right">{l.enseignants.toLocaleString("fr-FR")}</td>
                    <td className="py-2 text-right">{l.classes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-700/50">
            Le rapport Word de chaque établissement se télécharge depuis sa fiche (onglet « Rapport »).
          </p>
        </Card>
      )}
    </div>
  );
}
