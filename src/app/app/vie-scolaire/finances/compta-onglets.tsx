"use client";

/**
 * Phase 2 des Finances : comptabilité OHADA en partie double (dérivée des paiements, ventes
 * et opérations déjà enregistrés — aucune saisie d'écriture séparée), rapprochement bancaire
 * (pointage + relevés mensuels) et budget prévisionnel (prévu vs réalisé par catégorie OHADA).
 * Trois exports, un onglet chacun dans finances-vue.tsx.
 */

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle, BookOpen, Calculator, Check, CheckSquare, Download, GitCompare, Loader2, Lock,
  PiggyBank, Printer, Scale, Square, Unlock,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, SubmitButton, Select } from "@/components/ui/form";
import { CATEGORIES_OHADA } from "@/lib/finances/categories";
import {
  basculerPointage, cloturerExercice, enregistrerBudget, enregistrerReleve, rouvrirExercice, type EtatForm,
} from "@/lib/finances/actions";
import {
  fcfa,
  LIBELLE_MODE,
  type BudgetVue,
  type ClotureVue,
  type MouvementVue,
  type OperationVue,
  type PaiementVue,
  type RealiseVue,
  type ReleveVue,
} from "./types";

const INITIAL: EtatForm = { ok: false };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

// ────────────────────────────────────────────────────────────────────────
//  Écritures en partie double, dérivées des paiements / ventes / opérations
// ────────────────────────────────────────────────────────────────────────

/** Mode de règlement → compte de trésorerie OHADA simplifié. */
const COMPTE_TRESORERIE: Record<string, string> = {
  especes: "571",
  mobile_money: "551",
  cheque: "521",
  virement: "521",
};
const LIBELLES_TRESORERIE: Record<string, string> = {
  "571": "Caisse",
  "551": "Monnaie électronique",
  "521": "Banque",
};

function libelleCompte(code: string): string {
  if (LIBELLES_TRESORERIE[code]) return LIBELLES_TRESORERIE[code];
  if (code === "7061") return "Scolarité";
  if (code === "12") return "Report à nouveau";
  return CATEGORIES_OHADA.find((c) => c.code === code)?.libelle ?? code;
}

interface Ecriture {
  id: string;
  date: string;
  libelle: string;
  debit: string;
  credit: string;
  montant: number;
}

function construireEcritures(paiements: PaiementVue[], ventes: MouvementVue[], operations: OperationVue[]): Ecriture[] {
  const lignes: Ecriture[] = [];
  for (const p of paiements) {
    if (p.annule) continue;
    const compte = COMPTE_TRESORERIE[p.mode] ?? "571";
    lignes.push({
      id: `paiement-${p.id}`, date: p.date, libelle: `${p.eleveNom} — ${p.libelle}`,
      debit: compte, credit: "7061", montant: p.montant,
    });
  }
  for (const v of ventes) {
    if (v.type !== "vente" || !v.montant) continue;
    const compte = COMPTE_TRESORERIE[v.mode ?? "especes"] ?? "571";
    lignes.push({
      id: `vente-${v.id}`, date: v.date, libelle: `Vente — ${v.articleNom}${v.acheteur ? ` (${v.acheteur})` : ""}`,
      debit: compte, credit: "707", montant: v.montant,
    });
  }
  for (const o of operations) {
    if (o.annule) continue;
    const compte = COMPTE_TRESORERIE[o.mode] ?? "571";
    if (o.sens === "recette") {
      lignes.push({ id: `operation-${o.id}`, date: o.date, libelle: o.libelle, debit: compte, credit: o.categorie, montant: o.montant });
    } else {
      lignes.push({ id: `operation-${o.id}`, date: o.date, libelle: o.libelle, debit: o.categorie, credit: compte, montant: o.montant });
    }
  }
  return lignes;
}

/**
 * Écritures d'ouverture (à-nouveaux) dérivées des soldes de la PLUS RÉCENTE clôture : chaque
 * compte est débité (solde > 0) ou crédité (solde < 0), avec pour contrepartie le compte
 * « 12 — Report à nouveau ». Le compte 12 lui-même n'est pas rejoué : il EST la contrepartie.
 */
function construireEcrituresOuverture(
  aNouveaux: { compte: string; libelle: string; solde: number }[],
  dateOuverture: string | null,
): Ecriture[] {
  if (!dateOuverture) return [];
  return aNouveaux
    .filter((a) => a.compte !== "12" && a.solde !== 0)
    .map((a) => ({
      id: `anouveau-${a.compte}`,
      date: dateOuverture,
      libelle: "À-nouveaux (report d'exercice)",
      debit: a.solde > 0 ? a.compte : "12",
      credit: a.solde > 0 ? "12" : a.compte,
      montant: Math.abs(a.solde),
    }));
}

// ────────────────────────────────────────────────────────────────────────
//  Onglet Comptabilité : grand livre / balance / résultat & bilan / clôture
// ────────────────────────────────────────────────────────────────────────

type SousOngletCompta = "grandLivre" | "balance" | "resultat" | "cloture";

export function OngletComptabilite({
  paiements,
  ventes,
  operations,
  soldes,
  impayesTotal,
  exercice,
  clotures,
  aNouveaux,
  etablissementId,
  peutEcrire,
}: {
  paiements: PaiementVue[];
  ventes: MouvementVue[];
  operations: OperationVue[];
  soldes: { mode: string; recettes: number; depenses: number }[];
  impayesTotal: number;
  exercice: string;
  clotures: ClotureVue[];
  aNouveaux: { compte: string; libelle: string; solde: number }[];
  etablissementId: string;
  peutEcrire: boolean;
}) {
  const dateOuverture = useMemo(() => {
    if (clotures.length === 0) return null;
    const fin = new Date(clotures[0].finPeriode);
    if (Number.isNaN(fin.getTime())) return null;
    return new Date(fin.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }, [clotures]);

  const ecritures = useMemo(
    () => [...construireEcrituresOuverture(aNouveaux, dateOuverture), ...construireEcritures(paiements, ventes, operations)],
    [paiements, ventes, operations, aNouveaux, dateOuverture],
  );
  const [sousOnglet, setSousOnglet] = useState<SousOngletCompta>("grandLivre");

  const onglets: { cle: SousOngletCompta; libelle: string; Icone: typeof BookOpen }[] = [
    { cle: "grandLivre", libelle: "Grand livre", Icone: BookOpen },
    { cle: "balance", libelle: "Balance", Icone: Scale },
    { cle: "resultat", libelle: "Résultat & Bilan", Icone: Calculator },
    { cle: "cloture", libelle: "Clôture & exports", Icone: Lock },
  ];

  return (
    <div className="space-y-5">
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@media print { body * { visibility: hidden; } #compta-impression, #compta-impression * { visibility: visible; } #compta-impression { position: fixed; inset: 0; margin: 0; padding: 12mm; } }",
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-cream-200 bg-white p-1.5 shadow-soft">
          {onglets.map((o) => (
            <button
              key={o.cle}
              type="button"
              onClick={() => setSousOnglet(o.cle)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-colors ${
                sousOnglet === o.cle ? "bg-forest-800 text-cream-50" : "text-ink-700/70 hover:bg-cream-100"
              }`}
            >
              <o.Icone size={15} /> {o.libelle}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50"
        >
          <Printer size={15} /> Imprimer
        </button>
      </div>

      <div id="compta-impression" className="space-y-4">
        {sousOnglet !== "cloture" && (
          <p className="text-xs italic text-ink-700/55">
            Note : écritures dérivées automatiquement des 300 dernières opérations affichées
            {aNouveaux.length > 0 ? ", à-nouveaux de la dernière clôture inclus" : ""}.
          </p>
        )}

        {sousOnglet === "grandLivre" && (
          <Card>
            <GrandLivre ecritures={ecritures} />
          </Card>
        )}
        {sousOnglet === "balance" && (
          <Card>
            <Balance ecritures={ecritures} />
          </Card>
        )}
        {sousOnglet === "resultat" && (
          <Card>
            <ResultatBilan ecritures={ecritures} soldes={soldes} impayesTotal={impayesTotal} exercice={exercice} aNouveaux={aNouveaux} />
          </Card>
        )}
        {sousOnglet === "cloture" && (
          <SousOngletCloture etablissementId={etablissementId} clotures={clotures} exercice={exercice} peutEcrire={peutEcrire} />
        )}
      </div>
    </div>
  );
}

function GrandLivre({ ecritures }: { ecritures: Ecriture[] }) {
  const comptes = useMemo(() => {
    const set = new Set<string>();
    for (const e of ecritures) {
      set.add(e.debit);
      set.add(e.credit);
    }
    return [...set].sort();
  }, [ecritures]);
  const [compte, setCompte] = useState(comptes[0] ?? "571");
  const compteActif = comptes.includes(compte) ? compte : (comptes[0] ?? "571");

  const lignes = useMemo(() => {
    const filtrees = ecritures
      .filter((e) => e.debit === compteActif || e.credit === compteActif)
      .sort((a, b) => a.date.localeCompare(b.date));
    return filtrees.reduce<(Ecriture & { d: number; c: number; solde: number })[]>((acc, e) => {
      const d = e.debit === compteActif ? e.montant : 0;
      const c = e.credit === compteActif ? e.montant : 0;
      const soldePrecedent = acc.length ? acc[acc.length - 1].solde : 0;
      return [...acc, { ...e, d, c, solde: soldePrecedent + d - c }];
    }, []);
  }, [ecritures, compteActif]);

  const totalDebit = lignes.reduce((s, l) => s + l.d, 0);
  const totalCredit = lignes.reduce((s, l) => s + l.c, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <BookOpen size={18} className="text-forest-600" /> Grand livre
        </h2>
        <Select value={compteActif} onChange={(e) => setCompte(e.target.value)} className="w-auto">
          {comptes.length === 0 ? (
            <option value="571">571 — Caisse</option>
          ) : (
            comptes.map((c) => (
              <option key={c} value={c}>
                {c} — {libelleCompte(c)}
              </option>
            ))
          )}
        </Select>
      </div>
      {lignes.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucune écriture sur ce compte.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">Date</th>
                <th className="py-1.5 pr-2">Libellé</th>
                <th className="py-1.5 pr-2 text-right">Débit</th>
                <th className="py-1.5 pr-2 text-right">Crédit</th>
                <th className="py-1.5 text-right">Solde cumulé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap py-2 pr-2">{formatDate(l.date)}</td>
                  <td className="py-2 pr-2">{l.libelle}</td>
                  <td className="py-2 pr-2 text-right">{l.d ? fcfa(l.d) : "—"}</td>
                  <td className="py-2 pr-2 text-right">{l.c ? fcfa(l.c) : "—"}</td>
                  <td className={`py-2 text-right font-semibold ${l.solde >= 0 ? "text-forest-800" : "text-red-700"}`}>{fcfa(l.solde)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-cream-200 font-bold text-forest-900">
                <td className="py-2 pr-2" colSpan={2}>Totaux</td>
                <td className="py-2 pr-2 text-right">{fcfa(totalDebit)}</td>
                <td className="py-2 pr-2 text-right">{fcfa(totalCredit)}</td>
                <td className="py-2 text-right">{fcfa(totalDebit - totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Balance({ ecritures }: { ecritures: Ecriture[] }) {
  const lignes = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const e of ecritures) {
      const d = map.get(e.debit) ?? { debit: 0, credit: 0 };
      d.debit += e.montant;
      map.set(e.debit, d);
      const c = map.get(e.credit) ?? { debit: 0, credit: 0 };
      c.credit += e.montant;
      map.set(e.credit, c);
    }
    return [...map.entries()]
      .map(([code, v]) => ({
        code,
        libelle: libelleCompte(code),
        debit: v.debit,
        credit: v.credit,
        soldeDebiteur: Math.max(0, v.debit - v.credit),
        soldeCrediteur: Math.max(0, v.credit - v.debit),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [ecritures]);

  const totaux = lignes.reduce(
    (acc, l) => ({
      debit: acc.debit + l.debit,
      credit: acc.credit + l.credit,
      soldeDebiteur: acc.soldeDebiteur + l.soldeDebiteur,
      soldeCrediteur: acc.soldeCrediteur + l.soldeCrediteur,
    }),
    { debit: 0, credit: 0, soldeDebiteur: 0, soldeCrediteur: 0 },
  );

  return (
    <div className="space-y-4">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Scale size={18} className="text-forest-600" /> Balance générale
      </h2>
      {lignes.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucune écriture enregistrée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">N°</th>
                <th className="py-1.5 pr-2">Intitulé</th>
                <th className="py-1.5 pr-2 text-right">Total débits</th>
                <th className="py-1.5 pr-2 text-right">Total crédits</th>
                <th className="py-1.5 pr-2 text-right">Solde débiteur</th>
                <th className="py-1.5 text-right">Solde créditeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {lignes.map((l) => (
                <tr key={l.code}>
                  <td className="py-2 pr-2 font-mono text-xs text-ink-700/70">{l.code}</td>
                  <td className="py-2 pr-2 font-medium text-forest-900">{l.libelle}</td>
                  <td className="py-2 pr-2 text-right">{fcfa(l.debit)}</td>
                  <td className="py-2 pr-2 text-right">{fcfa(l.credit)}</td>
                  <td className="py-2 pr-2 text-right text-forest-700">{l.soldeDebiteur ? fcfa(l.soldeDebiteur) : "—"}</td>
                  <td className="py-2 text-right text-red-700">{l.soldeCrediteur ? fcfa(l.soldeCrediteur) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-cream-200 font-bold text-forest-900">
                <td className="py-2 pr-2" colSpan={2}>TOTAUX</td>
                <td className="py-2 pr-2 text-right">{fcfa(totaux.debit)}</td>
                <td className="py-2 pr-2 text-right">{fcfa(totaux.credit)}</td>
                <td className="py-2 pr-2 text-right">{fcfa(totaux.soldeDebiteur)}</td>
                <td className="py-2 text-right">{fcfa(totaux.soldeCrediteur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function ResultatBilan({
  ecritures,
  soldes,
  impayesTotal,
  exercice,
  aNouveaux,
}: {
  ecritures: Ecriture[];
  soldes: { mode: string; recettes: number; depenses: number }[];
  impayesTotal: number;
  exercice: string;
  aNouveaux: { compte: string; libelle: string; solde: number }[];
}) {
  const parCompte = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const e of ecritures) {
      const d = map.get(e.debit) ?? { debit: 0, credit: 0 };
      d.debit += e.montant;
      map.set(e.debit, d);
      const c = map.get(e.credit) ?? { debit: 0, credit: 0 };
      c.credit += e.montant;
      map.set(e.credit, c);
    }
    return map;
  }, [ecritures]);

  const produits = useMemo(
    () =>
      [...parCompte.entries()]
        .filter(([code]) => code.startsWith("7"))
        .map(([code, v]) => ({ code, libelle: libelleCompte(code), total: v.credit - v.debit }))
        .filter((p) => p.total !== 0)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [parCompte],
  );
  const charges = useMemo(
    () =>
      [...parCompte.entries()]
        .filter(([code]) => code.startsWith("6"))
        .map(([code, v]) => ({ code, libelle: libelleCompte(code), total: v.debit - v.credit }))
        .filter((c) => c.total !== 0)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [parCompte],
  );
  const totalProduits = produits.reduce((s, p) => s + p.total, 0);
  const totalCharges = charges.reduce((s, c) => s + c.total, 0);
  const resultatNet = totalProduits - totalCharges;

  const tresorerieParCompte = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of soldes) {
      const compte = COMPTE_TRESORERIE[s.mode] ?? "571";
      map.set(compte, (map.get(compte) ?? 0) + (s.recettes - s.depenses));
    }
    return [...map.entries()].map(([code, montant]) => ({ code, libelle: libelleCompte(code), montant }));
  }, [soldes]);
  const totalTresorerie = tresorerieParCompte.reduce((s, t) => s + t.montant, 0);
  const actifTotal = totalTresorerie + impayesTotal;
  // Sans à-nouveaux repris (aucune clôture) : l'écart d'ouverture équilibre Ressources = Actif.
  const ecartOuverture = actifTotal - resultatNet;
  // Avec à-nouveaux : la ligne « Report à nouveau » remplace l'écart d'ouverture (compte 12 des soldes de clôture).
  const aDesANouveaux = aNouveaux.length > 0;
  const soldeReportANouveau = aNouveaux.find((a) => a.compte === "12")?.solde ?? 0;
  const ligneOuvertureLibelle = aDesANouveaux ? "12 — Report à nouveau" : "Écart d'ouverture";
  const ligneOuvertureMontant = aDesANouveaux ? soldeReportANouveau : ecartOuverture;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-forest-900">Compte de résultat — exercice {exercice}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Produits (classe 7)</p>
            <ul className="divide-y divide-cream-100 text-sm">
              {produits.length === 0 ? (
                <li className="py-1.5 text-ink-700/50">Aucun produit.</li>
              ) : (
                produits.map((p) => (
                  <li key={p.code} className="flex items-center justify-between py-1.5">
                    <span className="text-ink-800">{p.code} — {p.libelle}</span>
                    <span className="font-medium text-forest-800">{fcfa(p.total)}</span>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-1.5 flex items-center justify-between border-t border-cream-300 pt-1.5 text-sm font-bold text-forest-900">
              <span>Total produits</span>
              <span>{fcfa(totalProduits)}</span>
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Charges (classe 6)</p>
            <ul className="divide-y divide-cream-100 text-sm">
              {charges.length === 0 ? (
                <li className="py-1.5 text-ink-700/50">Aucune charge.</li>
              ) : (
                charges.map((c) => (
                  <li key={c.code} className="flex items-center justify-between py-1.5">
                    <span className="text-ink-800">{c.code} — {c.libelle}</span>
                    <span className="font-medium text-red-600">{fcfa(c.total)}</span>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-1.5 flex items-center justify-between border-t border-cream-300 pt-1.5 text-sm font-bold text-forest-900">
              <span>Total charges</span>
              <span>{fcfa(totalCharges)}</span>
            </p>
          </div>
        </div>
        <p
          className={`rounded-2xl border px-4 py-3 text-center font-display text-lg font-bold ${
            resultatNet >= 0 ? "border-forest-200 bg-forest-50 text-forest-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          RÉSULTAT NET : {fcfa(resultatNet)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-forest-900">Bilan simplifié</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Actif</p>
            <ul className="divide-y divide-cream-100 text-sm">
              {tresorerieParCompte.map((t) => (
                <li key={t.code} className="flex items-center justify-between py-1.5">
                  <span className="text-ink-800">{t.code} — {t.libelle}</span>
                  <span className="font-medium text-forest-800">{fcfa(t.montant)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between py-1.5">
                <span className="text-ink-800">Créances sur familles (impayés)</span>
                <span className="font-medium text-forest-800">{fcfa(impayesTotal)}</span>
              </li>
            </ul>
            <p className="mt-1.5 flex items-center justify-between border-t border-cream-300 pt-1.5 text-sm font-bold text-forest-900">
              <span>Total actif</span>
              <span>{fcfa(actifTotal)}</span>
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Ressources</p>
            <ul className="divide-y divide-cream-100 text-sm">
              <li className="flex items-center justify-between py-1.5">
                <span className="text-ink-800">Résultat de l&apos;exercice</span>
                <span className="font-medium text-forest-800">{fcfa(resultatNet)}</span>
              </li>
              <li className="flex items-center justify-between py-1.5">
                <span className="text-ink-800">{ligneOuvertureLibelle}</span>
                <span className="font-medium text-forest-800">{fcfa(ligneOuvertureMontant)}</span>
              </li>
            </ul>
            <p className="mt-1.5 flex items-center justify-between border-t border-cream-300 pt-1.5 text-sm font-bold text-forest-900">
              <span>Total ressources</span>
              <span>{fcfa(resultatNet + ligneOuvertureMontant)}</span>
            </p>
          </div>
        </div>
        <p className="rounded-xl bg-cream-50 px-3 py-2 text-xs italic text-ink-700/70">
          {aDesANouveaux
            ? "Bilan simplifié : à-nouveaux repris de la dernière clôture d'exercice."
            : "Bilan simplifié : les à-nouveaux seront repris à la clôture d'exercice."}
        </p>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Sous-onglet « Clôture & exports » : export comptable normalisé, historique des clôtures
//  (réouverture de la dernière uniquement) et formulaire de clôture d'exercice.
// ────────────────────────────────────────────────────────────────────────

function SousOngletCloture({
  etablissementId,
  clotures,
  exercice,
  peutEcrire,
}: {
  etablissementId: string;
  clotures: ClotureVue[];
  exercice: string;
  peutEcrire: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <BlocExportComptable />
      </Card>
      <Card>
        <BlocListeClotures clotures={clotures} peutEcrire={peutEcrire} />
      </Card>
      {peutEcrire && (
        <Card>
          <FormulaireCloture etablissementId={etablissementId} exercice={exercice} />
        </Card>
      )}
    </div>
  );
}

function BlocExportComptable() {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const href = useMemo(() => {
    const params = new URLSearchParams();
    if (du) params.set("du", du);
    if (au) params.set("au", au);
    const qs = params.toString();
    return `/api/finances/export-fec${qs ? `?${qs}` : ""}`;
  }, [du, au]);

  return (
    <div className="space-y-4">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Download size={18} className="text-forest-600" /> Export comptable
      </h2>
      <p className="text-sm text-ink-700/60">
        Toutes les écritures validées, en partie double, au format CSV normalisé (compatible tableur / logiciel comptable).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="export-du">Du (facultatif)</Label>
          <Input id="export-du" type="date" value={du} onChange={(e) => setDu(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="export-au">Au (facultatif)</Label>
          <Input id="export-au" type="date" value={au} onChange={(e) => setAu(e.target.value)} />
        </div>
      </div>
      <a
        href={href}
        download
        className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 shadow-soft transition-all hover:bg-forest-700 hover:-translate-y-0.5"
      >
        <Download size={16} /> Télécharger l&apos;export comptable (CSV normalisé)
      </a>
    </div>
  );
}

function BlocListeClotures({ clotures, peutEcrire }: { clotures: ClotureVue[]; peutEcrire: boolean }) {
  return (
    <div className="space-y-4">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Lock size={18} className="text-forest-600" /> Clôtures d&apos;exercice
      </h2>
      {clotures.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucun exercice clôturé pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-3">
          {clotures.map((c, i) => (
            <LigneCloture key={c.id} cloture={c} peutRouvrir={i === 0} peutEcrire={peutEcrire} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LigneCloture({
  cloture,
  peutRouvrir,
  peutEcrire,
}: {
  cloture: ClotureVue;
  peutRouvrir: boolean;
  peutEcrire: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function rouvrir() {
    setErreur(null);
    startTransition(async () => {
      const r = await rouvrirExercice(cloture.id);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
      setConfirmer(false);
    });
  }

  return (
    <li className="rounded-2xl border border-cream-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-bold text-forest-900">Exercice {cloture.exercice}</p>
          <p className="text-xs text-ink-700/60">Clôturé au {formatDate(cloture.finPeriode)}</p>
        </div>
        <p className={`font-display text-base font-bold ${cloture.resultat >= 0 ? "text-forest-800" : "text-red-700"}`}>
          {fcfa(cloture.resultat)}
        </p>
      </div>
      {cloture.soldes.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-ink-700/70">
          {cloture.soldes.map((s, idx) => (
            <li key={idx}>
              {s.compte} — {s.libelle} : {fcfa(s.solde)}
            </li>
          ))}
        </ul>
      )}
      {cloture.notes && <p className="mt-2 text-xs italic text-ink-700/60">{cloture.notes}</p>}
      {peutRouvrir && (
        <div className="mt-3">
          {erreur && <p className="mb-1.5 text-xs text-red-600">{erreur}</p>}
          {!confirmer ? (
            <button
              type="button"
              onClick={() => setConfirmer(true)}
              disabled={!peutEcrire}
              title={peutEcrire ? "Rouvrir cet exercice" : "Lecture seule"}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 px-4 py-1.5 text-xs font-semibold text-gold-800 hover:bg-gold-50 disabled:opacity-40"
            >
              <Unlock size={13} /> Rouvrir
            </button>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs font-medium text-red-700">Confirmer la réouverture ?</span>
              <button
                type="button"
                onClick={rouvrir}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Oui, rouvrir
              </button>
              <button
                type="button"
                onClick={() => setConfirmer(false)}
                className="rounded-full border border-cream-300 px-3 py-1.5 text-xs font-medium text-ink-700/70 hover:bg-cream-100"
              >
                Non
              </button>
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function BoutonClotureConfirmer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Oui, clôturer
    </button>
  );
}

function FormulaireCloture({ etablissementId, exercice }: { etablissementId: string; exercice: string }) {
  const [etat, action] = useActionState(cloturerExercice, INITIAL);
  const [confirmer, setConfirmer] = useState(false);
  const [etatVu, setEtatVu] = useState(etat);
  if (etat !== etatVu) {
    setEtatVu(etat);
    if (etat.ok) setConfirmer(false);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Lock size={18} className="text-forest-600" /> Clôturer l&apos;exercice
      </h2>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="cloture-exercice">Exercice</Label>
          <Input id="cloture-exercice" name="exercice" defaultValue={exercice} required maxLength={20} />
        </div>
        <div>
          <Label htmlFor="cloture-finPeriode">Date de fin</Label>
          <Input
            id="cloture-finPeriode"
            name="finPeriode"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="cloture-notes">Notes (facultatif)</Label>
        <textarea
          id="cloture-notes"
          name="notes"
          rows={2}
          maxLength={500}
          placeholder="Observations sur cette clôture…"
          className="w-full rounded-2xl border border-cream-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>

      <p className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertTriangle size={17} className="mt-0.5 shrink-0" />
        Les écritures antérieures à cette date seront verrouillées ; les soldes seront repris en à-nouveaux.
      </p>

      {!confirmer ? (
        <button
          type="button"
          onClick={() => setConfirmer(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-red-300 px-6 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          <Lock size={16} /> Clôturer l&apos;exercice
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-red-700">Confirmer la clôture ?</span>
          <BoutonClotureConfirmer />
          <button
            type="button"
            onClick={() => setConfirmer(false)}
            className="rounded-full border border-cream-300 px-4 py-2 text-sm font-medium text-ink-700/70 hover:bg-cream-100"
          >
            Annuler
          </button>
        </div>
      )}
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Onglet Rapprochement bancaire : pointage + relevés mensuels
// ────────────────────────────────────────────────────────────────────────

interface EcritureBancaire {
  id: string;
  cibleType: "paiement" | "operation";
  date: string;
  libelle: string;
  sens: "recette" | "depense";
  montant: number;
  mode: string;
  pointeLe: string | null;
}

export function OngletRapprochement({
  etablissementId,
  paiements,
  operations,
  releves,
  peutEcrire,
}: {
  etablissementId: string;
  paiements: PaiementVue[];
  operations: OperationVue[];
  releves: ReleveVue[];
  peutEcrire: boolean;
}) {
  const ecritures = useMemo<EcritureBancaire[]>(() => {
    const liste: EcritureBancaire[] = [];
    for (const p of paiements) {
      if (p.annule || (p.mode !== "cheque" && p.mode !== "virement")) continue;
      liste.push({
        id: p.id, cibleType: "paiement", date: p.date, libelle: `${p.eleveNom} — ${p.libelle}`,
        sens: "recette", montant: p.montant, mode: p.mode, pointeLe: p.pointeLe,
      });
    }
    for (const o of operations) {
      if (o.annule || (o.mode !== "cheque" && o.mode !== "virement")) continue;
      liste.push({
        id: o.id, cibleType: "operation", date: o.date, libelle: o.libelle,
        sens: o.sens === "recette" ? "recette" : "depense", montant: o.montant, mode: o.mode, pointeLe: o.pointeLe,
      });
    }
    return liste.sort((a, b) => b.date.localeCompare(a.date));
  }, [paiements, operations]);

  const soldeComptable = useMemo(
    () => ecritures.reduce((s, e) => s + (e.sens === "recette" ? e.montant : -e.montant), 0),
    [ecritures],
  );
  const soldePointe = useMemo(
    () => ecritures.filter((e) => e.pointeLe).reduce((s, e) => s + (e.sens === "recette" ? e.montant : -e.montant), 0),
    [ecritures],
  );

  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7));
  const releveMois = releves.find((r) => r.mois === mois);
  const ecart = releveMois ? releveMois.solde - soldePointe : null;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <GitCompare size={18} className="text-forest-600" /> Rapprochement bancaire
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cream-200 bg-white p-4">
            <p className="text-xs text-ink-700/60">Solde comptable (chèques &amp; virements)</p>
            <p className="mt-1 font-display text-lg font-bold text-forest-900">{fcfa(soldeComptable)}</p>
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-4">
            <p className="text-xs text-ink-700/60">Solde pointé</p>
            <p className="mt-1 font-display text-lg font-bold text-forest-900">{fcfa(soldePointe)}</p>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              ecart === null ? "border-cream-200 bg-white" : ecart === 0 ? "border-forest-300 bg-forest-50" : "border-gold-300 bg-gold-50"
            }`}
          >
            <p className="text-xs text-ink-700/60">Écart (relevé {mois} − pointé)</p>
            <p className={`mt-1 font-display text-lg font-bold ${ecart === null ? "text-ink-700/40" : ecart === 0 ? "text-forest-800" : "text-gold-800"}`}>
              {ecart === null ? "Aucun relevé" : fcfa(ecart)}
            </p>
          </div>
        </div>
      </Card>

      {peutEcrire && (
        <Card>
          <FormulaireReleve etablissementId={etablissementId} mois={mois} onMoisChange={setMois} />
        </Card>
      )}

      <Card>
        <h3 className="mb-3 font-display text-sm font-bold text-forest-900">Relevés enregistrés</h3>
        {releves.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucun relevé enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Mois</th>
                  <th className="py-1.5 text-right">Solde du relevé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {releves.map((r) => (
                  <tr key={r.mois}>
                    <td className="py-2 pr-2 font-medium text-forest-900">{r.mois}</td>
                    <td className="py-2 text-right">{fcfa(r.solde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-sm font-bold text-forest-900">
          Écritures bancaires (chèques &amp; virements)
          <span className="ml-1.5 text-xs font-normal text-ink-700/55">({ecritures.length})</span>
        </h3>
        {ecritures.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune écriture bancaire.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Date</th>
                  <th className="py-1.5 pr-2">Libellé</th>
                  <th className="py-1.5 pr-2">Mode</th>
                  <th className="py-1.5 pr-2 text-right">Montant</th>
                  <th className="py-1.5 text-right">Pointé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {ecritures.map((e) => (
                  <LigneEcritureBancaire key={`${e.cibleType}-${e.id}`} ecriture={e} peutEcrire={peutEcrire} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function LigneEcritureBancaire({ ecriture, peutEcrire }: { ecriture: EcritureBancaire; peutEcrire: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function basculer() {
    setErreur(null);
    startTransition(async () => {
      const r = await basculerPointage(ecriture.cibleType, ecriture.id);
      if (!r.ok) setErreur(r.message ?? "Refusé.");
    });
  }

  return (
    <tr>
      <td className="whitespace-nowrap py-2 pr-2">{formatDate(ecriture.date)}</td>
      <td className="py-2 pr-2">{ecriture.libelle}</td>
      <td className="py-2 pr-2 text-xs text-ink-700/70">{LIBELLE_MODE[ecriture.mode] ?? ecriture.mode}</td>
      <td className={`py-2 pr-2 text-right font-medium ${ecriture.sens === "recette" ? "text-forest-700" : "text-red-700"}`}>
        {ecriture.sens === "recette" ? "+" : "−"}{fcfa(ecriture.montant)}
      </td>
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={basculer}
          disabled={!peutEcrire || pending}
          title={peutEcrire ? (ecriture.pointeLe ? "Retirer le pointage" : "Pointer") : "Lecture seule"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
            ecriture.pointeLe ? "border-forest-300 bg-forest-50 text-forest-800" : "border-cream-300 text-ink-700/60 hover:bg-cream-100"
          }`}
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : ecriture.pointeLe ? <CheckSquare size={13} /> : <Square size={13} />}
          {ecriture.pointeLe ? "Pointé" : "Non pointé"}
        </button>
        {erreur && <p className="mt-1 text-xs text-red-600">{erreur}</p>}
      </td>
    </tr>
  );
}

function FormulaireReleve({
  etablissementId,
  mois,
  onMoisChange,
}: {
  etablissementId: string;
  mois: string;
  onMoisChange: (m: string) => void;
}) {
  const [etat, action] = useActionState(enregistrerReleve, INITIAL);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <h3 className="font-display text-sm font-bold text-forest-900">Solde du relevé du mois</h3>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="releve-mois">Mois</Label>
          <Input id="releve-mois" name="mois" type="month" value={mois} onChange={(e) => onMoisChange(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="releve-solde">Solde du relevé (F CFA)</Label>
          <Input id="releve-solde" name="solde" type="number" step={1} required />
        </div>
      </div>
      <SubmitButton className="w-auto px-6">Enregistrer le relevé</SubmitButton>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Onglet Budget prévisionnel : prévu vs réalisé par catégorie OHADA
// ────────────────────────────────────────────────────────────────────────

interface LigneBudgetDef {
  categorie: string;
  libelle: string;
  sens: "recette" | "depense";
  /** 7061 (scolarité) et 707 (ventes économat) sont calculés automatiquement, non saisissables. */
  automatique: boolean;
}

const LIGNES_BUDGET: LigneBudgetDef[] = [
  { categorie: "7061", libelle: "Scolarité", sens: "recette", automatique: true },
  ...CATEGORIES_OHADA.map((c) => ({ categorie: c.code, libelle: c.libelle, sens: c.sens, automatique: c.code === "707" })),
];

export function OngletBudget({
  etablissementId,
  budgets,
  realises,
  exercice,
  peutEcrire,
}: {
  etablissementId: string;
  budgets: BudgetVue[];
  realises: RealiseVue[];
  exercice: string;
  peutEcrire: boolean;
}) {
  const [prevu, setPrevu] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const b of budgets) map[b.categorie] = b.montantPrevu;
    return map;
  });
  const realiseMap = useMemo(() => new Map(realises.map((r) => [r.categorie, r.total])), [realises]);
  const [etat, action] = useActionState(enregistrerBudget, INITIAL);

  const recettes = LIGNES_BUDGET.filter((l) => l.sens === "recette");
  const depenses = LIGNES_BUDGET.filter((l) => l.sens === "depense");

  function majPrevu(categorie: string, valeur: string) {
    const n = Math.max(0, Math.trunc(Number(valeur)) || 0);
    setPrevu((p) => ({ ...p, [categorie]: n }));
  }

  const sommePrevu = (lignes: LigneBudgetDef[]) => lignes.reduce((s, l) => s + (l.automatique ? 0 : (prevu[l.categorie] ?? 0)), 0);
  const sommeRealise = (lignes: LigneBudgetDef[]) => lignes.reduce((s, l) => s + (realiseMap.get(l.categorie) ?? 0), 0);

  const prevuRecettes = sommePrevu(recettes);
  const prevuDepenses = sommePrevu(depenses);
  const realiseRecettes = sommeRealise(recettes);
  const realiseDepenses = sommeRealise(depenses);
  const soldePrevisionnel = prevuRecettes - prevuDepenses;
  const soldeRealise = realiseRecettes - realiseDepenses;

  const lignesJson = useMemo(
    () =>
      JSON.stringify(
        LIGNES_BUDGET.filter((l) => !l.automatique).map((l) => ({
          categorie: l.categorie,
          sens: l.sens,
          montantPrevu: prevu[l.categorie] ?? 0,
        })),
      ),
    [prevu],
  );

  return (
    <div className="space-y-6">
      <Card>
        <form action={action} className="space-y-5">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="exercice" value={exercice} />
          <input type="hidden" name="lignes" value={lignesJson} />

          <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <PiggyBank size={18} className="text-forest-600" /> Budget prévisionnel — exercice {exercice}
          </h2>
          {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

          <BlocLignesBudget titre="Recettes" lignes={recettes} prevu={prevu} realiseMap={realiseMap} peutEcrire={peutEcrire} onChange={majPrevu} />
          <BlocLignesBudget titre="Dépenses" lignes={depenses} prevu={prevu} realiseMap={realiseMap} peutEcrire={peutEcrire} onChange={majPrevu} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-cream-200 bg-white p-4">
              <p className="text-xs text-ink-700/60">Solde prévisionnel (prévu recettes − prévu dépenses)</p>
              <p className={`mt-1 font-display text-lg font-bold ${soldePrevisionnel >= 0 ? "text-forest-800" : "text-red-700"}`}>
                {fcfa(soldePrevisionnel)}
              </p>
            </div>
            <div className="rounded-2xl border border-cream-200 bg-white p-4">
              <p className="text-xs text-ink-700/60">Solde réalisé (réalisé recettes − réalisé dépenses)</p>
              <p className={`mt-1 font-display text-lg font-bold ${soldeRealise >= 0 ? "text-forest-800" : "text-red-700"}`}>{fcfa(soldeRealise)}</p>
            </div>
          </div>

          {peutEcrire && <SubmitButton className="w-auto px-6">Enregistrer le budget</SubmitButton>}
        </form>
      </Card>
    </div>
  );
}

function BlocLignesBudget({
  titre,
  lignes,
  prevu,
  realiseMap,
  peutEcrire,
  onChange,
}: {
  titre: string;
  lignes: LigneBudgetDef[];
  prevu: Record<string, number>;
  realiseMap: Map<string, number>;
  peutEcrire: boolean;
  onChange: (categorie: string, valeur: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-forest-900">{titre}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
              <th className="py-1.5 pr-2">Catégorie</th>
              <th className="py-1.5 pr-2 text-right">Prévu</th>
              <th className="py-1.5 pr-2 text-right">Réalisé</th>
              <th className="py-1.5 pr-2 text-right">Taux</th>
              <th className="py-1.5">Exécution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {lignes.map((l) => {
              const p = l.automatique ? null : prevu[l.categorie] ?? 0;
              const r = realiseMap.get(l.categorie) ?? 0;
              const taux = p && p > 0 ? Math.round((r / p) * 100) : null;
              const depasse = l.sens === "depense" && taux !== null && taux > 100;
              return (
                <tr key={l.categorie}>
                  <td className="py-2 pr-2">
                    <span className="font-medium text-forest-900">{l.categorie} — {l.libelle}</span>
                    {l.automatique && (
                      <span className="ml-1.5 rounded-full bg-cream-200 px-1.5 py-0.5 text-[10px] font-semibold text-ink-700/60">
                        Automatique
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {l.automatique ? (
                      <span className="text-xs italic text-ink-700/50">Automatique</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={prevu[l.categorie] ?? 0}
                        disabled={!peutEcrire}
                        onChange={(e) => onChange(l.categorie, e.target.value)}
                        className="w-32 rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-right text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-60"
                      />
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right">{fcfa(r)}</td>
                  <td className="py-2 pr-2 text-right text-xs text-ink-700/60">{taux === null ? "—" : `${taux}%`}</td>
                  <td className="py-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-cream-100">
                      <div
                        className={`h-full ${depasse ? "bg-red-500" : "bg-forest-500"}`}
                        style={{ width: `${taux === null ? 0 : Math.min(100, taux)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
