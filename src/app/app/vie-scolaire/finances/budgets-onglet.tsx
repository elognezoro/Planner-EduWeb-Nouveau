"use client";

/**
 * Onglet BUDGETS (16) : suivi temps réel VOTÉ / ENGAGÉ / CONSOMMÉ / DISPONIBLE (tout DÉRIVÉ),
 * enveloppes budgétaires (workflow préparation → vote → exécution → clôture), lignes
 * budgétaires (centre de coût), révisions (virements/rallonges/diminutions), engagements
 * manuels, centres de coûts/profits, recettes (centres de profit), SIMULATION sans impact,
 * rapport d'exécution imprimable A4. Confirmations 2 clics, jamais de dialogue natif.
 */

import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle, Ban, Check, ClipboardList, Coins, FileBarChart,
  FlaskConical, Layers, Pencil, PiggyBank, Plus, Printer, Send, Target, Trash2, TrendingUp, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import { CATEGORIES_OHADA } from "@/lib/finances/categories";
import type { EtatForm } from "@/lib/finances/actions";
import {
  changerStatutEngagement, cloturerBudget, cloturerLigneBudget, enregistrerBudgetEnveloppe,
  enregistrerCentreCout, enregistrerEngagementManuel, enregistrerLigneBudget, retirerBudget,
  retirerCentreCout, retirerLigneBudget, reviserBudget, soumettreBudget, voterBudget,
} from "@/lib/finances/actions-budgets";
import {
  LIBELLE_ETAT_BUDGET, LIBELLE_TYPE_BUDGET, SOURCES_ENGAGEMENT, TYPES_BUDGET, TYPES_REVISION,
  type BudgetEnveloppeVue, type CentreCoutVue, type DonneesBudgetVue, type LigneExecutionVue,
} from "@/lib/finances/budgets/types";
import type { EnteteEtablissement } from "./finances-vue";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces } from "./scolarite-onglets";
import { fcfa } from "./types";

const INITIAL: EtatForm = { ok: false };
const CATEGORIES_DEPENSE = CATEGORIES_OHADA.filter((c) => c.sens === "depense");
const CATEGORIES_RECETTE = CATEGORIES_OHADA.filter((c) => c.sens === "recette");
const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";
const pct = (n: number) => `${Math.round(n * 100)} %`;

export interface DroitsBudgetUi {
  gerer: boolean;
  reviser: boolean;
  voter: boolean;
}

type SectionBudget = "execution" | "enveloppes" | "lignes" | "engagements" | "centres" | "simulation";

export function OngletBudgets({
  etablissementId, donnees, entete, droits,
}: {
  etablissementId: string;
  donnees: DonneesBudgetVue;
  entete: EnteteEtablissement;
  droits: DroitsBudgetUi;
}) {
  const [section, setSection] = useState<SectionBudget>("execution");
  const [rapportOuvert, setRapportOuvert] = useState(false);
  const tb = donnees.tableauBord;

  const stats = [
    { libelle: "Voté (dépenses)", valeur: fcfa(tb.totalVote) },
    { libelle: "Engagé", valeur: fcfa(tb.totalEngage) },
    { libelle: "Consommé", valeur: fcfa(tb.totalConsomme) },
    { libelle: "Disponible", valeur: fcfa(tb.totalDisponible), alerte: tb.totalDisponible < 0 },
    { libelle: "Taux d'exécution", valeur: pct(tb.tauxExecution) },
    { libelle: "Lignes dépassées", valeur: String(tb.lignesDepassees), alerte: tb.lignesDepassees > 0 },
  ];

  const sections: { cle: SectionBudget; libelle: string; Icone: typeof Target }[] = [
    { cle: "execution", libelle: "Exécution", Icone: Target },
    { cle: "enveloppes", libelle: `Budgets votés (${donnees.enveloppes.length})`, Icone: Layers },
    { cle: "lignes", libelle: "Lignes & révisions", Icone: ClipboardList },
    { cle: "engagements", libelle: `Engagements (${donnees.engagementsManuels.filter((e) => e.statut === "actif").length})`, Icone: Coins },
    { cle: "centres", libelle: `Centres (${donnees.centres.length})`, Icone: PiggyBank },
    { cle: "simulation", libelle: "Simulation", Icone: FlaskConical },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.libelle} className="rounded-2xl border border-cream-200 bg-white p-3 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/55">{s.libelle}</p>
            <p className={`mt-1 font-display text-sm font-bold ${s.alerte ? "text-red-600" : "text-forest-900"}`}>{s.valeur}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <button
              key={s.cle}
              type="button"
              onClick={() => setSection(s.cle)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                section === s.cle ? "border-forest-700 bg-forest-800 text-cream-50" : "border-cream-300 bg-white text-ink-700/70 hover:bg-cream-100"
              }`}
            >
              <s.Icone size={13} /> {s.libelle}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setRapportOuvert(true)} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
          <FileBarChart size={13} /> Rapport d&apos;exécution
        </button>
      </div>

      {section === "execution" && <SectionExecution donnees={donnees} />}
      {section === "enveloppes" && <SectionEnveloppes etablissementId={etablissementId} donnees={donnees} droits={droits} />}
      {section === "lignes" && <SectionLignes etablissementId={etablissementId} donnees={donnees} droits={droits} />}
      {section === "engagements" && <SectionEngagements etablissementId={etablissementId} donnees={donnees} droits={droits} />}
      {section === "centres" && <SectionCentres etablissementId={etablissementId} donnees={donnees} droits={droits} />}
      {section === "simulation" && <SectionSimulation donnees={donnees} />}

      {rapportOuvert && <RapportExecution donnees={donnees} entete={entete} onFermer={() => setRapportOuvert(false)} />}
    </div>
  );
}

// ─── Exécution (le cœur : 4 agrégats dérivés) ───

function BarreExecution({ ligne }: { ligne: LigneExecutionVue }) {
  const base = Math.max(ligne.vote, ligne.engageBC + ligne.engageManuel + ligne.consomme, 1);
  const p = (n: number) => `${Math.min(100, Math.round((n / base) * 100))}%`;
  return (
    <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-cream-200">
      <span className="bg-forest-700" style={{ width: p(ligne.consomme) }} title="Consommé" />
      <span className="bg-gold-400" style={{ width: p(ligne.engageBC + ligne.engageManuel) }} title="Engagé" />
    </div>
  );
}

function SectionExecution({ donnees }: { donnees: DonneesBudgetVue }) {
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Target size={17} className="text-forest-600" /> Exécution des dépenses par catégorie
        </h3>
        <p className="mt-1 text-xs text-ink-700/60">
          Disponible = voté − engagé (bons de commande émis + engagements manuels) − consommé
          (factures validées + dépenses directes). Calcul en temps réel (RM-1300/1302/1303).
        </p>
        {donnees.execution.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucune ligne de dépense votée pour l&apos;exercice {donnees.exercice}.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
                  <th className="px-2 py-2">Catégorie</th>
                  <th className="px-2 py-2 text-right">Voté</th>
                  <th className="px-2 py-2 text-right">Engagé</th>
                  <th className="px-2 py-2 text-right">Consommé</th>
                  <th className="px-2 py-2 text-right">Disponible</th>
                  <th className="px-2 py-2 text-right">Taux</th>
                </tr>
              </thead>
              <tbody>
                {donnees.execution.map((l) => (
                  <tr key={l.categorie} className="border-b border-cream-100">
                    <td className="px-2 py-1.5 text-xs">
                      <span className="font-mono">{l.categorie}</span> — {l.libelle}
                      {l.centreCoutLibelle ? <span className="text-ink-700/50"> · {l.centreCoutLibelle}</span> : ""}
                      {l.depasse && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">DÉPASSÉ</span>}
                      {l.procheEpuisement && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Proche épuisement</span>}
                      {l.statut === "cloturee" && <span className="ml-1.5 rounded-full bg-cream-200 px-1.5 py-0.5 text-[10px] font-bold text-ink-700/60">clôturée</span>}
                      <BarreExecution ligne={l} />
                    </td>
                    <td className="px-2 py-1.5 text-right">{fcfa(l.vote)}</td>
                    <td className="px-2 py-1.5 text-right">{fcfa(l.engageBC + l.engageManuel)}</td>
                    <td className="px-2 py-1.5 text-right">{fcfa(l.consomme)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${l.disponible < 0 ? "text-red-600" : "text-forest-800"}`}>{fcfa(l.disponible)}</td>
                    <td className="px-2 py-1.5 text-right">{pct(l.tauxExecution)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-forest-200 font-bold">
                  <td className="px-2 py-2">Total dépenses</td>
                  <td className="px-2 py-2 text-right">{fcfa(donnees.tableauBord.totalVote)}</td>
                  <td className="px-2 py-2 text-right">{fcfa(donnees.tableauBord.totalEngage)}</td>
                  <td className="px-2 py-2 text-right">{fcfa(donnees.tableauBord.totalConsomme)}</td>
                  <td className="px-2 py-2 text-right">{fcfa(donnees.tableauBord.totalDisponible)}</td>
                  <td className="px-2 py-2 text-right">{pct(donnees.tableauBord.tauxExecution)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {donnees.recettes.length > 0 && (
        <Card>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <TrendingUp size={17} className="text-forest-600" /> Recettes (centres de profit)
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
                  <th className="px-2 py-2">Catégorie</th>
                  <th className="px-2 py-2 text-right">Prévu</th>
                  <th className="px-2 py-2 text-right">Réalisé</th>
                  <th className="px-2 py-2 text-right">Taux</th>
                </tr>
              </thead>
              <tbody>
                {donnees.recettes.map((r) => (
                  <tr key={r.categorie} className="border-b border-cream-100">
                    <td className="px-2 py-1.5 text-xs"><span className="font-mono">{r.categorie}</span> — {r.libelle}</td>
                    <td className="px-2 py-1.5 text-right">{fcfa(r.vote)}</td>
                    <td className="px-2 py-1.5 text-right">{fcfa(r.realise)}</td>
                    <td className="px-2 py-1.5 text-right">{pct(r.taux)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-forest-200 font-bold">
                  <td className="px-2 py-2">Total recettes</td>
                  <td className="px-2 py-2 text-right">{fcfa(donnees.tableauBord.totalVoteRecettes)}</td>
                  <td className="px-2 py-2 text-right">{fcfa(donnees.tableauBord.totalRealiseRecettes)}</td>
                  <td className="px-2 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Enveloppes (workflow) ───

function SectionEnveloppes({ etablissementId, donnees, droits }: { etablissementId: string; donnees: DonneesBudgetVue; droits: DroitsBudgetUi }) {
  const [enEdition, setEnEdition] = useState<BudgetEnveloppeVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerBudgetEnveloppe, INITIAL);
  useApresSucces(etat, () => { setEnEdition(null); setFormOuvert(false); });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Layers size={17} className="text-forest-600" /> Budgets votés ({donnees.enveloppes.length})
        </h3>
        {droits.gerer && (
          <button type="button" onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }} className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700">
            <Plus size={13} /> Nouveau budget
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-700/60">
        Workflow : brouillon → soumis → voté (par la direction, acteur distinct du préparateur) → exécution → clôture.
      </p>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}

      {droits.gerer && (formOuvert || enEdition) && (
        <form action={action} key={enEdition?.id ?? "nouveau"} className="mt-3 grid gap-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
          {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
          <div className="sm:col-span-2">
            <Label htmlFor="bu-libelle">Libellé *</Label>
            <Input id="bu-libelle" name="libelle" required maxLength={120} defaultValue={enEdition?.libelle ?? ""} />
          </div>
          <div>
            <Label htmlFor="bu-type">Type</Label>
            <Select id="bu-type" name="type" defaultValue={enEdition?.type ?? "fonctionnement"}>
              {TYPES_BUDGET.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Label htmlFor="bu-notes">Notes</Label>
            <Input id="bu-notes" name="notes" maxLength={400} defaultValue={enEdition?.notes ?? ""} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <SubmitButton>{enEdition ? "Mettre à jour" : "Créer le budget"}</SubmitButton>
            <button type="button" onClick={() => { setEnEdition(null); setFormOuvert(false); }} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">Abandonner</button>
            {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
          </div>
        </form>
      )}

      {donnees.enveloppes.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/60">Aucun budget voté — les lignes libres restent contrôlées par l&apos;exécution.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {donnees.enveloppes.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-sm">
              <span>
                <strong className="text-forest-900">{b.libelle}</strong>
                <span className="text-ink-700/55"> · {LIBELLE_TYPE_BUDGET[b.type] ?? b.type} · {b.nbLignes} ligne(s) · {fcfa(b.totalVote)}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.statut === "execution" ? "bg-forest-50 text-forest-800" : b.statut === "soumis" ? "bg-amber-50 text-amber-700" : b.statut === "cloture" ? "bg-cream-200 text-ink-700/60" : "bg-cream-200 text-forest-800"}`}>
                  {LIBELLE_ETAT_BUDGET[b.statut] ?? b.statut}
                </span>
                {b.voteParNom && <span className="ml-1.5 text-xs text-ink-700/55">voté par {b.voteParNom} le {dateFr(b.dateVote)}</span>}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {droits.gerer && b.statut === "brouillon" && (
                  <>
                    <button type="button" onClick={() => { setEnEdition(b); setFormOuvert(true); }} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"><Pencil size={11} /> Modifier</button>
                    <BoutonActionConfirmee libelle="Soumettre" icone={Send} ton="primaire" action={soumettreBudget} champs={{ etablissementId, id: b.id, version: String(b.version) }} onSucces={(m) => setMessage(m ?? "Soumis.")} />
                    <BoutonActionConfirmee libelle="Retirer" icone={Trash2} ton="danger" action={retirerBudget} champs={{ etablissementId, id: b.id, version: String(b.version) }} onSucces={(m) => setMessage(m ?? "Retiré.")} />
                  </>
                )}
                {droits.voter && b.statut === "soumis" && (
                  <>
                    <BoutonActionConfirmee libelle="Approuver (voter)" icone={Check} ton="primaire" action={voterBudget} champs={{ etablissementId, id: b.id, version: String(b.version), decision: "approuver" }} onSucces={(m) => setMessage(m ?? "Voté.")} />
                    <BoutonActionConfirmee libelle="Rejeter" icone={Ban} ton="danger" action={voterBudget} champs={{ etablissementId, id: b.id, version: String(b.version), decision: "rejeter" }} onSucces={(m) => setMessage(m ?? "Rejeté.")} />
                  </>
                )}
                {droits.voter && b.statut === "execution" && (
                  <BoutonActionConfirmee libelle="Clôturer" icone={Ban} ton="danger" action={cloturerBudget} champs={{ etablissementId, id: b.id, version: String(b.version) }} onSucces={(m) => setMessage(m ?? "Clôturé.")} />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Lignes & révisions ───

function SectionLignes({ etablissementId, donnees, droits }: { etablissementId: string; donnees: DonneesBudgetVue; droits: DroitsBudgetUi }) {
  const [message, setMessage] = useState<string | null>(null);
  const [etatLigne, actionLigne] = useActionState(enregistrerLigneBudget, INITIAL);
  useApresSucces(etatLigne, () => setMessage(etatLigne.message ?? "Ligne enregistrée."));
  const enveloppesBrouillon = donnees.enveloppes.filter((b) => b.statut === "brouillon");

  return (
    <div className="space-y-4">
      {droits.gerer && (
        <Card>
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <ClipboardList size={17} className="text-forest-600" /> Ajouter / modifier une ligne budgétaire
          </h3>
          <form action={actionLigne} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <div>
              <Label htmlFor="bl-sens">Sens</Label>
              <Select id="bl-sens" name="sens" defaultValue="depense">
                <option value="depense">Dépense</option>
                <option value="recette">Recette</option>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="bl-categorie">Catégorie OHADA</Label>
              <Select id="bl-categorie" name="categorie" required defaultValue="">
                <option value="" disabled>Choisir…</option>
                <optgroup label="Dépenses">
                  {CATEGORIES_DEPENSE.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
                </optgroup>
                <optgroup label="Recettes">
                  {CATEGORIES_RECETTE.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
                </optgroup>
              </Select>
            </div>
            <div>
              <Label htmlFor="bl-montant">Montant prévu (FCFA)</Label>
              <Input id="bl-montant" name="montantPrevu" type="number" min={0} required />
            </div>
            <div>
              <Label htmlFor="bl-centre">Centre de coût</Label>
              <Select id="bl-centre" name="centreCoutId" defaultValue="">
                <option value="">—</option>
                {donnees.centres.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="bl-enveloppe">Enveloppe (brouillon)</Label>
              <Select id="bl-enveloppe" name="budgetId" defaultValue="">
                <option value="">— Ligne libre —</option>
                {enveloppesBrouillon.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="bl-libelle">Libellé (facultatif)</Label>
              <Input id="bl-libelle" name="libelle" maxLength={120} />
            </div>
            <div className="flex items-end">
              <SubmitButton>Enregistrer la ligne</SubmitButton>
            </div>
            {etatLigne.message && <div className="sm:col-span-2 lg:col-span-4"><FormAlert ton={etatLigne.ok ? "succes" : "erreur"}>{etatLigne.message}</FormAlert></div>}
          </form>
          <p className="mt-2 text-[11px] text-ink-700/50">Une seule ligne par catégorie et sens et par exercice (les révisions ajustent le voté).</p>
        </Card>
      )}

      <Card>
        <h3 className="font-display text-base font-bold text-forest-900">Lignes de dépense &amp; révisions</h3>
        {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
        {donnees.execution.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700/60">Aucune ligne de dépense.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {donnees.execution.filter((l) => l.ligneId).map((l) => (
              <LigneBudgetItem key={l.ligneId} etablissementId={etablissementId} ligne={l} lignes={donnees.execution} droits={droits} onMessage={setMessage} />
            ))}
          </ul>
        )}
        {donnees.revisions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-forest-900">Historique des révisions</p>
            <ul className="mt-1.5 space-y-1 text-xs">
              {donnees.revisions.slice(0, 12).map((r) => (
                <li key={r.id} className="rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
                  <strong>{TYPES_REVISION.find((t) => t.code === r.type)?.libelle ?? r.type}</strong>
                  {r.categorie ? ` · ${r.categorie}` : ""} · {fcfa(r.montant)}
                  {r.montantAvant !== null && r.montantApres !== null ? ` (${fcfa(r.montantAvant)} → ${fcfa(r.montantApres)})` : ""}
                  {" — "}{r.motif}{r.parNom ? ` · ${r.parNom}` : ""} · {dateFr(r.date)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function LigneBudgetItem({
  etablissementId, ligne: l, lignes, droits, onMessage,
}: {
  etablissementId: string;
  ligne: LigneExecutionVue;
  lignes: LigneExecutionVue[];
  droits: DroitsBudgetUi;
  onMessage: (m: string | null) => void;
}) {
  const [revision, setRevision] = useState(false);
  const [type, setType] = useState("augmentation");
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [cible, setCible] = useState("");
  const autresLignes = lignes.filter((x) => x.ligneId && x.ligneId !== l.ligneId);
  return (
    <li className="rounded-xl border border-cream-200 bg-white px-3.5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-mono text-xs">{l.categorie}</span> — {l.libelle} · voté <strong>{fcfa(l.vote)}</strong>
          {l.montantInitial !== l.vote && <span className="text-ink-700/50"> (initial {fcfa(l.montantInitial)})</span>}
          {l.statut === "cloturee" && <span className="ml-1.5 rounded-full bg-cream-200 px-1.5 py-0.5 text-[10px] font-bold text-ink-700/60">clôturée</span>}
        </span>
        {droits.reviser && l.statut !== "cloturee" && (
          <button type="button" onClick={() => setRevision((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"><Coins size={11} /> Réviser</button>
        )}
        {droits.gerer && l.ligneId && l.statut !== "cloturee" && (
          <span className="flex gap-1.5">
            <BoutonActionConfirmee libelle="Clôturer" icone={Ban} action={cloturerLigneBudget} champs={{ etablissementId, id: l.ligneId, version: "0" }} onSucces={(m) => onMessage(m ?? "Clôturée.")} />
            <BoutonActionConfirmee libelle="Retirer" icone={Trash2} ton="danger" action={retirerLigneBudget} champs={{ etablissementId, id: l.ligneId, version: "0" }} onSucces={(m) => onMessage(m ?? "Retirée.")} />
          </span>
        )}
      </div>
      {revision && droits.reviser && l.ligneId && (
        <div className="mt-2 grid gap-2 rounded-lg bg-cream-50/70 p-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={type} onChange={(e) => setType(e.target.value)} className="h-8 text-xs">
            {TYPES_REVISION.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
          </Select>
          <Input type="number" min={1} value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant" className="h-8 text-xs" />
          {type === "virement" && (
            <Select value={cible} onChange={(e) => setCible(e.target.value)} className="h-8 text-xs">
              <option value="">Vers…</option>
              {autresLignes.map((x) => <option key={x.ligneId} value={x.ligneId!}>{x.categorie} — {x.libelle}</option>)}
            </Select>
          )}
          <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder="Motif *" className="h-8 text-xs sm:col-span-2" />
          <BoutonActionConfirmee
            libelle="Appliquer la révision" icone={Check} ton="primaire" action={reviserBudget}
            champs={{ etablissementId, ligneId: l.ligneId, ligneCibleId: cible, type, montant, motif }}
            desactive={!montant || motif.trim().length === 0 || (type === "virement" && !cible)}
            onSucces={(m) => { onMessage(m ?? "Révisé."); setRevision(false); setMontant(""); setMotif(""); setCible(""); }}
          />
        </div>
      )}
    </li>
  );
}

// ─── Engagements manuels ───

function SectionEngagements({ etablissementId, donnees, droits }: { etablissementId: string; donnees: DonneesBudgetVue; droits: DroitsBudgetUi }) {
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerEngagementManuel, INITIAL);
  useApresSucces(etat, () => setMessage(etat.message ?? "Engagement enregistré."));
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Coins size={17} className="text-forest-600" /> Engagements manuels (contrats, marchés, conventions)
      </h3>
      <p className="mt-1 text-xs text-ink-700/60">Réservent immédiatement des crédits (RM-1302) — ils s&apos;ajoutent aux bons de commande dans l&apos;engagé.</p>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
      {droits.reviser && (
        <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <div className="lg:col-span-2">
            <Label htmlFor="en-cat">Catégorie de dépense</Label>
            <Select id="en-cat" name="categorie" required defaultValue="">
              <option value="" disabled>Choisir…</option>
              {CATEGORIES_DEPENSE.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="en-montant">Montant (FCFA)</Label>
            <Input id="en-montant" name="montant" type="number" min={1} required />
          </div>
          <div>
            <Label htmlFor="en-source">Source</Label>
            <Select id="en-source" name="source" defaultValue="contrat">
              {SOURCES_ENGAGEMENT.map((s) => <option key={s.code} value={s.code}>{s.libelle}</option>)}
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="en-libelle">Libellé *</Label>
            <Input id="en-libelle" name="libelle" required maxLength={160} />
          </div>
          <div>
            <Label htmlFor="en-ref">Référence</Label>
            <Input id="en-ref" name="reference" maxLength={80} />
          </div>
          <div className="flex items-end">
            <SubmitButton>Engager</SubmitButton>
          </div>
          {etat.message && <div className="sm:col-span-2 lg:col-span-4"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
        </form>
      )}
      {donnees.engagementsManuels.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/60">Aucun engagement manuel.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-xs">
          {donnees.engagementsManuels.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cream-200 bg-white px-2.5 py-1.5">
              <span>
                <strong>{g.libelle}</strong> · {g.categorie} — {g.categorieLibelle} · {fcfa(g.montant)} · {g.source}
                {g.reference ? ` · ${g.reference}` : ""}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${g.statut === "actif" ? "bg-forest-50 text-forest-800" : "bg-cream-200 text-ink-700/60"}`}>{g.statut}</span>
              </span>
              {droits.reviser && g.statut === "actif" && (
                <span className="flex gap-1.5">
                  <BoutonActionConfirmee libelle="Solder" icone={Check} action={changerStatutEngagement} champs={{ etablissementId, id: g.id, version: String(g.version), statut: "solde" }} onSucces={(m) => setMessage(m ?? "Soldé.")} />
                  <BoutonActionConfirmee libelle="Annuler" icone={Ban} ton="danger" action={changerStatutEngagement} champs={{ etablissementId, id: g.id, version: String(g.version), statut: "annule" }} onSucces={(m) => setMessage(m ?? "Annulé.")} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Centres de coûts / profits ───

function SectionCentres({ etablissementId, donnees, droits }: { etablissementId: string; donnees: DonneesBudgetVue; droits: DroitsBudgetUi }) {
  const [enEdition, setEnEdition] = useState<CentreCoutVue | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerCentreCout, INITIAL);
  useApresSucces(etat, () => setEnEdition(null));
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <PiggyBank size={17} className="text-forest-600" /> Centres de coûts &amp; de profits
      </h3>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
      {droits.gerer && (
        <form action={action} key={enEdition?.id ?? "nouveau"} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
          {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
          <div>
            <Label htmlFor="cc-code">Code</Label>
            <Input id="cc-code" name="code" required maxLength={20} defaultValue={enEdition?.code ?? ""} />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="cc-libelle">Libellé</Label>
            <Input id="cc-libelle" name="libelle" required maxLength={80} defaultValue={enEdition?.libelle ?? ""} />
          </div>
          <div>
            <Label htmlFor="cc-type">Type</Label>
            <Select id="cc-type" name="type" defaultValue={enEdition?.type ?? "cout"}>
              <option value="cout">Centre de coût</option>
              <option value="profit">Centre de profit</option>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <SubmitButton>{enEdition ? "Mettre à jour" : "Créer le centre"}</SubmitButton>
            {enEdition && <button type="button" onClick={() => setEnEdition(null)} className="rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-ink-700/70 hover:bg-cream-100">Abandonner</button>}
            {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
          </div>
        </form>
      )}
      {donnees.centres.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/60">Aucun centre défini.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {donnees.centres.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-3 py-1.5">
              <span><strong>{c.code}</strong> — {c.libelle} <span className="text-ink-700/50">({c.type === "profit" ? "profit" : "coût"})</span></span>
              {droits.gerer && (
                <>
                  <button type="button" onClick={() => setEnEdition(c)} className="text-forest-700 hover:text-forest-900" aria-label="Modifier"><Pencil size={12} /></button>
                  <BoutonActionConfirmee libelle="" icone={Trash2} ton="danger" action={retirerCentreCout} champs={{ etablissementId, id: c.id, version: String(c.version) }} onSucces={(m) => setMessage(m ?? "Retiré.")} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Simulation (client pur — aucun impact sur le budget réel) ───

function SectionSimulation({ donnees }: { donnees: DonneesBudgetVue }) {
  const [variation, setVariation] = useState(0);
  const [categorie, setCategorie] = useState(donnees.execution[0]?.categorie ?? "");
  const [montant, setMontant] = useState("");
  const ligne = donnees.execution.find((l) => l.categorie === categorie);
  const simule = useMemo(() => {
    if (!ligne) return null;
    const voteSimule = Math.round(ligne.vote * (1 + variation / 100));
    const nouvelEngagement = Math.trunc(Number(montant)) || 0;
    const disponible = voteSimule - ligne.engageBC - ligne.engageManuel - ligne.consomme - nouvelEngagement;
    return { voteSimule, disponible };
  }, [ligne, variation, montant]);
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <FlaskConical size={17} className="text-forest-600" /> Simulation (sans impact sur le budget réel)
      </h3>
      <p className="mt-1 text-xs text-ink-700/60">Testez l&apos;effet d&apos;une variation de crédits ou d&apos;un nouvel engagement — rien n&apos;est enregistré.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="si-cat">Catégorie</Label>
          <Select id="si-cat" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {donnees.execution.map((l) => <option key={l.categorie} value={l.categorie}>{l.categorie} — {l.libelle}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="si-var">Variation du voté (%)</Label>
          <Input id="si-var" type="number" value={variation} onChange={(e) => setVariation(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label htmlFor="si-eng">Nouvel engagement (FCFA)</Label>
          <Input id="si-eng" type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} />
        </div>
      </div>
      {ligne && simule && (
        <div className="mt-3 rounded-xl border border-forest-200 bg-cream-50/60 p-3 text-sm">
          <p>Voté simulé : <strong>{fcfa(simule.voteSimule)}</strong> (actuel {fcfa(ligne.vote)})</p>
          <p>Engagé + consommé : {fcfa(ligne.engageBC + ligne.engageManuel + ligne.consomme)}{Number(montant) ? ` + ${fcfa(Math.trunc(Number(montant)))} simulé` : ""}</p>
          <p className={simule.disponible < 0 ? "font-bold text-red-600" : "font-bold text-forest-800"}>
            Disponible simulé : {fcfa(simule.disponible)}{simule.disponible < 0 && <span className="inline-flex items-center gap-1"><AlertTriangle size={13} /> dépassement</span>}
          </p>
        </div>
      )}
    </Card>
  );
}

// ─── Rapport d'exécution imprimable A4 ───

function RapportExecution({ donnees, entete, onFermer }: { donnees: DonneesBudgetVue; entete: EnteteEtablissement; onFermer: () => void }) {
  const tb = donnees.tableauBord;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`@media print { body * { visibility: hidden; } #rapport-budget-impression, #rapport-budget-impression * { visibility: visible; } #rapport-budget-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; overflow: visible; } @page { size: A4 landscape; margin: 12mm; } }`}</style>
      <div id="rapport-budget-impression" className="mx-auto my-8 w-full max-w-4xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Rapport d&apos;exécution budgétaire</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100" aria-label="Fermer"><X size={16} /></button>
        </div>
        <EnTeteOfficielDoc etab={entete} titre="RAPPORT D'EXÉCUTION BUDGÉTAIRE" sousTitre={`Exercice ${donnees.exercice} — taux d'exécution ${pct(tb.tauxExecution)}`} />
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-y-2 border-forest-800 text-left uppercase tracking-wide">
              <th className="py-1.5 pr-2">Catégorie</th>
              <th className="py-1.5 pr-2 text-right">Voté</th>
              <th className="py-1.5 pr-2 text-right">Engagé</th>
              <th className="py-1.5 pr-2 text-right">Consommé</th>
              <th className="py-1.5 pr-2 text-right">Disponible</th>
              <th className="py-1.5 text-right">Taux</th>
            </tr>
          </thead>
          <tbody>
            {donnees.execution.map((l) => (
              <tr key={l.categorie} className="border-b border-cream-200">
                <td className="py-1 pr-2">{l.categorie} — {l.libelle}</td>
                <td className="py-1 pr-2 text-right">{fcfa(l.vote)}</td>
                <td className="py-1 pr-2 text-right">{fcfa(l.engageBC + l.engageManuel)}</td>
                <td className="py-1 pr-2 text-right">{fcfa(l.consomme)}</td>
                <td className="py-1 pr-2 text-right">{fcfa(l.disponible)}</td>
                <td className="py-1 text-right">{pct(l.tauxExecution)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-forest-800 font-bold">
              <td className="py-2 pr-2">Total dépenses</td>
              <td className="py-2 pr-2 text-right">{fcfa(tb.totalVote)}</td>
              <td className="py-2 pr-2 text-right">{fcfa(tb.totalEngage)}</td>
              <td className="py-2 pr-2 text-right">{fcfa(tb.totalConsomme)}</td>
              <td className="py-2 pr-2 text-right">{fcfa(tb.totalDisponible)}</td>
              <td className="py-2 text-right">{pct(tb.tauxExecution)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-sm">Recettes : réalisé {fcfa(tb.totalRealiseRecettes)} sur {fcfa(tb.totalVoteRecettes)} prévus.</p>
        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700"><Printer size={16} /> Imprimer / PDF</button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">Fermer</button>
        </div>
      </div>
    </div>
  );
}
