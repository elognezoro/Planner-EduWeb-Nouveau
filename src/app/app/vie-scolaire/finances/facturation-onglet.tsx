"use client";

/**
 * Onglet FACTURATION (07) : tableau de bord, création (manuelle ou depuis les créances du 06),
 * cycle de vie (brouillon → validation → émission → payée/soldée), avoirs, notes de débit,
 * annulation motivée, facture imprimable (PDF via impression navigateur, patron des reçus).
 * Confirmations 2 clics — jamais de window.confirm (aperçus statiques).
 */

import { useActionState, useMemo, useState } from "react";
import {
  Ban, CalendarClock, CheckCircle2, FilePlus2, FileText, Gauge, Loader2, Pencil, Printer,
  Receipt, Scale, Send, ShieldCheck, Stamp, Wallet, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import { EnTeteOfficielDoc } from "@/components/app/en-tete-officiel-doc";
import type { EtatForm } from "@/lib/finances/actions";
import {
  annulerAvoir, annulerFacture, annulerNoteDebit, archiverFacture, creerAvoir, creerFacture,
  creerNoteDebit, emettreFacture, facturerCreances, modifierFacture, reprendreFacture,
  soumettreFacture, suspendreFacture, validerFacture,
} from "@/lib/finances/actions-facturation";
import {
  LIBELLE_STATUT_FACTURE,
  type FactureVue, type StatistiquesFacturationVue, type StatutFactureAffiche,
} from "@/lib/finances/facturation/types";
import type { EnteteEtablissement } from "./finances-vue";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { SelecteurEleve, nombreEnLettres, useApresSucces } from "./scolarite-onglets";
import { fcfa, type EleveVue } from "./types";

const INITIAL: EtatForm = { ok: false };

const TON_STATUT: Record<StatutFactureAffiche, string> = {
  brouillon: "bg-cream-200 text-ink-700/70",
  en_attente_validation: "bg-gold-100 text-gold-800",
  validee: "bg-forest-50 text-forest-700",
  emise: "bg-forest-100 text-forest-800",
  partiellement_payee: "bg-gold-100 text-gold-800",
  soldee: "bg-forest-100 text-forest-800",
  en_retard: "bg-red-100 text-red-700",
  suspendue: "bg-cream-200 text-ink-700/60",
  annulee: "bg-red-50 text-red-500 line-through",
  archivee: "bg-cream-200 text-ink-700/50",
};

function BadgeFacture({ statut }: { statut: StatutFactureAffiche }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TON_STATUT[statut]}`}>
      {LIBELLE_STATUT_FACTURE[statut]}
    </span>
  );
}

const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";

const capitaliser = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type LigneEdit = { libelle: string; quantite: string; prixUnitaire: string; remise: string; taxe: string };
const LIGNE_VIDE: LigneEdit = { libelle: "", quantite: "1", prixUnitaire: "", remise: "", taxe: "" };

// ─────────────────────────────────────────────────────────────
//  Onglet
// ─────────────────────────────────────────────────────────────

export function OngletFacturation({
  etablissementId, factures, stats, eleves, entete, exercice, peutEcrire,
}: {
  etablissementId: string;
  factures: FactureVue[];
  stats: StatistiquesFacturationVue;
  eleves: EleveVue[];
  entete: EnteteEtablissement;
  exercice: string;
  peutEcrire: boolean;
}) {
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [enEdition, setEnEdition] = useState<FactureVue | null>(null);

  return (
    <div className="space-y-5">
      <StatsFacturation stats={stats} exercice={exercice} />

      {peutEcrire && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
              <FilePlus2 size={18} className="text-forest-600" /> Nouvelle facture
            </h2>
            <button
              type="button"
              onClick={() => { setEnEdition(null); setCreationOuverte((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
            >
              <FilePlus2 size={14} /> {creationOuverte && !enEdition ? "Fermer" : "Créer une facture"}
            </button>
          </div>
          <BlocFacturerCreances etablissementId={etablissementId} eleves={eleves} />
          {(creationOuverte || enEdition) && (
            <div className="mt-4 rounded-2xl border border-cream-200 bg-cream-50/50 p-4">
              <FormulaireFacture
                key={enEdition?.id ?? "nouvelle"}
                etablissementId={etablissementId}
                eleves={eleves}
                factureEnEdition={enEdition}
                onSucces={() => { setCreationOuverte(false); setEnEdition(null); }}
              />
            </div>
          )}
        </Card>
      )}

      <ListeFactures
        factures={factures}
        entete={entete}
        peutEcrire={peutEcrire}
        onModifier={(f) => { setEnEdition(f); setCreationOuverte(true); }}
      />
    </div>
  );
}

function StatsFacturation({ stats, exercice }: { stats: StatistiquesFacturationVue; exercice: string }) {
  const cartes: { libelle: string; valeur: string; Icone: typeof FileText; ton?: "gold" | "rouge" }[] = [
    { libelle: "Factures émises", valeur: String(stats.nombre), Icone: FileText },
    { libelle: "Montant facturé (net)", valeur: fcfa(stats.montantFacture), Icone: Scale },
    { libelle: "Encaissé sur factures", valeur: fcfa(stats.montantEncaisse), Icone: Wallet },
    { libelle: "Reste à encaisser", valeur: fcfa(stats.resteAEncaisser), Icone: Receipt, ton: "gold" },
    { libelle: "Taux de paiement", valeur: `${stats.tauxPaiement} %`, Icone: Gauge },
    { libelle: "En retard", valeur: `${stats.enRetardNombre} · ${fcfa(stats.enRetardMontant)}`, Icone: CalendarClock, ton: "rouge" },
    { libelle: "Montants annulés", valeur: fcfa(stats.montantsAnnules), Icone: Ban, ton: "gold" },
    { libelle: "Avoirs émis", valeur: fcfa(stats.totalAvoirs), Icone: Stamp },
  ];
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        Facturation — exercice {exercice}
        {stats.brouillons > 0 && <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 font-bold text-gold-800">{stats.brouillons} en préparation</span>}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cartes.map((c) => (
          <div key={c.libelle} className="rounded-2xl border border-cream-200 bg-white p-3.5 shadow-soft">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${c.ton === "rouge" ? "bg-red-50 text-red-600" : c.ton === "gold" ? "bg-gold-100 text-gold-700" : "bg-forest-50 text-forest-700"}`}>
              <c.Icone size={15} />
            </span>
            <p className="mt-1.5 font-display text-base font-bold text-forest-900">{c.valeur}</p>
            <p className="text-xs text-ink-700/60">{c.libelle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlocFacturerCreances({ etablissementId, eleves }: { etablissementId: string; eleves: EleveVue[] }) {
  const [eleveId, setEleveId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        Facturer les créances ouvertes d&apos;un élève (06 → 07)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[260px] flex-1">
          <SelecteurEleve eleves={eleves} valeur={eleveId} onChange={setEleveId} name="eleveFacturation" />
        </div>
        <BoutonActionConfirmee
          libelle="Facturer les créances"
          icone={FileText}
          ton="primaire"
          action={facturerCreances}
          champs={{ etablissementId, eleveId }}
          desactive={!eleveId}
          onSucces={(m) => setMessage(m ?? null)}
        />
      </div>
      {message && <p className="mt-2 text-xs font-medium text-forest-700">{message}</p>}
      <p className="mt-2 text-xs text-ink-700/55">
        Regroupe en UNE facture (brouillon) toutes les créances non encore facturées de l&apos;exercice — idempotent.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Formulaire de facture (création manuelle / modification de brouillon)
// ─────────────────────────────────────────────────────────────

function FormulaireFacture({
  etablissementId, eleves, factureEnEdition, onSucces,
}: {
  etablissementId: string;
  eleves: EleveVue[];
  factureEnEdition: FactureVue | null;
  onSucces: () => void;
}) {
  const action = factureEnEdition ? modifierFacture : creerFacture;
  const [etat, formAction] = useActionState(action, INITIAL);
  const [eleveId, setEleveId] = useState(factureEnEdition?.eleveId ?? "");
  const [lignes, setLignes] = useState<LigneEdit[]>(
    factureEnEdition
      ? factureEnEdition.lignes.map((l) => ({
          libelle: l.libelle, quantite: String(l.quantite), prixUnitaire: String(l.prixUnitaire),
          remise: l.remise ? String(l.remise) : "", taxe: l.taxe ? String(l.taxe) : "",
        }))
      : [{ ...LIGNE_VIDE }],
  );
  useApresSucces(etat, onSucces);

  const lignesValides = lignes
    .filter((l) => l.libelle.trim() && Number(l.prixUnitaire) >= 0 && Number(l.quantite) >= 1)
    .map((l) => ({
      libelle: l.libelle.trim(),
      quantite: Number(l.quantite) || 1,
      prixUnitaire: Number(l.prixUnitaire) || 0,
      remise: Number(l.remise) || 0,
      taxe: Number(l.taxe) || 0,
    }));
  const total = lignesValides.reduce((s, l) => s + l.quantite * l.prixUnitaire - l.remise + l.taxe, 0);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {factureEnEdition && <input type="hidden" name="id" value={factureEnEdition.id} />}
      {factureEnEdition && <input type="hidden" name="version" value={factureEnEdition.version} />}
      <input type="hidden" name="lignes" value={JSON.stringify(lignesValides)} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}

      {!factureEnEdition && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Élève</Label>
            <SelecteurEleve eleves={eleves} valeur={eleveId} onChange={setEleveId} name="eleveId" />
          </div>
          <div>
            <Label htmlFor="fac-type">Type de document</Label>
            <Select id="fac-type" name="type" defaultValue="facture">
              <option value="facture">Facture</option>
              <option value="proforma">Proforma (informatif, sans suivi de paiement)</option>
            </Select>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="fac-objet">Objet</Label>
          <Input id="fac-objet" name="objet" required maxLength={200} defaultValue={factureEnEdition?.objet ?? ""} placeholder="Ex. : Frais de scolarité — 1er trimestre" />
        </div>
        <div>
          <Label htmlFor="fac-echeance">Échéance</Label>
          <Input id="fac-echeance" name="dateEcheance" type="date" defaultValue={factureEnEdition?.dateEcheance ? factureEnEdition.dateEcheance.slice(0, 10) : ""} />
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-cream-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Lignes (article, quantité, prix, remise, taxe)</p>
        {lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_4.5rem_7rem_6rem_6rem_auto] items-center gap-2">
            <input value={l.libelle} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)))} placeholder={`Ligne ${i + 1} — libellé`} maxLength={160} className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
            <input value={l.quantite} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, quantite: e.target.value.replace(/[^\d]/g, "") } : x)))} placeholder="Qté" inputMode="numeric" className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
            <input value={l.prixUnitaire} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, prixUnitaire: e.target.value.replace(/[^\d]/g, "") } : x)))} placeholder="Prix unitaire" inputMode="numeric" className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
            <input value={l.remise} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, remise: e.target.value.replace(/[^\d]/g, "") } : x)))} placeholder="Remise" inputMode="numeric" className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
            <input value={l.taxe} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, taxe: e.target.value.replace(/[^\d]/g, "") } : x)))} placeholder="Taxe" inputMode="numeric" className="rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
            <button type="button" onClick={() => setLignes(lignes.filter((_, j) => j !== i))} title="Retirer la ligne" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50">
              <X size={14} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => lignes.length < 50 && setLignes([...lignes, { ...LIGNE_VIDE }])} className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 hover:underline">
            <FilePlus2 size={13} /> Ajouter une ligne
          </button>
          <p className="text-sm font-bold text-forest-900">Total TTC : {fcfa(total)}</p>
        </div>
      </div>

      <div>
        <Label htmlFor="fac-observations">Observations (facultatif)</Label>
        <Input id="fac-observations" name="observations" maxLength={500} defaultValue={factureEnEdition?.observations ?? ""} placeholder="Mentions particulières portées sur la facture" />
      </div>

      <SubmitButton className="w-auto px-6">
        {factureEnEdition ? <><Pencil size={15} /> Enregistrer le brouillon</> : <><FilePlus2 size={15} /> Créer (brouillon)</>}
      </SubmitButton>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  Liste des factures + détail + actions de cycle de vie
// ─────────────────────────────────────────────────────────────

function ListeFactures({
  factures, entete, peutEcrire, onModifier,
}: {
  factures: FactureVue[];
  entete: EnteteEtablissement;
  peutEcrire: boolean;
  onModifier: (f: FactureVue) => void;
}) {
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [aImprimer, setAImprimer] = useState<FactureVue | null>(null);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return factures.filter((f) => {
      if (filtreStatut !== "tous" && f.statutAffiche !== filtreStatut) return false;
      if (!q) return true;
      return (
        f.eleveNom.toLowerCase().includes(q) ||
        (f.numero ?? "").toLowerCase().includes(q) ||
        f.objet.toLowerCase().includes(q) ||
        (f.matricule ?? "").toLowerCase().includes(q) ||
        (f.classe ?? "").toLowerCase().includes(q)
      );
    });
  }, [factures, recherche, filtreStatut]);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileText size={18} className="text-forest-600" /> Factures
          <span className="text-xs font-normal text-ink-700/55">({filtrees.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="w-auto">
            <option value="tous">Tous les états</option>
            {Object.entries(LIBELLE_STATUT_FACTURE).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
          <input
            value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (élève, n°, objet, classe, matricule)…"
            className="h-9 min-w-[220px] rounded-xl border border-cream-300 bg-white px-3 text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
        </div>
      </div>

      {filtrees.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucune facture ne correspond.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                <th className="py-1.5 pr-2">N°</th>
                <th className="py-1.5 pr-2">Élève</th>
                <th className="py-1.5 pr-2">Objet</th>
                <th className="py-1.5 pr-2 text-right">Net dû</th>
                <th className="py-1.5 pr-2 text-right">Payé</th>
                <th className="py-1.5 pr-2">Échéance</th>
                <th className="py-1.5 pr-2">État</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {filtrees.map((f) => (
                <LigneFactureTableau
                  key={f.id}
                  facture={f}
                  ouverte={ouverte === f.id}
                  onBasculer={() => setOuverte(ouverte === f.id ? null : f.id)}
                  onImprimer={() => setAImprimer(f)}
                  onModifier={() => onModifier(f)}
                  peutEcrire={peutEcrire}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aImprimer && <ApercuFacture facture={aImprimer} entete={entete} onFermer={() => setAImprimer(null)} />}
    </Card>
  );
}

function LigneFactureTableau({
  facture: f, ouverte, onBasculer, onImprimer, onModifier, peutEcrire,
}: {
  facture: FactureVue;
  ouverte: boolean;
  onBasculer: () => void;
  onImprimer: () => void;
  onModifier: () => void;
  peutEcrire: boolean;
}) {
  return (
    <>
      <tr className={f.statut === "annulee" ? "opacity-60" : ""}>
        <td className="py-2 pr-2 font-mono text-xs text-ink-700/70">
          {f.numero ?? "—"}
          {f.type === "proforma" && <span className="ml-1 rounded-full bg-cream-200 px-1.5 text-[10px] font-semibold">PRO</span>}
        </td>
        <td className="py-2 pr-2">
          <p className="font-medium text-forest-900">{f.eleveNom}</p>
          <p className="text-xs text-ink-700/55">{[f.classe, f.matricule].filter(Boolean).join(" · ") || "—"}</p>
        </td>
        <td className="py-2 pr-2">{f.objet}</td>
        <td className="py-2 pr-2 text-right font-medium">{fcfa(f.netDu)}</td>
        <td className="py-2 pr-2 text-right text-forest-700">{f.type === "proforma" ? "—" : fcfa(f.paye)}</td>
        <td className="py-2 pr-2 whitespace-nowrap">
          {dateFr(f.dateEcheance)}
          {f.joursRetard > 0 && <span className="ml-1 text-xs font-semibold text-red-600">(+{f.joursRetard} j)</span>}
        </td>
        <td className="py-2 pr-2"><BadgeFacture statut={f.statutAffiche} /></td>
        <td className="py-2 text-right whitespace-nowrap">
          <button type="button" onClick={onImprimer} title="Imprimer" className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-forest-700 hover:bg-forest-50">
            <Printer size={13} />
          </button>
          <button type="button" onClick={onBasculer} className="rounded-full border border-cream-300 px-2.5 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50">
            {ouverte ? "Fermer" : "Détail"}
          </button>
        </td>
      </tr>
      {ouverte && (
        <tr>
          <td colSpan={8} className="bg-cream-50/50 px-3 py-3">
            <DetailFacture facture={f} onModifier={onModifier} peutEcrire={peutEcrire} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetailFacture({ facture: f, onModifier, peutEcrire }: { facture: FactureVue; onModifier: () => void; peutEcrire: boolean }) {
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [formOuvert, setFormOuvert] = useState<"avoir" | "note" | null>(null);
  const base = { id: f.id, version: String(f.version) };
  const modifiable = f.statut === "brouillon" || f.statut === "en_attente_validation";
  const annulable = !["soldee", "archivee", "annulee"].includes(f.statut);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-cream-200 bg-white p-3">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
              <th className="py-1 pr-2">Ligne</th>
              <th className="py-1 pr-2 text-right">Qté</th>
              <th className="py-1 pr-2 text-right">P.U.</th>
              <th className="py-1 pr-2 text-right">Remise</th>
              <th className="py-1 pr-2 text-right">Taxe</th>
              <th className="py-1 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {f.lignes.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5 pr-2">{l.libelle}{l.creanceId && <span className="ml-1 text-[10px] text-forest-600">(créance)</span>}</td>
                <td className="py-1.5 pr-2 text-right">{l.quantite}</td>
                <td className="py-1.5 pr-2 text-right">{fcfa(l.prixUnitaire)}</td>
                <td className="py-1.5 pr-2 text-right">{l.remise ? fcfa(l.remise) : "—"}</td>
                <td className="py-1.5 pr-2 text-right">{l.taxe ? fcfa(l.taxe) : "—"}</td>
                <td className="py-1.5 text-right font-medium">{fcfa(l.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-right text-sm">
          TTC : <strong>{fcfa(f.montantTotal)}</strong>
          {f.totalNotesDebit > 0 && <> · Notes de débit : <strong className="text-gold-800">+{fcfa(f.totalNotesDebit)}</strong></>}
          {f.totalAvoirs > 0 && <> · Avoirs : <strong className="text-red-700">−{fcfa(f.totalAvoirs)}</strong></>}
          {" "}· Net dû : <strong className="text-forest-900">{fcfa(f.netDu)}</strong>
          {f.type === "facture" && <> · Payé : <strong className="text-forest-700">{fcfa(f.paye)}</strong></>}
        </p>
        {f.motifAnnulation && <p className="mt-1 text-xs font-medium text-red-700">Annulée : {f.motifAnnulation}</p>}
        {f.observations && <p className="mt-1 text-xs italic text-ink-700/60">{f.observations}</p>}
      </div>

      {(f.avoirs.length > 0 || f.notesDebit.length > 0) && (
        <ul className="space-y-1 text-sm">
          {f.avoirs.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="font-mono text-xs">{a.numero}</span> — Avoir {a.type} de <strong>{fcfa(a.montant)}</strong> · {a.motif}</span>
              {peutEcrire && (
                <BoutonActionConfirmee libelle="Annuler l'avoir" icone={Ban} ton="danger" action={annulerAvoir} champs={{ id: a.id, version: String(a.version) }} />
              )}
            </li>
          ))}
          {f.notesDebit.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="font-mono text-xs">{n.numero}</span> — Note de débit « {n.libelle} » de <strong>{fcfa(n.montant)}</strong>{n.motif ? ` · ${n.motif}` : ""}</span>
              {peutEcrire && (
                <BoutonActionConfirmee libelle="Annuler la note" icone={Ban} ton="danger" action={annulerNoteDebit} champs={{ id: n.id, version: String(n.version) }} />
              )}
            </li>
          ))}
        </ul>
      )}

      {peutEcrire && (
        <div className="flex flex-wrap items-center gap-2">
          {modifiable && (
            <button type="button" onClick={onModifier} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
              <Pencil size={13} /> Modifier le brouillon
            </button>
          )}
          {f.statut === "brouillon" && (
            <BoutonActionConfirmee libelle="Soumettre à validation" icone={Send} action={soumettreFacture} champs={base} />
          )}
          {(f.statut === "brouillon" || f.statut === "en_attente_validation") && (
            <BoutonActionConfirmee libelle="Valider" icone={CheckCircle2} ton="primaire" action={validerFacture} champs={base} />
          )}
          {f.statut === "validee" && (
            <BoutonActionConfirmee libelle="Émettre (numéroter)" icone={ShieldCheck} ton="primaire" action={emettreFacture} champs={base} />
          )}
          {(f.statut === "emise" || f.statut === "partiellement_payee") && f.type === "facture" && (
            <>
              <BoutonActionConfirmee libelle="Suspendre" icone={Loader2} action={suspendreFacture} champs={base} />
              <button type="button" onClick={() => setFormOuvert(formOuvert === "avoir" ? null : "avoir")} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
                <Stamp size={13} /> Avoir
              </button>
              <button type="button" onClick={() => setFormOuvert(formOuvert === "note" ? null : "note")} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
                <FilePlus2 size={13} /> Note de débit
              </button>
            </>
          )}
          {f.statut === "soldee" && f.type === "facture" && (
            <>
              <button type="button" onClick={() => setFormOuvert(formOuvert === "avoir" ? null : "avoir")} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50">
                <Stamp size={13} /> Avoir
              </button>
              <BoutonActionConfirmee libelle="Archiver" icone={FileText} action={archiverFacture} champs={base} />
            </>
          )}
          {f.statut === "suspendue" && (
            <BoutonActionConfirmee libelle="Reprendre" icone={CheckCircle2} action={reprendreFacture} champs={base} />
          )}
          {annulable && (
            <span className="inline-flex items-center gap-1.5">
              <input
                value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)} maxLength={300}
                placeholder="Motif d'annulation…"
                className="h-8 w-48 rounded-xl border border-cream-300 bg-white px-2.5 text-xs outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
              <BoutonActionConfirmee
                libelle="Annuler la facture" icone={Ban} ton="danger"
                action={annulerFacture} champs={{ ...base, motif: motifAnnulation }} desactive={!motifAnnulation.trim()}
              />
            </span>
          )}
        </div>
      )}

      {peutEcrire && formOuvert === "avoir" && <FormAjustement facture={f} genre="avoir" onFermer={() => setFormOuvert(null)} />}
      {peutEcrire && formOuvert === "note" && <FormAjustement facture={f} genre="note" onFermer={() => setFormOuvert(null)} />}
    </div>
  );
}

function FormAjustement({ facture, genre, onFermer }: { facture: FactureVue; genre: "avoir" | "note"; onFermer: () => void }) {
  const [etat, action] = useActionState(genre === "avoir" ? creerAvoir : creerNoteDebit, INITIAL);
  useApresSucces(etat, onFermer);
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-cream-200 bg-white p-3">
      <input type="hidden" name="factureId" value={facture.id} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        {genre === "avoir" ? `Nouvel avoir (net dû actuel : ${fcfa(facture.netDu)})` : "Nouvelle note de débit"}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {genre === "note" && <Input name="libelle" required maxLength={160} placeholder="Libellé (ex. : pénalité, transport)" />}
        <Input name="montant" required inputMode="numeric" placeholder="Montant (F CFA)" />
        <Input name="motif" required={genre === "avoir"} maxLength={300} placeholder={genre === "avoir" ? "Motif (obligatoire)" : "Motif (facultatif)"} />
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton className="w-auto px-5">{genre === "avoir" ? "Créer l'avoir" : "Ajouter la note"}</SubmitButton>
        <button type="button" onClick={onFermer} className="h-9 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-700/70 hover:bg-cream-100">
          Fermer
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
//  Facture imprimable (PDF via impression navigateur — patron des reçus)
// ─────────────────────────────────────────────────────────────

function ApercuFacture({ facture: f, entete, onFermer }: { facture: FactureVue; entete: EnteteEtablissement; onFermer: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-950/50 p-4 backdrop-blur-sm print:static print:bg-white print:p-0 print:backdrop-blur-none">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #apercu-facture-impression, #apercu-facture-impression * { visibility: visible; }
          #apercu-facture-impression { position: fixed; inset: 0; margin: 0; box-shadow: none; border-radius: 0; }
          @page { size: A4 portrait; margin: 14mm; }
        }
      `}</style>
      <div id="apercu-facture-impression" className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-soft print:my-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-base font-bold text-forest-900">Aperçu de la facture</h2>
          <button type="button" onClick={onFermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100">
            <X size={18} />
          </button>
        </div>

        <EnTeteOfficielDoc
          etab={entete}
          titre={f.type === "proforma" ? "FACTURE PROFORMA" : "FACTURE"}
          sousTitre={`${f.numero ?? "Brouillon — sans valeur comptable"} · Exercice ${f.exercice}`}
        />

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Client (élève)</dt><dd className="font-semibold text-forest-900">{f.eleveNom}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Classe</dt><dd>{f.classe ?? "—"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Matricule</dt><dd>{f.matricule ?? "—"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Émise le</dt><dd>{dateFr(f.dateEmission)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Échéance</dt><dd>{dateFr(f.dateEcheance)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-700/60">Objet</dt><dd className="text-right">{f.objet}</dd></div>
        </dl>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-300 text-left text-xs uppercase tracking-wide text-ink-700/55">
              <th className="py-1.5 pr-2">Désignation</th>
              <th className="py-1.5 pr-2 text-right">Qté</th>
              <th className="py-1.5 pr-2 text-right">P.U.</th>
              <th className="py-1.5 pr-2 text-right">Remise</th>
              <th className="py-1.5 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {f.lignes.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5 pr-2">{l.libelle}</td>
                <td className="py-1.5 pr-2 text-right">{l.quantite}</td>
                <td className="py-1.5 pr-2 text-right">{fcfa(l.prixUnitaire)}</td>
                <td className="py-1.5 pr-2 text-right">{l.remise ? fcfa(l.remise) : "—"}</td>
                <td className="py-1.5 text-right font-medium">{fcfa(l.montant)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-cream-300 font-bold text-forest-900">
              <td className="py-2 pr-2" colSpan={4}>Total TTC</td>
              <td className="py-2 text-right">{fcfa(f.montantTotal)}</td>
            </tr>
            {f.totalNotesDebit > 0 && (
              <tr><td className="py-1 pr-2" colSpan={4}>Notes de débit</td><td className="py-1 text-right">+{fcfa(f.totalNotesDebit)}</td></tr>
            )}
            {f.totalAvoirs > 0 && (
              <tr><td className="py-1 pr-2" colSpan={4}>Avoirs</td><td className="py-1 text-right">−{fcfa(f.totalAvoirs)}</td></tr>
            )}
            <tr className="font-bold text-forest-900">
              <td className="py-1.5 pr-2" colSpan={4}>Net dû</td>
              <td className="py-1.5 text-right">{fcfa(f.netDu)}</td>
            </tr>
            {f.type === "facture" && (
              <tr>
                <td className="py-1 pr-2" colSpan={4}>Payé à ce jour · Reste</td>
                <td className="py-1 text-right">{fcfa(f.paye)} · {fcfa(Math.max(0, f.netDu - f.paye))}</td>
              </tr>
            )}
          </tfoot>
        </table>

        <p className="mt-3 rounded-xl bg-cream-50 px-3 py-2 text-xs italic text-ink-700/70">
          Arrêtée la présente facture à la somme de : {capitaliser(nombreEnLettres(f.netDu))} francs CFA.
        </p>
        {f.statut === "annulee" && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-700">
            FACTURE ANNULÉE{f.motifAnnulation ? ` — ${f.motifAnnulation}` : ""}
          </p>
        )}

        <div className="mt-10 flex justify-end">
          <div className="text-center text-xs text-ink-700/60">
            <p className="mb-8">L&apos;Économe</p>
            <p className="border-t border-ink-700/30 pt-1">Signature et cachet</p>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-forest-700">
            <Printer size={16} /> Imprimer / PDF
          </button>
          <button type="button" onClick={onFermer} className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700/70 hover:bg-cream-100">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
