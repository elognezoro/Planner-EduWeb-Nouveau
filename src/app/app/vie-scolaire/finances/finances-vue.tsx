"use client";

import { useState } from "react";
import {
  LayoutDashboard, GraduationCap, Landmark, Store, Printer, AlertTriangle, Wallet, Receipt,
  ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { BoutonImprimerEdt } from "@/components/app/emplois-du-temps/bouton-imprimer";
import { OngletScolarite, OngletPaiements } from "./scolarite-onglets";
import { OngletTresorerie, OngletEconomat } from "./tresorerie-economat";
import {
  fcfa,
  LIBELLE_MODE,
  type FraisVue,
  type EleveVue,
  type PaiementVue,
  type RemiseVue,
  type ImpayeVue,
  type OperationVue,
  type ArticleVue,
  type MouvementVue,
} from "./types";

/** En-tête officiel de l'établissement (mêmes champs que EtablissementEnTete, cf. en-tete-officiel-doc.tsx). */
export interface EnteteEtablissement {
  nom: string;
  pays: string | null;
  ministere: string | null;
  anneeScolaire: string | null;
  emblemeUrl: string | null;
  sloganBulletin: string | null;
  fonctionChef: string | null;
  nomChef: string | null;
  prenomsChef: string | null;
}

export interface CategorieOhadaVue { code: string; libelle: string; sens: string; total: number }
export interface SoldeModeVue { mode: string; recettes: number; depenses: number }
export interface KpiFinances {
  totalEncaisse: number;
  ventesEconomat: number;
  totalDepenses: number;
  totalRecettesDiverses: number;
  soldes: SoldeModeVue[];
  categoriesOhada: CategorieOhadaVue[];
}
export interface RapportMois {
  libelle: string;
  recettesScolarite: number;
  recettesEconomat: number;
  categoriesOhada: CategorieOhadaVue[];
}

type Onglet = "tableau" | "scolarite" | "encaissements" | "tresorerie" | "economat" | "rapport";

/**
 * Coquille des Finances de l'établissement : 6 onglets internes (état local, pas de navigation).
 * Le Tableau de bord est rendu directement ici ; Scolarité/Encaissements viennent de
 * « ./scolarite-onglets » et Caisse & Banque/Économat de « ./tresorerie-economat ».
 */
export function FinancesVue({
  etablissementId,
  entete,
  frais,
  remises,
  impayes,
  eleves,
  niveaux,
  paiements,
  operations,
  articles,
  mouvements,
  kpi,
  rapportMois,
  peutEcrire,
}: {
  etablissementId: string;
  entete: EnteteEtablissement;
  frais: FraisVue[];
  remises: RemiseVue[];
  impayes: ImpayeVue[];
  eleves: EleveVue[];
  niveaux: { id: string; nom: string }[];
  paiements: PaiementVue[];
  operations: OperationVue[];
  articles: ArticleVue[];
  mouvements: MouvementVue[];
  kpi: KpiFinances;
  rapportMois: RapportMois;
  peutEcrire: boolean;
}) {
  const [onglet, setOnglet] = useState<Onglet>("tableau");

  const onglets: { cle: Onglet; libelle: string; Icone: typeof LayoutDashboard }[] = [
    { cle: "tableau", libelle: "Tableau de bord", Icone: LayoutDashboard },
    { cle: "scolarite", libelle: "Scolarité", Icone: GraduationCap },
    { cle: "encaissements", libelle: "Encaissements", Icone: Receipt },
    { cle: "tresorerie", libelle: "Caisse & Banque", Icone: Landmark },
    { cle: "economat", libelle: "Économat", Icone: Store },
    { cle: "rapport", libelle: "Rapport financier", Icone: Printer },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-cream-200 bg-white p-1.5 shadow-soft print:hidden">
        {onglets.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => setOnglet(o.cle)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-colors ${
              onglet === o.cle ? "bg-forest-800 text-cream-50" : "text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <o.Icone size={15} /> {o.libelle}
          </button>
        ))}
      </div>

      {onglet === "tableau" && (
        <TableauDeBord kpi={kpi} paiements={paiements} articles={articles} impayes={impayes} />
      )}

      {onglet === "scolarite" && (
        <OngletScolarite
          etablissementId={etablissementId}
          frais={frais}
          remises={remises}
          impayes={impayes}
          eleves={eleves}
          niveaux={niveaux}
          peutEcrire={peutEcrire}
        />
      )}

      {onglet === "encaissements" && (
        <OngletPaiements
          etablissementId={etablissementId}
          paiements={paiements}
          frais={frais}
          eleves={eleves}
          entete={entete}
          peutEcrire={peutEcrire}
        />
      )}

      {onglet === "tresorerie" && (
        <OngletTresorerie
          etablissementId={etablissementId}
          operations={operations}
          soldes={kpi.soldes}
          peutEcrire={peutEcrire}
        />
      )}

      {onglet === "economat" && (
        <OngletEconomat
          etablissementId={etablissementId}
          articles={articles}
          mouvements={mouvements}
          eleves={eleves}
          peutEcrire={peutEcrire}
        />
      )}

      {onglet === "rapport" && <RapportFinancier entete={entete} kpi={kpi} rapportMois={rapportMois} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Onglet « Tableau de bord »
// ─────────────────────────────────────────────────────────────

function TableauDeBord({
  kpi,
  paiements,
  articles,
  impayes,
}: {
  kpi: KpiFinances;
  paiements: PaiementVue[];
  articles: ArticleVue[];
  impayes: ImpayeVue[];
}) {
  const totalImpayes = impayes.reduce((s, i) => s + i.reste, 0);
  const totalRecettes = kpi.totalEncaisse + kpi.ventesEconomat + kpi.totalRecettesDiverses;
  const soldeNet = totalRecettes - kpi.totalDepenses;
  const alertes = articles.filter((a) => a.actif && a.stock <= a.seuilAlerte);
  const derniers = paiements.slice(0, 10);
  const maxSolde = Math.max(1, ...kpi.soldes.map((s) => Math.max(s.recettes, s.depenses)));

  const cartes: { libelle: string; valeur: number; Icone: typeof Receipt; ton: "forest" | "gold" }[] = [
    { libelle: "Encaissé (scolarité)", valeur: kpi.totalEncaisse, Icone: Receipt, ton: "forest" },
    { libelle: "Ventes économat", valeur: kpi.ventesEconomat, Icone: Store, ton: "forest" },
    { libelle: "Recettes diverses", valeur: kpi.totalRecettesDiverses, Icone: ArrowUpCircle, ton: "forest" },
    { libelle: "Dépenses", valeur: kpi.totalDepenses, Icone: ArrowDownCircle, ton: "gold" },
    { libelle: "Solde net", valeur: soldeNet, Icone: Wallet, ton: soldeNet >= 0 ? "forest" : "gold" },
    { libelle: "Total des impayés", valeur: totalImpayes, Icone: AlertTriangle, ton: "gold" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cartes.map((c) => (
          <div key={c.libelle} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                c.ton === "gold" ? "bg-gold-100 text-gold-700" : "bg-forest-50 text-forest-700"
              }`}
            >
              <c.Icone size={16} />
            </span>
            <p className="mt-2 font-display text-lg font-bold text-forest-900">{fcfa(c.valeur)}</p>
            <p className="text-xs text-ink-700/60">{c.libelle}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            Soldes par mode de paiement
          </h3>
          <div className="space-y-3">
            {kpi.soldes.map((s) => (
              <div key={s.mode}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-800">{LIBELLE_MODE[s.mode] ?? s.mode}</span>
                  <span className="text-ink-700/60">
                    <span className="text-forest-700">{fcfa(s.recettes)}</span> ·{" "}
                    <span className="text-red-600">{fcfa(s.depenses)}</span>
                  </span>
                </div>
                <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-cream-100">
                  <div className="h-full bg-forest-500" style={{ width: `${(s.recettes / maxSolde) * 100}%` }} />
                  <div className="h-full bg-red-400" style={{ width: `${(s.depenses / maxSolde) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
          <h3 className="mb-3 inline-flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            <AlertTriangle size={15} className="text-gold-600" /> Alertes de stock
          </h3>
          {alertes.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucun article sous son seuil d&apos;alerte.</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {alertes.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-forest-900">{a.nom}</span>
                  <span className="text-red-600">
                    {a.stock} restant{a.stock > 1 ? "s" : ""} · seuil {a.seuilAlerte}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            Derniers encaissements
          </h3>
          {derniers.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucun encaissement enregistré.</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {derniers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-forest-900">{p.eleveNom}</p>
                    <p className="truncate text-xs text-ink-700/55">
                      {p.libelle} · reçu n° {String(p.numeroRecu).padStart(6, "0")}
                    </p>
                  </div>
                  <span className={`shrink-0 font-semibold ${p.annule ? "text-ink-700/40 line-through" : "text-forest-800"}`}>
                    {fcfa(p.montant)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            Impayés{" "}
            <span className="font-normal normal-case text-ink-700/55">
              ({impayes.length} élève{impayes.length > 1 ? "s" : ""})
            </span>
          </h3>
          {impayes.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucun impayé : tous les frais obligatoires sont soldés.</p>
          ) : (
            <ul className="divide-y divide-cream-100">
              {impayes.slice(0, 10).map((i) => (
                <li key={i.eleveId} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-forest-900">{i.eleveNom}</p>
                    <p className="text-xs text-ink-700/55">{i.classe ?? "—"}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-red-600">{fcfa(i.reste)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Onglet « Rapport financier » — état imprimable (window.print)
// ─────────────────────────────────────────────────────────────

function RapportFinancier({
  entete,
  kpi,
  rapportMois,
}: {
  entete: EnteteEtablissement;
  kpi: KpiFinances;
  rapportMois: RapportMois;
}) {
  const recettesOhadaAnnee = kpi.categoriesOhada.filter((c) => c.sens === "recette");
  const depensesOhadaAnnee = kpi.categoriesOhada.filter((c) => c.sens === "depense");
  const recettesOhadaMois = rapportMois.categoriesOhada.filter((c) => c.sens === "recette");
  const depensesOhadaMois = rapportMois.categoriesOhada.filter((c) => c.sens === "depense");

  const totalRecettesAnnee = kpi.totalEncaisse + kpi.ventesEconomat + kpi.totalRecettesDiverses;
  const totalRecettesMois =
    rapportMois.recettesScolarite + rapportMois.recettesEconomat + recettesOhadaMois.reduce((s, c) => s + c.total, 0);
  const totalDepensesMois = depensesOhadaMois.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <BoutonImprimerEdt />
      </div>

      <div className="edt-feuille rounded-2xl border border-cream-200 bg-white p-6 shadow-soft sm:p-8">
        <style
          dangerouslySetInnerHTML={{
            __html:
              "@media print { @page { size: A4 portrait; margin: 12mm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .edt-feuille { border: 0 !important; box-shadow: none !important; padding: 0 !important; } }",
          }}
        />
        <EnTeteOfficielDoc etab={entete} titre="Rapport financier" sousTitre={rapportMois.libelle} />

        <section className="mb-6">
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            Mois en cours — {rapportMois.libelle}
          </h3>
          <RecapCategories
            recettes={[
              { code: "scolarite", libelle: "Scolarité (encaissements)", total: rapportMois.recettesScolarite },
              { code: "economat", libelle: "Économat (ventes)", total: rapportMois.recettesEconomat },
              ...recettesOhadaMois,
            ]}
            depenses={depensesOhadaMois}
            totalRecettes={totalRecettesMois}
            totalDepenses={totalDepensesMois}
          />
        </section>

        <section className="mb-6">
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            Cumul de l&apos;année scolaire
          </h3>
          <RecapCategories
            recettes={[
              { code: "scolarite", libelle: "Scolarité (encaissements)", total: kpi.totalEncaisse },
              { code: "economat", libelle: "Économat (ventes)", total: kpi.ventesEconomat },
              ...recettesOhadaAnnee,
            ]}
            depenses={depensesOhadaAnnee}
            totalRecettes={totalRecettesAnnee}
            totalDepenses={kpi.totalDepenses}
          />
        </section>

        <section>
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">
            Soldes par mode de paiement (cumul)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-cream-300 text-left text-xs uppercase tracking-wide text-ink-700/55">
                  <th className="py-1.5 pr-2">Mode</th>
                  <th className="py-1.5 pr-2 text-right">Recettes</th>
                  <th className="py-1.5 text-right">Dépenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {kpi.soldes.map((s) => (
                  <tr key={s.mode}>
                    <td className="py-1.5 pr-2 font-medium text-forest-900">{LIBELLE_MODE[s.mode] ?? s.mode}</td>
                    <td className="py-1.5 pr-2 text-right text-forest-700">{fcfa(s.recettes)}</td>
                    <td className="py-1.5 text-right text-red-600">{fcfa(s.depenses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function RecapCategories({
  recettes,
  depenses,
  totalRecettes,
  totalDepenses,
}: {
  recettes: { code: string; libelle: string; total: number }[];
  depenses: { code: string; libelle: string; total: number }[];
  totalRecettes: number;
  totalDepenses: number;
}) {
  const recettesUtiles = recettes.filter((r) => r.total > 0);
  const depensesUtiles = depenses.filter((d) => d.total > 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Recettes</p>
        <ul className="divide-y divide-cream-100 text-sm">
          {recettesUtiles.length === 0 ? (
            <li className="py-1.5 text-ink-700/50">Aucune recette.</li>
          ) : (
            recettesUtiles.map((r) => (
              <li key={r.code} className="flex items-center justify-between py-1.5">
                <span className="text-ink-800">{r.libelle}</span>
                <span className="font-medium text-forest-800">{fcfa(r.total)}</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-1.5 flex items-center justify-between border-t border-cream-300 pt-1.5 text-sm font-bold text-forest-900">
          <span>Total recettes</span>
          <span>{fcfa(totalRecettes)}</span>
        </p>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Dépenses</p>
        <ul className="divide-y divide-cream-100 text-sm">
          {depensesUtiles.length === 0 ? (
            <li className="py-1.5 text-ink-700/50">Aucune dépense.</li>
          ) : (
            depensesUtiles.map((d) => (
              <li key={d.code} className="flex items-center justify-between py-1.5">
                <span className="text-ink-800">{d.libelle}</span>
                <span className="font-medium text-red-600">{fcfa(d.total)}</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-1.5 flex items-center justify-between border-t border-cream-300 pt-1.5 text-sm font-bold text-forest-900">
          <span>Total dépenses</span>
          <span>{fcfa(totalDepenses)}</span>
        </p>
      </div>
    </div>
  );
}
