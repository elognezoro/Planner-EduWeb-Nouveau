"use client";

/**
 * Sous-onglet « Écritures & journaux » (11-Comptabilité) : REGISTRE FORMEL des écritures en
 * partie double — tableau de bord, génération automatique par période (idempotente : une
 * pièce = une écriture), saisie manuelle multi-lignes avec équilibre EN DIRECT (RM-700),
 * cycle brouillon → validée (numérotée au journal ; une validée ne se modifie JAMAIS —
 * contre-passation motivée, RM-701/702), plan comptable et journaux paramétrables, balance
 * formelle (écritures validées), balance âgée des créances, clôtures de PÉRIODE mensuelles
 * avec réouverture justifiée (RM-705). Confirmations 2 clics, jamais de dialogue natif.
 * S'AJOUTE à la comptabilité calculée existante (grand livre / balance / résultat & bilan) :
 * rien n'y est retiré.
 */

import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle, BookMarked, Check, ChevronDown, ChevronRight, ClipboardList, FileSpreadsheet,
  Hourglass, ListChecks, Lock, Pencil, Plus, RotateCcw, Scale, Sparkles, Trash2, Unlock, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import type { EtatForm } from "@/lib/finances/actions";
import {
  cloturerPeriode, contrePasserEcriture, enregistrerCompteComptable, enregistrerJournalComptable,
  genererEcrituresPeriode, rouvrirPeriode, saisirEcriture, supprimerCompteComptable,
  supprimerEcritureBrouillon, validerEcriture,
} from "@/lib/finances/actions-comptabilite";
import {
  CENTRES_ANALYTIQUES_SUGGERES, LIBELLE_NATURE_COMPTE, LIBELLE_TYPE_JOURNAL, NATURES_COMPTE,
  TYPES_JOURNAL,
  type BalanceAgeeVue, type BalanceFormelleLigne, type CloturePeriodeVue, type CompteComptableVue,
  type EcritureVue, type JournalComptableVue, type TableauBordComptaVue,
} from "@/lib/finances/comptabilite/types";
import { BoutonActionConfirmee } from "./scolarite-plus";
import { useApresSucces } from "./scolarite-onglets";
import { fcfa } from "./types";

const INITIAL: EtatForm = { ok: false };

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

const moisCourant = () => new Date().toISOString().slice(0, 7);

const LIBELLE_STATUT_ECRITURE: Record<string, string> = {
  brouillon: "Brouillon",
  validee: "Validée",
};

// ─────────────────────────────────────────────────────────────
//  Sous-onglet
// ─────────────────────────────────────────────────────────────

type SectionEcritures = "journal" | "balance" | "agee" | "plan" | "clotures";

export function SousOngletEcritures({
  etablissementId, comptes, journaux, ecritures, balanceFormelle, balanceAgee, clotures,
  tableauBord, peutEcrire,
}: {
  etablissementId: string;
  comptes: CompteComptableVue[];
  journaux: JournalComptableVue[];
  ecritures: EcritureVue[];
  balanceFormelle: BalanceFormelleLigne[];
  balanceAgee: BalanceAgeeVue;
  clotures: CloturePeriodeVue[];
  tableauBord: TableauBordComptaVue;
  peutEcrire: boolean;
}) {
  const [section, setSection] = useState<SectionEcritures>("journal");
  const [enEdition, setEnEdition] = useState<EcritureVue | null>(null);

  const sections: { cle: SectionEcritures; libelle: string; Icone: typeof BookMarked }[] = [
    { cle: "journal", libelle: "Écritures", Icone: BookMarked },
    { cle: "balance", libelle: "Balance formelle", Icone: Scale },
    { cle: "agee", libelle: "Balance âgée", Icone: Hourglass },
    { cle: "plan", libelle: "Plan & journaux", Icone: ClipboardList },
    { cle: "clotures", libelle: "Clôtures de période", Icone: Lock },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 print:hidden">
        {sections.map((s) => (
          <button
            key={s.cle}
            type="button"
            onClick={() => setSection(s.cle)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
              section === s.cle
                ? "border-forest-700 bg-forest-800 text-cream-50"
                : "border-cream-300 bg-white text-ink-700/70 hover:bg-cream-100"
            }`}
          >
            <s.Icone size={13} /> {s.libelle}
          </button>
        ))}
      </div>

      {section === "journal" && (
        <div className="space-y-4">
          <TableauBordEcritures tb={tableauBord} />
          {peutEcrire && <GenerationPeriode etablissementId={etablissementId} />}
          {peutEcrire && (
            <FormSaisieEcriture
              key={enEdition?.id ?? "nouvelle"}
              etablissementId={etablissementId}
              comptes={comptes}
              journaux={journaux}
              enEdition={enEdition}
              onFin={() => setEnEdition(null)}
            />
          )}
          <ListeEcritures
            etablissementId={etablissementId}
            ecritures={ecritures}
            journaux={journaux}
            peutEcrire={peutEcrire}
            onModifier={(e) => {
              setEnEdition(e);
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
      {section === "balance" && <BalanceFormelle lignes={balanceFormelle} />}
      {section === "agee" && <BalanceAgee vue={balanceAgee} />}
      {section === "plan" && (
        <div className="space-y-4">
          <PlanComptable etablissementId={etablissementId} comptes={comptes} peutEcrire={peutEcrire} />
          <Journaux etablissementId={etablissementId} journaux={journaux} peutEcrire={peutEcrire} />
        </div>
      )}
      {section === "clotures" && (
        <CloturesPeriode etablissementId={etablissementId} clotures={clotures} peutEcrire={peutEcrire} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Tableau de bord
// ─────────────────────────────────────────────────────────────

function TableauBordEcritures({ tb }: { tb: TableauBordComptaVue }) {
  const stats = [
    { libelle: "Écritures de l'exercice", valeur: String(tb.totalEcritures) },
    { libelle: "Brouillons à valider", valeur: String(tb.brouillons), alerte: tb.brouillons > 0 },
    { libelle: "Automatiques / manuelles", valeur: `${tb.automatiques} / ${tb.manuelles}` },
    { libelle: "Dernière période clôturée", valeur: tb.dernierePeriodeCloturee ?? "aucune" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.libelle} className="rounded-2xl border border-cream-200 bg-white p-3.5 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/55">{s.libelle}</p>
          <p className={`mt-1 font-display text-lg font-bold ${s.alerte ? "text-amber-700" : "text-forest-900"}`}>
            {s.valeur}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Génération automatique d'une période
// ─────────────────────────────────────────────────────────────

function GenerationPeriode({ etablissementId }: { etablissementId: string }) {
  const [periode, setPeriode] = useState(moisCourant());
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Sparkles size={17} className="text-forest-600" /> Génération automatique des écritures
      </h3>
      <p className="mt-1 text-xs text-ink-700/65">
        Reprend les pièces du mois (encaissements, ventes d&apos;économat, journal recettes-dépenses,
        versements caisse → banque confirmés, retraits bancaires) et passe UNE écriture validée par
        pièce. Relançable sans risque : une pièce déjà écrite n&apos;est jamais reprise.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="periode-generation">Mois à générer</Label>
          <Input
            id="periode-generation"
            type="month"
            value={periode}
            max={moisCourant()}
            onChange={(e) => setPeriode(e.target.value)}
            className="w-44"
          />
        </div>
        <BoutonActionConfirmee
          libelle={`Générer les écritures de ${periode || "…"}`}
          icone={Sparkles}
          ton="primaire"
          action={genererEcrituresPeriode}
          champs={{ etablissementId, periode }}
          onSucces={(m) => setMessage(m ?? "Écritures générées.")}
          desactive={!periode}
        />
      </div>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Saisie manuelle (lignes dynamiques, équilibre en direct)
// ─────────────────────────────────────────────────────────────

interface LigneSaisie {
  cle: number;
  compteId: string;
  sens: "debit" | "credit";
  montant: string;
  libelle: string;
  centreAnalytique: string;
}

function FormSaisieEcriture({
  etablissementId, comptes, journaux, enEdition, onFin,
}: {
  etablissementId: string;
  comptes: CompteComptableVue[];
  journaux: JournalComptableVue[];
  enEdition: EcritureVue | null;
  onFin: () => void;
}) {
  const comptesActifs = comptes.filter((c) => c.statut === "actif");
  const journauxActifs = journaux.filter((j) => j.actif);
  const [ouvert, setOuvert] = useState(enEdition !== null);
  const [prochaineCle, setProchaineCle] = useState(enEdition ? enEdition.lignes.length : 2);
  const [lignes, setLignes] = useState<LigneSaisie[]>(() =>
    enEdition
      ? enEdition.lignes.map((l, i) => ({
          cle: i,
          compteId: l.compteId,
          sens: l.debit > 0 ? "debit" : "credit",
          montant: String(l.debit > 0 ? l.debit : l.credit),
          libelle: l.libelle ?? "",
          centreAnalytique: l.centreAnalytique ?? "",
        }))
      : [
          { cle: 0, compteId: "", sens: "debit", montant: "", libelle: "", centreAnalytique: "" },
          { cle: 1, compteId: "", sens: "credit", montant: "", libelle: "", centreAnalytique: "" },
        ],
  );
  const [etat, action] = useActionState(saisirEcriture, INITIAL);
  useApresSucces(etat, () => {
    if (enEdition) onFin();
    setLignes([
      { cle: 0, compteId: "", sens: "debit", montant: "", libelle: "", centreAnalytique: "" },
      { cle: 1, compteId: "", sens: "credit", montant: "", libelle: "", centreAnalytique: "" },
    ]);
  });

  const totalDebit = lignes.reduce((s, l) => s + (l.sens === "debit" ? Math.trunc(Number(l.montant)) || 0 : 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (l.sens === "credit" ? Math.trunc(Number(l.montant)) || 0 : 0), 0);
  const equilibre = totalDebit === totalCredit && totalDebit > 0;

  const lignesJson = JSON.stringify(
    lignes
      .filter((l) => l.compteId && (Math.trunc(Number(l.montant)) || 0) > 0)
      .map((l) => ({
        compteId: l.compteId,
        debit: l.sens === "debit" ? Math.trunc(Number(l.montant)) || 0 : 0,
        credit: l.sens === "credit" ? Math.trunc(Number(l.montant)) || 0 : 0,
        libelle: l.libelle || undefined,
        centreAnalytique: l.centreAnalytique || undefined,
      })),
  );

  function majLigne(cle: number, champ: keyof LigneSaisie, valeur: string) {
    setLignes((prev) => prev.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l)));
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Pencil size={16} className="text-forest-600" />
          {enEdition ? `Modifier le brouillon ${enEdition.pieceJustificative}` : "Saisie manuelle d'une écriture"}
        </h3>
        <div className="flex items-center gap-2">
          {enEdition && (
            <button
              type="button"
              onClick={onFin}
              className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-ink-700/70 hover:bg-cream-100"
            >
              <X size={12} /> Abandonner la modification
            </button>
          )}
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
          >
            {ouvert ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {ouvert ? "Replier" : "Déplier"}
          </button>
        </div>
      </div>

      {ouvert && (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="lignes" value={lignesJson} />
          {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
          {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="ecr-journal">Journal</Label>
              <Select id="ecr-journal" name="journalId" defaultValue={enEdition?.journalId ?? ""} required>
                <option value="" disabled>Choisir…</option>
                {journauxActifs.map((j) => (
                  <option key={j.id} value={j.id}>{j.code} — {j.libelle}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ecr-date">Date</Label>
              <Input
                id="ecr-date" name="date" type="date" required
                defaultValue={(enEdition ? enEdition.date : new Date().toISOString()).slice(0, 10)}
              />
            </div>
            <div>
              <Label htmlFor="ecr-libelle">Libellé</Label>
              <Input id="ecr-libelle" name="libelle" defaultValue={enEdition?.libelle ?? ""} maxLength={200} required placeholder="Objet de l'écriture" />
            </div>
            <div>
              <Label htmlFor="ecr-piece">Pièce justificative (obligatoire)</Label>
              <Input id="ecr-piece" name="pieceJustificative" defaultValue={enEdition?.pieceJustificative ?? ""} maxLength={120} required placeholder="Réf. facture, bordereau…" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-cream-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-cream-100 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
                  <th className="px-3 py-2">Compte</th>
                  <th className="px-3 py-2">Sens</th>
                  <th className="px-3 py-2">Montant (FCFA)</th>
                  <th className="px-3 py-2">Libellé de ligne</th>
                  <th className="px-3 py-2">Centre analytique</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.cle} className="border-t border-cream-200">
                    <td className="px-3 py-1.5">
                      <Select value={l.compteId} onChange={(e) => majLigne(l.cle, "compteId", e.target.value)} className="min-w-48">
                        <option value="">Compte…</option>
                        {comptesActifs.map((c) => (
                          <option key={c.id} value={c.id}>{c.numero} — {c.intitule}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <Select value={l.sens} onChange={(e) => majLigne(l.cle, "sens", e.target.value)} className="w-28">
                        <option value="debit">Débit</option>
                        <option value="credit">Crédit</option>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="number" min={1} step={1} value={l.montant} className="w-36"
                        onChange={(e) => majLigne(l.cle, "montant", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input value={l.libelle} maxLength={120} onChange={(e) => majLigne(l.cle, "libelle", e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={l.centreAnalytique} maxLength={60} list="centres-analytiques" className="w-40"
                        onChange={(e) => majLigne(l.cle, "centreAnalytique", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => setLignes((prev) => prev.filter((x) => x.cle !== l.cle))}
                        disabled={lignes.length <= 2}
                        className="rounded-full p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-30"
                        aria-label="Retirer la ligne"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="centres-analytiques">
            {CENTRES_ANALYTIQUES_SUGGERES.map((c) => <option key={c} value={c} />)}
          </datalist>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setLignes((prev) => [...prev, { cle: prochaineCle, compteId: "", sens: "debit", montant: "", libelle: "", centreAnalytique: "" }]);
                setProchaineCle((n) => n + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-3.5 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50"
            >
              <Plus size={13} /> Ajouter une ligne
            </button>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                equilibre ? "bg-forest-50 text-forest-800" : "bg-amber-50 text-amber-700"
              }`}
            >
              {equilibre ? <Check size={13} /> : <AlertTriangle size={13} />}
              Débit {fcfa(totalDebit)} · Crédit {fcfa(totalCredit)}
              {equilibre ? " — équilibrée" : " — l'écriture doit être équilibrée (RM-700)"}
            </div>
            <SubmitButton disabled={!equilibre}>
              {enEdition ? "Mettre à jour le brouillon" : "Enregistrer en brouillon"}
            </SubmitButton>
          </div>
          {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
        </form>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Liste des écritures
// ─────────────────────────────────────────────────────────────

function ListeEcritures({
  etablissementId, ecritures, journaux, peutEcrire, onModifier,
}: {
  etablissementId: string;
  ecritures: EcritureVue[];
  journaux: JournalComptableVue[];
  peutEcrire: boolean;
  onModifier: (e: EcritureVue) => void;
}) {
  const [filtreJournal, setFiltreJournal] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filtrees = useMemo(
    () =>
      ecritures.filter(
        (e) =>
          (!filtreJournal || e.journalId === filtreJournal) &&
          (!filtreStatut || (filtreStatut === "annulee" ? e.annulee : !e.annulee && e.statut === filtreStatut)),
      ),
    [ecritures, filtreJournal, filtreStatut],
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ListChecks size={17} className="text-forest-600" /> Écritures récentes
        </h3>
        <div className="flex flex-wrap gap-2">
          <Select value={filtreJournal} onChange={(e) => setFiltreJournal(e.target.value)} className="h-9 w-44 text-xs">
            <option value="">Tous les journaux</option>
            {journaux.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.libelle}</option>)}
          </Select>
          <Select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="h-9 w-36 text-xs">
            <option value="">Tous statuts</option>
            <option value="brouillon">Brouillons</option>
            <option value="validee">Validées</option>
            <option value="annulee">Annulées</option>
          </Select>
        </div>
      </div>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}

      {filtrees.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/60">
          Aucune écriture. Utilisez la génération automatique ou la saisie manuelle ci-dessus.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
                <th className="px-2 py-2" />
                <th className="px-2 py-2">Numéro</th>
                <th className="px-2 py-2">Journal</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Libellé</th>
                <th className="px-2 py-2">Pièce</th>
                <th className="px-2 py-2 text-right">Montant</th>
                <th className="px-2 py-2">Statut</th>
                {peutEcrire && <th className="px-2 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtrees.map((e) => (
                <LigneEcritureTableau
                  key={e.id}
                  etablissementId={etablissementId}
                  ecriture={e}
                  ouverte={detail === e.id}
                  onDetail={() => setDetail((d) => (d === e.id ? null : e.id))}
                  peutEcrire={peutEcrire}
                  onModifier={onModifier}
                  onMessage={setMessage}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LigneEcritureTableau({
  etablissementId, ecriture: e, ouverte, onDetail, peutEcrire, onModifier, onMessage,
}: {
  etablissementId: string;
  ecriture: EcritureVue;
  ouverte: boolean;
  onDetail: () => void;
  peutEcrire: boolean;
  onModifier: (e: EcritureVue) => void;
  onMessage: (m: string | null) => void;
}) {
  const [motif, setMotif] = useState("");
  const badge = e.annulee
    ? "bg-red-50 text-red-600"
    : e.statut === "validee"
      ? "bg-forest-50 text-forest-800"
      : "bg-amber-50 text-amber-700";
  return (
    <>
      <tr className={`border-b border-cream-100 align-top ${e.annulee ? "opacity-50" : ""}`}>
        <td className="px-2 py-2">
          <button type="button" onClick={onDetail} className="rounded-full p-1 text-forest-700 hover:bg-forest-50" aria-label="Détail des lignes">
            {ouverte ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-2 py-2 font-mono text-xs">{e.numero ?? "—"}</td>
        <td className="px-2 py-2 text-xs font-semibold">{e.journalCode}</td>
        <td className="px-2 py-2 whitespace-nowrap text-xs">{dateFr(e.date)}</td>
        <td className="max-w-64 px-2 py-2 text-xs">{e.libelle}</td>
        <td className="px-2 py-2 text-xs text-ink-700/70">{e.pieceJustificative}</td>
        <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{fcfa(e.totalDebit)}</td>
        <td className="px-2 py-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge}`}>
            {e.annulee ? "Annulée" : LIBELLE_STATUT_ECRITURE[e.statut] ?? e.statut}
            {e.origine === "automatique" ? " · auto" : ""}
            {e.contreEcritureDeId ? " · contre-passation" : ""}
          </span>
        </td>
        {peutEcrire && (
          <td className="px-2 py-2">
            {!e.annulee && e.statut === "brouillon" && (
              <div className="flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onModifier(e)}
                  className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"
                >
                  <Pencil size={11} /> Modifier
                </button>
                <BoutonActionConfirmee
                  libelle="Valider" icone={Check} ton="primaire" action={validerEcriture}
                  champs={{ etablissementId, id: e.id, version: String(e.version) }}
                  onSucces={(m) => onMessage(m ?? "Écriture validée.")}
                />
                <BoutonActionConfirmee
                  libelle="Supprimer" icone={Trash2} ton="danger" action={supprimerEcritureBrouillon}
                  champs={{ etablissementId, id: e.id, version: String(e.version) }}
                  onSucces={(m) => onMessage(m ?? "Brouillon supprimé.")}
                />
              </div>
            )}
            {!e.annulee && e.statut === "validee" && !e.contreEcritureDeId && (
              <div className="flex flex-col items-end gap-1">
                <Input
                  value={motif} maxLength={200} placeholder="Motif de contre-passation…"
                  onChange={(ev) => setMotif(ev.target.value)}
                  className="h-8 w-52 text-xs"
                />
                <BoutonActionConfirmee
                  libelle="Contre-passer" icone={RotateCcw} ton="danger" action={contrePasserEcriture}
                  champs={{ etablissementId, id: e.id, motif }}
                  desactive={motif.trim().length === 0}
                  onSucces={(m) => { onMessage(m ?? "Contre-passation enregistrée."); setMotif(""); }}
                />
              </div>
            )}
          </td>
        )}
      </tr>
      {ouverte && (
        <tr className="border-b border-cream-100 bg-cream-50/60">
          <td />
          <td colSpan={peutEcrire ? 8 : 7} className="px-2 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-ink-700/50">
                  <th className="px-2 py-1">Compte</th>
                  <th className="px-2 py-1">Libellé</th>
                  <th className="px-2 py-1">Centre analytique</th>
                  <th className="px-2 py-1 text-right">Débit</th>
                  <th className="px-2 py-1 text-right">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {e.lignes.map((l) => (
                  <tr key={l.id} className="border-t border-cream-200/70">
                    <td className="px-2 py-1 font-mono">{l.compteNumero} — {l.compteIntitule}</td>
                    <td className="px-2 py-1">{l.libelle ?? "—"}</td>
                    <td className="px-2 py-1">{l.centreAnalytique ?? "—"}</td>
                    <td className="px-2 py-1 text-right">{l.debit > 0 ? fcfa(l.debit) : ""}</td>
                    <td className="px-2 py-1 text-right">{l.credit > 0 ? fcfa(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Balance formelle & balance âgée
// ─────────────────────────────────────────────────────────────

function BalanceFormelle({ lignes }: { lignes: BalanceFormelleLigne[] }) {
  const totalDebit = lignes.reduce((s, l) => s + l.totalDebit, 0);
  const totalCredit = lignes.reduce((s, l) => s + l.totalCredit, 0);
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Scale size={17} className="text-forest-600" /> Balance générale du registre formel
      </h3>
      <p className="mt-1 text-xs text-ink-700/60">
        Écritures VALIDÉES uniquement (les brouillons n&apos;y figurent pas). La balance des états
        « Grand livre / Balance » voisins reste dérivée des opérations : les deux se recoupent.
      </p>
      {lignes.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/60">Aucune écriture validée pour l&apos;instant.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
                <th className="px-2 py-2">Compte</th>
                <th className="px-2 py-2">Intitulé</th>
                <th className="px-2 py-2 text-right">Total débit</th>
                <th className="px-2 py-2 text-right">Total crédit</th>
                <th className="px-2 py-2 text-right">Solde débiteur</th>
                <th className="px-2 py-2 text-right">Solde créditeur</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.compteNumero} className="border-b border-cream-100">
                  <td className="px-2 py-1.5 font-mono text-xs">{l.compteNumero}</td>
                  <td className="px-2 py-1.5 text-xs">{l.compteIntitule}</td>
                  <td className="px-2 py-1.5 text-right">{fcfa(l.totalDebit)}</td>
                  <td className="px-2 py-1.5 text-right">{fcfa(l.totalCredit)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{l.solde > 0 ? fcfa(l.solde) : ""}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{l.solde < 0 ? fcfa(-l.solde) : ""}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-forest-200 font-bold">
                <td className="px-2 py-2" colSpan={2}>Totaux (équilibre RM-700)</td>
                <td className="px-2 py-2 text-right">{fcfa(totalDebit)}</td>
                <td className="px-2 py-2 text-right">{fcfa(totalCredit)}</td>
                <td className="px-2 py-2 text-right" colSpan={2}>
                  {totalDebit === totalCredit ? "Équilibrée" : "DÉSÉQUILIBRE !"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BalanceAgee({ vue }: { vue: BalanceAgeeVue }) {
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Hourglass size={17} className="text-forest-600" /> Balance âgée des créances élèves
      </h3>
      <p className="mt-1 text-xs text-ink-700/60">
        Restes dus de l&apos;exercice, classés par ancienneté d&apos;échéance — l&apos;outil du recouvrement.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
              <th className="px-2 py-2">Tranche</th>
              <th className="px-2 py-2 text-right">Créances</th>
              <th className="px-2 py-2 text-right">Montant restant dû</th>
            </tr>
          </thead>
          <tbody>
            {vue.tranches.map((t, i) => (
              <tr key={t.libelle} className="border-b border-cream-100">
                <td className={`px-2 py-1.5 ${i >= 3 ? "font-semibold text-red-600" : ""}`}>{t.libelle}</td>
                <td className="px-2 py-1.5 text-right">{t.nombre}</td>
                <td className={`px-2 py-1.5 text-right font-semibold ${i >= 3 ? "text-red-600" : ""}`}>{fcfa(t.montant)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-forest-200 font-bold">
              <td className="px-2 py-2">Total restant dû</td>
              <td className="px-2 py-2 text-right">{vue.tranches.reduce((s, t) => s + t.nombre, 0)}</td>
              <td className="px-2 py-2 text-right">{fcfa(vue.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Plan comptable & journaux
// ─────────────────────────────────────────────────────────────

function PlanComptable({
  etablissementId, comptes, peutEcrire,
}: {
  etablissementId: string;
  comptes: CompteComptableVue[];
  peutEcrire: boolean;
}) {
  const [enEdition, setEnEdition] = useState<CompteComptableVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [etat, action] = useActionState(enregistrerCompteComptable, INITIAL);
  useApresSucces(etat, () => { setEnEdition(null); setFormOuvert(false); });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileSpreadsheet size={17} className="text-forest-600" /> Plan comptable ({comptes.length} comptes)
        </h3>
        {peutEcrire && (
          <button
            type="button"
            onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
          >
            <Plus size={13} /> Nouveau compte
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-700/60">
        Semé depuis le plan OHADA simplifié de la plateforme — affinez-le librement (le référentiel
        officiel détaillé sera intégré à sa réception, sans perte de vos ajouts).
      </p>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}

      {peutEcrire && (formOuvert || enEdition) && (
        <form action={action} className="mt-3 grid gap-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3 sm:grid-cols-2 lg:grid-cols-5" key={enEdition?.id ?? "nouveau"}>
          <input type="hidden" name="etablissementId" value={etablissementId} />
          {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
          {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
          <div>
            <Label htmlFor="cpt-numero">Numéro</Label>
            <Input id="cpt-numero" name="numero" defaultValue={enEdition?.numero ?? ""} required maxLength={10} pattern="[0-9]+" placeholder="6052" />
          </div>
          <div>
            <Label htmlFor="cpt-intitule">Intitulé</Label>
            <Input id="cpt-intitule" name="intitule" defaultValue={enEdition?.intitule ?? ""} required maxLength={120} />
          </div>
          <div>
            <Label htmlFor="cpt-nature">Nature</Label>
            <Select id="cpt-nature" name="nature" defaultValue={enEdition?.nature ?? "charge"}>
              {NATURES_COMPTE.map((n) => <option key={n.code} value={n.code}>{n.libelle}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="cpt-parent">Compte parent (facultatif)</Label>
            <Input id="cpt-parent" name="parentNumero" defaultValue={enEdition?.parentNumero ?? ""} maxLength={10} pattern="[0-9]*" placeholder="605" />
          </div>
          <div>
            <Label htmlFor="cpt-statut">Statut</Label>
            <Select id="cpt-statut" name="statut" defaultValue={enEdition?.statut ?? "actif"}>
              <option value="actif">Actif</option>
              <option value="ferme">Fermé</option>
            </Select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <SubmitButton>{enEdition ? "Mettre à jour" : "Créer le compte"}</SubmitButton>
            {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
          </div>
        </form>
      )}

      <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-cream-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 bg-cream-100">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
              <th className="px-3 py-2">Numéro</th>
              <th className="px-3 py-2">Intitulé</th>
              <th className="px-3 py-2">Nature</th>
              <th className="px-3 py-2">Statut</th>
              {peutEcrire && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => (
              <tr key={c.id} className={`border-t border-cream-100 ${c.statut === "ferme" ? "opacity-50" : ""}`}>
                <td className="px-3 py-1.5 font-mono text-xs">{c.numero}</td>
                <td className="px-3 py-1.5 text-xs">{c.intitule}</td>
                <td className="px-3 py-1.5 text-xs text-ink-700/70">{LIBELLE_NATURE_COMPTE[c.nature] ?? c.nature}</td>
                <td className="px-3 py-1.5 text-xs">{c.statut === "actif" ? "Actif" : "Fermé"}</td>
                {peutEcrire && (
                  <td className="px-3 py-1.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setEnEdition(c); setFormOuvert(true); }}
                        className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"
                      >
                        <Pencil size={11} /> Modifier
                      </button>
                      <BoutonActionConfirmee
                        libelle="Retirer" icone={Trash2} ton="danger" action={supprimerCompteComptable}
                        champs={{ etablissementId, id: c.id, version: String(c.version) }}
                        onSucces={(m) => setMessage(m ?? "Compte retiré.")}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Journaux({
  etablissementId, journaux, peutEcrire,
}: {
  etablissementId: string;
  journaux: JournalComptableVue[];
  peutEcrire: boolean;
}) {
  const [enEdition, setEnEdition] = useState<JournalComptableVue | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [etat, action] = useActionState(enregistrerJournalComptable, INITIAL);
  useApresSucces(etat, () => { setEnEdition(null); setFormOuvert(false); });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <BookMarked size={17} className="text-forest-600" /> Journaux comptables
        </h3>
        {peutEcrire && (
          <button
            type="button"
            onClick={() => { setEnEdition(null); setFormOuvert((v) => !v); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3.5 py-1.5 text-xs font-semibold text-cream-50 hover:bg-forest-700"
          >
            <Plus size={13} /> Nouveau journal
          </button>
        )}
      </div>

      {peutEcrire && (formOuvert || enEdition) && (
        <form action={action} className="mt-3 grid gap-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4" key={enEdition?.id ?? "nouveau"}>
          <input type="hidden" name="etablissementId" value={etablissementId} />
          {enEdition && <input type="hidden" name="id" value={enEdition.id} />}
          {enEdition && <input type="hidden" name="version" value={String(enEdition.version)} />}
          <div>
            <Label htmlFor="jnl-code">Code (2-4 lettres)</Label>
            <Input id="jnl-code" name="code" defaultValue={enEdition?.code ?? ""} required maxLength={4} pattern="[A-Za-z]{2,4}" placeholder="OD" />
          </div>
          <div>
            <Label htmlFor="jnl-libelle">Libellé</Label>
            <Input id="jnl-libelle" name="libelle" defaultValue={enEdition?.libelle ?? ""} required maxLength={120} />
          </div>
          <div>
            <Label htmlFor="jnl-type">Type</Label>
            <Select id="jnl-type" name="type" defaultValue={enEdition?.type ?? "od"}>
              {TYPES_JOURNAL.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="jnl-actif">Actif</Label>
            <Select id="jnl-actif" name="actif" defaultValue={enEdition && !enEdition.actif ? "non" : "oui"}>
              <option value="oui">Oui</option>
              <option value="non">Non (suspendu)</option>
            </Select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <SubmitButton>{enEdition ? "Mettre à jour" : "Créer le journal"}</SubmitButton>
            {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
          </div>
        </form>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl border border-cream-200">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-cream-100">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-700/60">
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Libellé</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">État</th>
              {peutEcrire && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {journaux.map((j) => (
              <tr key={j.id} className={`border-t border-cream-100 ${j.actif ? "" : "opacity-50"}`}>
                <td className="px-3 py-1.5 font-mono text-xs font-bold">{j.code}</td>
                <td className="px-3 py-1.5 text-xs">{j.libelle}</td>
                <td className="px-3 py-1.5 text-xs text-ink-700/70">{LIBELLE_TYPE_JOURNAL[j.type] ?? j.type}</td>
                <td className="px-3 py-1.5 text-xs">{j.actif ? "Actif" : "Suspendu"}</td>
                {peutEcrire && (
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => { setEnEdition(j); setFormOuvert(true); }}
                      className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-2.5 py-1 text-[11px] font-semibold text-forest-800 hover:bg-forest-50"
                    >
                      <Pencil size={11} /> Modifier
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  Clôtures de période mensuelles
// ─────────────────────────────────────────────────────────────

function CloturesPeriode({
  etablissementId, clotures, peutEcrire,
}: {
  etablissementId: string;
  clotures: CloturePeriodeVue[];
  peutEcrire: boolean;
}) {
  const [periode, setPeriode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Card>
      <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <Lock size={17} className="text-forest-600" /> Clôtures de période (mensuelles)
      </h3>
      <p className="mt-1 text-xs text-ink-700/60">
        Une période clôturée n&apos;accepte plus AUCUNE écriture (RM-705) — ni saisie, ni validation,
        ni génération. La clôture exige zéro brouillon dans le mois. La clôture d&apos;EXERCICE
        (onglet « Clôture &amp; exports » voisin) reste inchangée.
      </p>
      {message && <div className="mt-2"><FormAlert ton="succes">{message}</FormAlert></div>}

      {peutEcrire && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="periode-cloture">Mois à clôturer</Label>
            <Input
              id="periode-cloture" type="month" value={periode} max={moisCourant()}
              onChange={(e) => setPeriode(e.target.value)} className="w-44"
            />
          </div>
          <BoutonActionConfirmee
            libelle={`Clôturer ${periode || "…"}`} icone={Lock} ton="danger" action={cloturerPeriode}
            champs={{ etablissementId, periode }} desactive={!periode}
            onSucces={(m) => { setMessage(m ?? "Période clôturée."); setPeriode(""); }}
          />
        </div>
      )}

      {clotures.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/60">Aucune période clôturée pour l&apos;instant.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {clotures.map((c) => (
            <LigneCloture key={c.id} etablissementId={etablissementId} cloture={c} peutEcrire={peutEcrire} onMessage={setMessage} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function LigneCloture({
  etablissementId, cloture: c, peutEcrire, onMessage,
}: {
  etablissementId: string;
  cloture: CloturePeriodeVue;
  peutEcrire: boolean;
  onMessage: (m: string | null) => void;
}) {
  const [justification, setJustification] = useState("");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white px-3.5 py-2.5">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900">
        <Lock size={14} className="text-forest-600" /> {c.periode}
        <span className="text-xs font-normal text-ink-700/55">clôturée le {dateFr(c.clotureLe)}</span>
      </span>
      {peutEcrire && (
        <span className="flex flex-wrap items-center gap-1.5">
          <Input
            value={justification} maxLength={200} placeholder="Justification de la réouverture…"
            onChange={(e) => setJustification(e.target.value)} className="h-8 w-56 text-xs"
          />
          <BoutonActionConfirmee
            libelle="Rouvrir" icone={Unlock} ton="danger" action={rouvrirPeriode}
            champs={{ etablissementId, id: c.id, version: String(c.version), justification }}
            desactive={justification.trim().length === 0}
            onSucces={(m) => { onMessage(m ?? "Période rouverte."); setJustification(""); }}
          />
        </span>
      )}
    </li>
  );
}
