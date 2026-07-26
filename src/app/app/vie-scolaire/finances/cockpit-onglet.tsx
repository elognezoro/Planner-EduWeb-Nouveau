"use client";

/**
 * COCKPIT décisionnel (19) — enrichit l'onglet « Tableau de bord ». Il AGRÈGE les vues déjà
 * chargées par la page (aucune requête dupliquée) : score global de santé financière et par
 * domaine, KPI exécutifs, courbe d'évolution mensuelle (Recharts), répartition des dépenses,
 * centre d'alertes consolidé avec drill-down vers les onglets. La visibilité d'un domaine
 * découle du RBAC (donnée présente ⟺ droit de lecture — RM-1600). Projection indicative de
 * tendance (l'analyse prédictive IA viendra avec le 21) affichée comme telle (RM-1605).
 */

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, Banknote, Boxes, Building2, Calculator, GraduationCap,
  PiggyBank, ShoppingCart, TrendingUp, Wallet,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import {
  scoreAchats, scoreBudget, scoreComptabilite, scoreDepenses, scorePatrimoine, scoreRecouvrement,
  scoreStocks, scoreTresorerie, tonScore,
  type AlerteCockpit, type DomaineSante, type SerieMois,
} from "@/lib/finances/tableau-bord/catalogue";
import type { KpiFinances } from "./finances-vue";
import type { RecouvrementVue } from "@/lib/finances/scolarite/types";
import type { TableauBordBanqueVue } from "@/lib/finances/banque/types";
import type { TableauBordCaisseVue } from "@/lib/finances/caisse/types";
import type { DonneesBudgetVue } from "@/lib/finances/budgets/types";
import type { DonneesStocksVue } from "@/lib/finances/stocks/types";
import type { DonneesImmobilisationsVue } from "@/lib/finances/immobilisations/types";
import type { DonneesAchatsVue } from "@/lib/finances/achats/types";
import type { DonneesDepensesVue } from "@/lib/finances/depenses/types";
import type { RegistreComptableVue } from "@/lib/finances/comptabilite/types";
import { fcfa } from "./types";

const COULEURS = ["#246a48", "#c9a227", "#57a47b", "#e3b536", "#8cc4a4", "#ad821f", "#34855c", "#f4df8d"];
/** Formateur de tooltip tolérant au typage strict de Recharts 3 (valeur possiblement indéfinie). */
const fmtTooltip = (v: unknown) => fcfa(Math.trunc(Number(v) || 0));
const tooltipStyle = { borderRadius: 12, border: "1px solid #e9dcbe", fontSize: 13 };
const axisStyle = { fontSize: 11, fill: "#2b3a33" };
const TON_CLASSE: Record<string, string> = {
  bon: "text-forest-700",
  moyen: "text-gold-700",
  faible: "text-red-600",
};

export function Cockpit({
  serieMensuelle, kpi, recouvrement, tableauBordBanque, tableauBordCaisses, donneesBudget,
  donneesStocks, donneesImmobilisations, donneesAchats, donneesDepenses, registreCompta,
  onNaviguer,
}: {
  serieMensuelle: SerieMois[];
  kpi: KpiFinances;
  recouvrement: RecouvrementVue;
  tableauBordBanque: TableauBordBanqueVue | null;
  tableauBordCaisses: TableauBordCaisseVue | null;
  donneesBudget: DonneesBudgetVue | null;
  donneesStocks: DonneesStocksVue | null;
  donneesImmobilisations: DonneesImmobilisationsVue | null;
  donneesAchats: DonneesAchatsVue | null;
  donneesDepenses: DonneesDepensesVue | null;
  registreCompta: RegistreComptableVue | null;
  onNaviguer: (onglet: string) => void;
}) {
  const { domaines, scoreGlobal, alertes } = useMemo(() => {
    const dom: DomaineSante[] = [];
    const al: AlerteCockpit[] = [];

    // Trésorerie
    if (tableauBordBanque || tableauBordCaisses) {
      const solde = (tableauBordBanque?.soldeGlobal ?? 0) + (tableauBordCaisses?.montantEnCaisse ?? 0);
      dom.push({ code: "tresorerie", libelle: "Trésorerie", score: scoreTresorerie(tableauBordBanque, tableauBordCaisses), onglet: "banques", details: `Solde global ${fcfa(solde)}` });
      if (solde < 0) al.push({ domaine: "Trésorerie", niveau: "critique", message: "Solde de trésorerie négatif.", onglet: "banques" });
      if ((tableauBordBanque?.depotsEnAttente ?? 0) > 0) al.push({ domaine: "Trésorerie", niveau: "info", message: `${tableauBordBanque?.depotsEnAttente} dépôt(s) de caisse en attente de confirmation.`, onglet: "banques" });
    }
    // Budget
    if (donneesBudget) {
      const tb = donneesBudget.tableauBord;
      dom.push({ code: "budget", libelle: "Budget", score: scoreBudget(tb), onglet: "budget", details: `Exécution ${Math.round(tb.tauxExecution * 100)} %` });
      if (tb.lignesDepassees > 0) al.push({ domaine: "Budget", niveau: "critique", message: `${tb.lignesDepassees} ligne(s) budgétaire(s) dépassée(s).`, onglet: "budget" });
      if (tb.lignesProchesEpuisement > 0) al.push({ domaine: "Budget", niveau: "attention", message: `${tb.lignesProchesEpuisement} ligne(s) proche(s) de l'épuisement.`, onglet: "budget" });
    }
    // Recouvrement (scolarité) — toujours disponible
    dom.push({ code: "recouvrement", libelle: "Recouvrement", score: scoreRecouvrement(recouvrement), onglet: "scolarite", details: `Taux ${recouvrement.taux} % · reste ${fcfa(recouvrement.reste)}` });
    if (recouvrement.taux < 50) al.push({ domaine: "Recouvrement", niveau: "attention", message: `Taux de recouvrement faible (${recouvrement.taux} %).`, onglet: "scolarite" });
    // Comptabilité
    if (registreCompta) {
      const b = registreCompta.tableauBord.brouillons;
      dom.push({ code: "comptabilite", libelle: "Comptabilité", score: scoreComptabilite(b), onglet: "comptabilite", details: `${registreCompta.tableauBord.totalEcritures} écriture(s) · ${b} brouillon(s)` });
      if (b > 0) al.push({ domaine: "Comptabilité", niveau: "info", message: `${b} écriture(s) en brouillon à valider.`, onglet: "comptabilite" });
    }
    // Stocks
    if (donneesStocks) {
      const tb = donneesStocks.tableauBord;
      dom.push({ code: "stocks", libelle: "Stocks", score: scoreStocks(tb), onglet: "economat", details: `Valeur ${fcfa(tb.valeurTotale)}` });
      if (tb.nbRuptures > 0) al.push({ domaine: "Stocks", niveau: "attention", message: `${tb.nbRuptures} article(s) en rupture.`, onglet: "economat" });
      if (tb.nbLotsPerimes > 0) al.push({ domaine: "Stocks", niveau: "attention", message: `${tb.nbLotsPerimes} lot(s) périmé(s).`, onglet: "economat" });
    }
    // Patrimoine
    if (donneesImmobilisations) {
      const tb = donneesImmobilisations.tableauBord;
      dom.push({ code: "patrimoine", libelle: "Patrimoine", score: scorePatrimoine(tb), onglet: "immobilisations", details: `VNC ${fcfa(tb.valeurNette)}` });
      if (tb.garantiesExpirant > 0) al.push({ domaine: "Patrimoine", niveau: "info", message: `${tb.garantiesExpirant} garantie(s) proche(s) d'expiration.`, onglet: "immobilisations" });
      if (tb.dotationsDues > 0) al.push({ domaine: "Patrimoine", niveau: "info", message: `${tb.dotationsDues} dotation(s) d'amortissement à comptabiliser.`, onglet: "immobilisations" });
    }
    // Achats
    if (donneesAchats) {
      const tb = donneesAchats.tableauBord;
      dom.push({ code: "achats", libelle: "Achats", score: scoreAchats(tb), onglet: "achats", details: `${tb.bonsEnCours} commande(s) en cours` });
      if (tb.bonsEnRetard > 0) al.push({ domaine: "Achats", niveau: "attention", message: `${tb.bonsEnRetard} commande(s) en retard de livraison.`, onglet: "achats" });
      if (tb.facturesEchues > 0) al.push({ domaine: "Achats", niveau: "attention", message: `${tb.facturesEchues} facture(s) fournisseur échue(s).`, onglet: "achats" });
    }
    // Dépenses
    if (donneesDepenses) {
      const tb = donneesDepenses.tableauBord;
      dom.push({ code: "depenses", libelle: "Dépenses", score: scoreDepenses(tb), onglet: "depenses", details: `${tb.enAttente} en attente · ${tb.approuveesNonPayees} à payer` });
      if (tb.avancesEnCours > 0) al.push({ domaine: "Dépenses", niveau: "info", message: `${tb.avancesEnCours} avance(s) à régulariser.`, onglet: "depenses" });
      if (tb.recurrentesDues > 0) al.push({ domaine: "Dépenses", niveau: "attention", message: `${tb.recurrentesDues} dépense(s) récurrente(s) due(s).`, onglet: "depenses" });
    }

    const scoreGlobalCalc = dom.length > 0 ? Math.round(dom.reduce((s, d) => s + d.score, 0) / dom.length) : 100;
    const ordreNiveau = { critique: 0, attention: 1, info: 2 };
    al.sort((a, b) => ordreNiveau[a.niveau] - ordreNiveau[b.niveau]);
    return { domaines: dom, scoreGlobal: scoreGlobalCalc, alertes: al };
  }, [serieMensuelle, kpi, recouvrement, tableauBordBanque, tableauBordCaisses, donneesBudget, donneesStocks, donneesImmobilisations, donneesAchats, donneesDepenses, registreCompta]);

  const repartitionDepenses = useMemo(
    () => kpi.categoriesOhada.filter((c) => c.sens === "depense" && c.total > 0).map((c) => ({ nom: c.libelle, total: c.total })),
    [kpi],
  );

  // Projection indicative (tendance des 3 derniers mois) — non IA, consultative (RM-1605).
  const projection = useMemo(() => {
    const derniers = serieMensuelle.slice(-3);
    if (derniers.length === 0) return null;
    const moyR = derniers.reduce((s, m) => s + m.recettes, 0) / derniers.length;
    const moyD = derniers.reduce((s, m) => s + m.depenses, 0) / derniers.length;
    const moisRestants = 12 - new Date().getUTCMonth() - 1;
    return { recettes: Math.round(moyR * moisRestants), depenses: Math.round(moyD * moisRestants) };
  }, [serieMensuelle]);

  const iconeDomaine: Record<string, typeof Wallet> = {
    tresorerie: Wallet, budget: PiggyBank, recouvrement: GraduationCap, comptabilite: Calculator,
    stocks: Boxes, patrimoine: Building2, achats: ShoppingCart, depenses: Banknote,
  };

  return (
    <div className="space-y-5">
      {/* Cockpit exécutif : score global + santé par domaine */}
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex flex-col items-center">
            <div className={`flex h-24 w-24 items-center justify-center rounded-full border-4 ${scoreGlobal >= 85 ? "border-forest-500" : scoreGlobal >= 60 ? "border-gold-400" : "border-red-400"}`}>
              <span className={`font-display text-3xl font-bold ${TON_CLASSE[tonScore(scoreGlobal)]}`}>{scoreGlobal}</span>
            </div>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700/70"><Activity size={13} /> Santé globale</p>
          </div>
          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {domaines.map((d) => {
              const Icone = iconeDomaine[d.code] ?? Activity;
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => onNaviguer(d.onglet)}
                  className="group rounded-2xl border border-cream-200 bg-white p-3 text-left transition-colors hover:bg-cream-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700/70"><Icone size={13} /> {d.libelle}</span>
                    <span className={`font-display text-lg font-bold ${TON_CLASSE[tonScore(d.score)]}`}>{d.score}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
                    <span className={`block h-full rounded-full ${d.score >= 85 ? "bg-forest-500" : d.score >= 60 ? "bg-gold-400" : "bg-red-400"}`} style={{ width: `${d.score}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-700/55">{d.details}</p>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Évolution mensuelle */}
        <Card className="lg:col-span-2">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <TrendingUp size={17} className="text-forest-600" /> Évolution sur 12 mois
          </h3>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={serieMensuelle} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9dcbe" />
                <XAxis dataKey="libelle" tick={axisStyle} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} width={40} />
                <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
                <Line type="monotone" dataKey="recettes" name="Recettes" stroke="#246a48" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="depenses" name="Dépenses" stroke="#c9a227" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-forest-700" /> Recettes</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gold-500" /> Dépenses</span>
            </div>
            {projection && (
              <p className="mt-2 text-[11px] italic text-ink-700/55">
                Projection indicative (tendance des 3 derniers mois, hors saisonnalité) — reste de l&apos;année : recettes ~{fcfa(projection.recettes)}, dépenses ~{fcfa(projection.depenses)}. Analyse IA à venir (21).
              </p>
            )}
          </div>
        </Card>

        {/* Répartition des dépenses */}
        <Card>
          <h3 className="font-display text-base font-bold text-forest-900">Répartition des dépenses</h3>
          {repartitionDepenses.length === 0 ? (
            <p className="mt-3 text-sm text-ink-700/60">Aucune dépense enregistrée.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie data={repartitionDepenses} dataKey="total" nameKey="nom" cx="50%" cy="50%" innerRadius={44} outerRadius={76} paddingAngle={2}>
                    {repartitionDepenses.map((_, i) => <Cell key={i} fill={COULEURS[i % COULEURS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px]">
                {repartitionDepenses.slice(0, 6).map((d, i) => (
                  <span key={d.nom} className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COULEURS[i % COULEURS.length] }} />
                    <span className="text-ink-700/70">{d.nom}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Centre d'alertes consolidé */}
      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <AlertTriangle size={17} className="text-forest-600" /> Centre d&apos;alertes ({alertes.length})
        </h3>
        {alertes.length === 0 ? (
          <p className="mt-3 text-sm text-forest-700">Aucune alerte : tous les indicateurs sont au vert.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alertes.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white px-3.5 py-2.5">
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${a.niveau === "critique" ? "bg-red-500" : a.niveau === "attention" ? "bg-gold-500" : "bg-forest-400"}`} />
                  <strong className="text-forest-900">{a.domaine}</strong>
                  <span className="text-ink-700/70">{a.message}</span>
                </span>
                <button type="button" onClick={() => onNaviguer(a.onglet)} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50">
                  Voir <ArrowRight size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
