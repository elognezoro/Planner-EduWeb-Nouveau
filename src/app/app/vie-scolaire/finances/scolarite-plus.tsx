"use client";

/**
 * Sous-module SCOLARITÉ (06) — vues enrichies de l'onglet Scolarité :
 * tableau de bord recouvrement, COMPTE FINANCIER de l'élève (créances, aides, avances,
 * remboursements, relance, clôture, recalcul), file des remboursements et paramétrage
 * (catégories à priorité d'imputation, règles de pénalités, règles de blocage).
 */

import { useActionState, useState, useTransition } from "react";
import {
  AlertTriangle, Ban, BadgePercent, Bell, CalendarClock, Check, ClipboardList, Coins,
  FileWarning, Gauge, GraduationCap, HandCoins, Loader2, Lock, PiggyBank, Plus, ReceiptText,
  RefreshCw, Scale, Settings2, Undo2, UserSearch, Wallet, X,
} from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Input, Label, Select, SubmitButton } from "@/components/ui/form";
import type { EtatForm } from "@/lib/finances/actions";
import {
  accorderBourse, accorderExoneration, annulerBourse, annulerExoneration, annulerPenalite,
  annulerPlanPaiement, appliquerPenalitesEleve, cloturerCompteEleve, compteFinancierEleve,
  deciderRemboursement, demanderRemboursement, enregistrerAvance, enregistrerCategorie,
  enregistrerPlanPaiement, enregistrerRegleBlocage, enregistrerReglePenalite, genererCreances,
  imputerAvance, payerRemboursement, recalculerCreancesEleve, relancerEleve, supprimerCategorie,
  supprimerRegleBlocage, supprimerReglePenalite,
} from "@/lib/finances/actions-scolarite";
import {
  LIBELLE_DECLENCHEUR, LIBELLE_STATUT_CREANCE, LIBELLE_TYPE_BLOCAGE, LIBELLE_TYPE_BOURSE,
  LIBELLE_TYPE_PENALITE,
  type ApercuBlocageVue, type BourseVue, type CategorieFraisVue, type CompteEleveVue,
  type ExonerationVue, type RecouvrementVue, type RegleBlocageVue, type ReglePenaliteVue,
  type RemboursementVue, type StatutCreanceAffiche,
} from "@/lib/finances/scolarite/types";
import { SelecteurEleve, useApresSucces } from "./scolarite-onglets";
import { LIBELLE_MODE, fcfa, type EleveVue, type FraisVue } from "./types";

const INITIAL: EtatForm = { ok: false };
type ActionServeur = (prev: EtatForm, fd: FormData) => Promise<EtatForm>;

const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso)) : "—";

// ─────────────────────────────────────────────────────────────
//  Petits composants partagés
// ─────────────────────────────────────────────────────────────

const TON_STATUT: Record<StatutCreanceAffiche, string> = {
  generee: "bg-cream-200 text-forest-800",
  partiellement_payee: "bg-gold-100 text-gold-800",
  soldee: "bg-forest-100 text-forest-800",
  en_retard: "bg-red-100 text-red-700",
  suspendue: "bg-cream-200 text-ink-700/60",
  annulee: "bg-red-50 text-red-500 line-through",
};

function BadgeCreance({ statut }: { statut: StatutCreanceAffiche }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TON_STATUT[statut]}`}>
      {LIBELLE_STATUT_CREANCE[statut]}
    </span>
  );
}

/**
 * Bouton d'action serveur à CONFIRMATION 2 clics (pas de window.confirm — aperçus statiques) :
 * construit le FormData, appelle l'action et remonte le message.
 */
export function BoutonActionConfirmee({
  libelle, icone: Icone, ton = "neutre", action, champs, onSucces, desactive,
}: {
  libelle: string;
  icone: typeof Check;
  ton?: "neutre" | "danger" | "primaire";
  action: ActionServeur;
  champs: Record<string, string>;
  onSucces?: (message?: string) => void;
  desactive?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const classes =
    ton === "danger"
      ? "border-red-200 text-red-600 hover:bg-red-50"
      : ton === "primaire"
        ? "border-forest-700 bg-forest-800 text-cream-50 hover:bg-forest-700"
        : "border-cream-300 text-forest-800 hover:bg-forest-50";

  function executer() {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(champs)) fd.set(k, v);
      const r = await action(INITIAL, fd);
      setConfirmer(false);
      if (!r.ok) setMessage(r.message ?? "Refusé.");
      else onSucces?.(r.message);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {!confirmer ? (
        <button
          type="button" disabled={desactive || pending} onClick={() => setConfirmer(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${classes}`}
        >
          <Icone size={13} /> {libelle}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-xs font-medium text-ink-700/70">Confirmer ?</span>
          <button
            type="button" onClick={executer} disabled={pending}
            className="inline-flex items-center gap-1 rounded-full bg-forest-800 px-2.5 py-1 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Oui
          </button>
          <button
            type="button" onClick={() => setConfirmer(false)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cream-300 text-ink-700/60 hover:bg-cream-100"
          >
            <X size={12} />
          </button>
        </span>
      )}
      {message && <span className="text-xs text-red-600">{message}</span>}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
//  Tableau de bord recouvrement (en tête d'onglet Scolarité)
// ─────────────────────────────────────────────────────────────

export function TableauRecouvrement({ recouvrement, exercice }: { recouvrement: RecouvrementVue; exercice: string }) {
  const cartes: { libelle: string; valeur: string; Icone: typeof Gauge; ton?: "gold" | "rouge" }[] = [
    { libelle: "Montant attendu", valeur: fcfa(recouvrement.attendu), Icone: Scale },
    { libelle: "Encaissé", valeur: fcfa(recouvrement.encaisse), Icone: Wallet },
    { libelle: "Reste à encaisser", valeur: fcfa(recouvrement.reste), Icone: Coins, ton: "gold" },
    { libelle: "Taux de recouvrement", valeur: `${recouvrement.taux} %`, Icone: Gauge },
    { libelle: "Créances en retard", valeur: `${recouvrement.enRetardNombre} · ${fcfa(recouvrement.enRetardMontant)}`, Icone: CalendarClock, ton: "rouge" },
    { libelle: "Remises accordées", valeur: fcfa(recouvrement.totalRemises), Icone: BadgePercent },
    { libelle: "Exonérations & bourses", valeur: fcfa(recouvrement.totalExonerations + recouvrement.totalBourses), Icone: GraduationCap },
    { libelle: "Pénalités appliquées", valeur: fcfa(recouvrement.totalPenalites), Icone: FileWarning, ton: "gold" },
  ];
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">
        Recouvrement — exercice {exercice}
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

// ─────────────────────────────────────────────────────────────
//  Compte financier de l'élève
// ─────────────────────────────────────────────────────────────

export function OngletCompteEleve({
  etablissementId, eleves, classes, frais, exercice, peutEcrire,
}: {
  etablissementId: string;
  eleves: EleveVue[];
  classes: { id: string; nom: string }[];
  frais: FraisVue[];
  exercice: string;
  peutEcrire: boolean;
}) {
  const [eleveId, setEleveId] = useState("");
  const [compte, setCompte] = useState<CompteEleveVue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chargement, demarrerChargement] = useTransition();

  function charger(id: string) {
    setEleveId(id);
    setInfo(null);
    if (!id) {
      setCompte(null);
      return;
    }
    setErreur(null);
    demarrerChargement(async () => {
      const r = await compteFinancierEleve(etablissementId, id);
      if (r.ok && r.compte) setCompte(r.compte);
      else {
        setCompte(null);
        setErreur(r.message ?? "Erreur technique.");
      }
    });
  }

  const recharger = (message?: string) => {
    if (message) setInfo(message);
    if (eleveId) charger(eleveId);
  };

  return (
    <div className="space-y-5">
      {peutEcrire && (
        <Card>
          <BlocGeneration etablissementId={etablissementId} classes={classes} eleveId={eleveId} onSucces={recharger} />
        </Card>
      )}

      <Card>
        <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <UserSearch size={18} className="text-forest-600" /> Compte financier de l&apos;élève
        </h2>
        <SelecteurEleve eleves={eleves} valeur={eleveId} onChange={charger} name="eleveCompte" />
        {chargement && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink-700/60">
            <Loader2 size={14} className="animate-spin" /> Chargement du compte…
          </p>
        )}
        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
        {info && <p className="mt-3 text-sm font-medium text-forest-700">{info}</p>}
        {!eleveId && !chargement && (
          <p className="mt-3 text-sm text-ink-700/60">
            Recherchez un élève pour consulter ses créances, paiements, aides et son solde (exercice {exercice}).
          </p>
        )}
      </Card>

      {compte && (
        <CompteEleve
          etablissementId={etablissementId}
          compte={compte}
          frais={frais}
          peutEcrire={peutEcrire}
          onSucces={recharger}
        />
      )}
    </div>
  );
}

function BlocGeneration({
  etablissementId, classes, eleveId, onSucces,
}: {
  etablissementId: string;
  classes: { id: string; nom: string }[];
  eleveId: string;
  onSucces: (message?: string) => void;
}) {
  const [portee, setPortee] = useState<"eleve" | "classe" | "etablissement">("eleve");
  const [classeId, setClasseId] = useState("");
  const champs: Record<string, string> = { etablissementId, portee };
  if (portee === "eleve") champs.eleveId = eleveId;
  if (portee === "classe") champs.classeId = classeId;

  return (
    <div className="space-y-3">
      <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <ClipboardList size={18} className="text-forest-600" /> Générer les créances
      </h2>
      <p className="text-xs text-ink-700/60">
        Crée les créances manquantes depuis les frais OBLIGATOIRES applicables (niveau, série, cycle, validité) —
        opération idempotente : jamais de doublon pour un même frais et exercice.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={portee} onChange={(e) => setPortee(e.target.value as typeof portee)} className="w-auto">
          <option value="eleve">Élève sélectionné</option>
          <option value="classe">Toute une classe</option>
          <option value="etablissement">Tout l&apos;établissement</option>
        </Select>
        {portee === "classe" && (
          <Select value={classeId} onChange={(e) => setClasseId(e.target.value)} className="w-auto">
            <option value="">— Choisir la classe —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </Select>
        )}
        <BoutonActionConfirmee
          libelle="Générer les créances"
          icone={Plus}
          ton="primaire"
          action={genererCreances}
          champs={champs}
          onSucces={onSucces}
          desactive={(portee === "eleve" && !eleveId) || (portee === "classe" && !classeId)}
        />
      </div>
    </div>
  );
}

function CompteEleve({
  etablissementId, compte, frais, peutEcrire, onSucces,
}: {
  etablissementId: string;
  compte: CompteEleveVue;
  frais: FraisVue[];
  peutEcrire: boolean;
  onSucces: (message?: string) => void;
}) {
  const d = compte.detail;
  const cartes = [
    { libelle: "Facturé", valeur: d.facture },
    { libelle: "Payé", valeur: d.paye },
    { libelle: "Remises", valeur: d.remises },
    { libelle: "Exonérations", valeur: d.exonerations },
    { libelle: "Bourses", valeur: d.bourses },
    { libelle: "Pénalités", valeur: d.penalites },
  ];
  const base = { etablissementId, eleveId: compte.eleveId };

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-forest-900">{compte.eleveNom}</h3>
            <p className="text-xs text-ink-700/60">
              {compte.classe ?? "Classe non renseignée"} · exercice {compte.exercice}
              {compte.avancesDisponibles > 0 && (
                <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-800">
                  Avance disponible : {fcfa(compte.avancesDisponibles)}
                </span>
              )}
            </p>
          </div>
          {peutEcrire && (
            <div className="flex flex-wrap items-center gap-2">
              <BoutonActionConfirmee libelle="Relancer" icone={Bell} action={relancerEleve} champs={base} onSucces={onSucces} />
              <BoutonActionConfirmee libelle="Appliquer les pénalités" icone={FileWarning} action={appliquerPenalitesEleve} champs={base} onSucces={onSucces} />
              <BoutonActionConfirmee libelle="Recalculer" icone={RefreshCw} action={recalculerCreancesEleve} champs={base} onSucces={onSucces} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {cartes.map((c) => (
            <div key={c.libelle} className="rounded-2xl border border-cream-200 bg-cream-50/60 p-3 text-center">
              <p className="text-xs text-ink-700/60">{c.libelle}</p>
              <p className="font-display text-sm font-bold text-forest-900">{fcfa(c.valeur)}</p>
            </div>
          ))}
        </div>
        <p className={`mt-3 rounded-2xl px-4 py-2.5 text-center font-display text-lg font-bold ${d.solde > 0 ? "bg-red-50 text-red-700" : "bg-forest-50 text-forest-800"}`}>
          Solde restant dû : {fcfa(d.solde)}
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 inline-flex items-center gap-2 font-display text-sm font-bold text-forest-900">
          <ReceiptText size={16} className="text-forest-600" /> Créances ({compte.creances.length})
        </h3>
        {compte.creances.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune créance générée : utilisez « Générer les créances ».</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Libellé</th>
                  <th className="py-1.5 pr-2">Échéance</th>
                  <th className="py-1.5 pr-2 text-right">Montant</th>
                  <th className="py-1.5 pr-2 text-right">Payé</th>
                  <th className="py-1.5">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {compte.creances.map((c) => (
                  <tr key={c.id} className={c.statut === "suspendue" || c.statut === "annulee" ? "opacity-55" : ""}>
                    <td className="py-2 pr-2 font-medium text-forest-900">{c.libelle}</td>
                    <td className="py-2 pr-2">{dateFr(c.dateEcheance)}</td>
                    <td className="py-2 pr-2 text-right">{fcfa(c.montant)}</td>
                    <td className="py-2 pr-2 text-right text-forest-700">{fcfa(c.paye)}</td>
                    <td className="py-2"><BadgeCreance statut={c.statutAffiche} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 inline-flex items-center gap-2 font-display text-sm font-bold text-forest-900">
            <BadgePercent size={16} className="text-forest-600" /> Exonérations
          </h3>
          <ListeSimple
            vide="Aucune exonération."
            lignes={compte.exonerations.map((x) => ({
              id: x.id,
              texte: `${x.type === "totale" ? "Totale" : "Partielle"} — ${x.taux != null ? `${x.taux} %` : fcfa(x.montant ?? 0)} · ${x.decision}`,
              annulation: peutEcrire ? { action: annulerExoneration, champs: { id: x.id, version: String(x.version) } } : undefined,
            }))}
            onSucces={onSucces}
          />
          {peutEcrire && <FormExoneration base={base} frais={frais} onSucces={onSucces} />}
        </Card>

        <Card>
          <h3 className="mb-2 inline-flex items-center gap-2 font-display text-sm font-bold text-forest-900">
            <GraduationCap size={16} className="text-forest-600" /> Bourses & prises en charge
          </h3>
          <ListeSimple
            vide="Aucune bourse."
            lignes={compte.bourses.map((b) => ({
              id: b.id,
              texte: `${LIBELLE_TYPE_BOURSE[b.type] ?? b.type}${b.organisme ? ` (${b.organisme})` : ""} — ${b.taux != null ? `${b.taux} %` : fcfa(b.montantFixe ?? 0)} · ${b.periode}`,
              annulation: peutEcrire ? { action: annulerBourse, champs: { id: b.id, version: String(b.version) } } : undefined,
            }))}
            onSucces={onSucces}
          />
          {peutEcrire && <FormBourse base={base} frais={frais} exercice={compte.exercice} onSucces={onSucces} />}
        </Card>

        <Card>
          <h3 className="mb-2 inline-flex items-center gap-2 font-display text-sm font-bold text-forest-900">
            <CalendarClock size={16} className="text-forest-600" /> Plans de paiement
          </h3>
          <ListeSimple
            vide="Aucun plan de paiement."
            lignes={compte.plans.map((p) => ({
              id: p.id,
              texte: `${p.libelle ?? "Plan"} — ${p.echeances.length} échéance(s), ${fcfa(p.echeances.reduce((s, e) => s + e.montant, 0))} · ${p.statut}`,
              annulation: peutEcrire && p.statut === "actif" ? { action: annulerPlanPaiement, champs: { id: p.id, version: String(p.version) } } : undefined,
            }))}
            onSucces={onSucces}
          />
          {peutEcrire && <FormPlanPaiement base={base} creances={compte.creances.map((c) => ({ id: c.id, libelle: c.libelle }))} onSucces={onSucces} />}
        </Card>

        <Card>
          <h3 className="mb-2 inline-flex items-center gap-2 font-display text-sm font-bold text-forest-900">
            <FileWarning size={16} className="text-forest-600" /> Pénalités
          </h3>
          <ListeSimple
            vide="Aucune pénalité."
            lignes={compte.penalites.map((p) => ({
              id: p.id,
              texte: `${p.creanceLibelle} — ${fcfa(p.montant)}${p.statut === "annulee" ? " (annulée)" : ""}`,
              annulation: peutEcrire && p.statut === "appliquee" ? { action: annulerPenalite, champs: { id: p.id, version: String(p.version) } } : undefined,
            }))}
            onSucces={onSucces}
          />
        </Card>

        <Card>
          <h3 className="mb-2 inline-flex items-center gap-2 font-display text-sm font-bold text-forest-900">
            <PiggyBank size={16} className="text-forest-600" /> Avances & acomptes
          </h3>
          {compte.avances.length === 0 ? (
            <p className="text-sm text-ink-700/60">Aucune avance enregistrée.</p>
          ) : (
            <ul className="divide-y divide-cream-100 text-sm">
              {compte.avances.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {fcfa(a.montant)} ({LIBELLE_MODE[a.mode] ?? a.mode}) — restant : <strong>{fcfa(a.solde)}</strong>
                  </span>
                  {peutEcrire && a.solde > 0 && (
                    <BoutonActionConfirmee
                      libelle="Imputer sur les créances"
                      icone={HandCoins}
                      ton="primaire"
                      action={imputerAvance}
                      champs={{ id: a.id, version: String(a.version) }}
                      onSucces={onSucces}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {peutEcrire && <FormAvance base={base} onSucces={onSucces} />}
        </Card>

        <Card>
          <h3 className="mb-2 inline-flex items-center gap-2 font-display text-sm font-bold text-forest-900">
            <Undo2 size={16} className="text-forest-600" /> Remboursements
          </h3>
          <ListeSimple
            vide="Aucune demande de remboursement."
            lignes={compte.remboursements.map((r) => ({
              id: r.id,
              texte: `${fcfa(r.montant)} — ${r.motif} · ${r.statut}`,
            }))}
            onSucces={onSucces}
          />
          {peutEcrire && (
            <FormRemboursement
              base={base}
              paiements={compte.paiements.filter((p) => !p.annule).map((p) => ({
                id: p.id,
                libelle: `Reçu n° ${String(p.numeroRecu).padStart(6, "0")} — ${p.libelle} (${fcfa(p.montant)})`,
              }))}
              onSucces={onSucces}
            />
          )}
        </Card>
      </div>

      {peutEcrire && (
        <Card>
          <h3 className="mb-2 inline-flex items-center gap-2 font-display text-sm font-bold text-forest-900">
            <Lock size={16} className="text-forest-600" /> Clôturer le compte (transfert / démission)
          </h3>
          <p className="mb-2 text-xs text-ink-700/60">
            Suspend les créances futures non entamées, constate le solde et journalise l&apos;opération.
            Le relevé imprimable arrivera avec une prochaine spécification.
          </p>
          <FormCloture base={base} onSucces={onSucces} />
        </Card>
      )}
    </div>
  );
}

function ListeSimple({
  lignes, vide, onSucces,
}: {
  lignes: { id: string; texte: string; annulation?: { action: ActionServeur; champs: Record<string, string> } }[];
  vide: string;
  onSucces: (message?: string) => void;
}) {
  if (lignes.length === 0) return <p className="text-sm text-ink-700/60">{vide}</p>;
  return (
    <ul className="divide-y divide-cream-100 text-sm">
      {lignes.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="min-w-0 flex-1">{l.texte}</span>
          {l.annulation && (
            <BoutonActionConfirmee
              libelle="Annuler" icone={Ban} ton="danger"
              action={l.annulation.action} champs={l.annulation.champs} onSucces={onSucces}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Formulaires du compte (exonération, bourse, plan, avance, remboursement, clôture) ──

function FormExoneration({
  base, frais, onSucces,
}: {
  base: Record<string, string>;
  frais: FraisVue[];
  onSucces: (message?: string) => void;
}) {
  const [etat, action] = useActionState(accorderExoneration, INITIAL);
  const [type, setType] = useState<"totale" | "partielle">("partielle");
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => {
    setResetKey((k) => k + 1);
    onSucces(etat.message);
  });

  return (
    <form key={resetKey} action={action} className="mt-3 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      {Object.entries(base).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Accorder une exonération</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="partielle">Partielle</option>
          <option value="totale">Totale</option>
        </Select>
        {type === "partielle" && <Input name="taux" inputMode="numeric" placeholder="Taux % (ou montant)" />}
        {type === "partielle" && <Input name="montant" inputMode="numeric" placeholder="Montant (F CFA)" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="fraisId" defaultValue="">
          <option value="">Tous les frais</option>
          {frais.map((f) => (
            <option key={f.id} value={f.id}>{f.libelle}</option>
          ))}
        </Select>
        <Input name="debut" type="date" title="Début de validité" />
        <Input name="fin" type="date" title="Fin de validité (facultatif)" />
      </div>
      <Input name="decision" required maxLength={300} placeholder="Décision (référence, autorité) — obligatoire" />
      <SubmitButton className="w-auto px-5">Accorder</SubmitButton>
    </form>
  );
}

function FormBourse({
  base, frais, exercice, onSucces,
}: {
  base: Record<string, string>;
  frais: FraisVue[];
  exercice: string;
  onSucces: (message?: string) => void;
}) {
  const [etat, action] = useActionState(accorderBourse, INITIAL);
  const [fraisCible, setFraisCible] = useState("");
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => {
    setResetKey((k) => k + 1);
    setFraisCible("");
    onSucces(etat.message);
  });

  return (
    <form key={resetKey} action={action} className="mt-3 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      {Object.entries(base).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="fraisCibles" value={fraisCible ? JSON.stringify([fraisCible]) : "null"} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Accorder une bourse</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="type" defaultValue="nationale">
          {Object.entries(LIBELLE_TYPE_BOURSE).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Input name="organisme" maxLength={120} placeholder="Organisme (facultatif)" />
        <Input name="periode" defaultValue={exercice} maxLength={20} placeholder="Période" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input name="taux" inputMode="numeric" placeholder="Taux %" />
        <Input name="montantFixe" inputMode="numeric" placeholder="OU montant fixe (F CFA)" />
        <Select value={fraisCible} onChange={(e) => setFraisCible(e.target.value)}>
          <option value="">Tous les frais</option>
          {frais.map((f) => (
            <option key={f.id} value={f.id}>{f.libelle}</option>
          ))}
        </Select>
      </div>
      <SubmitButton className="w-auto px-5">Accorder</SubmitButton>
    </form>
  );
}

function FormPlanPaiement({
  base, creances, onSucces,
}: {
  base: Record<string, string>;
  creances: { id: string; libelle: string }[];
  onSucces: (message?: string) => void;
}) {
  const [etat, action] = useActionState(enregistrerPlanPaiement, INITIAL);
  const [echeances, setEcheances] = useState<{ date: string; montant: string }[]>([{ date: "", montant: "" }]);
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => {
    setResetKey((k) => k + 1);
    setEcheances([{ date: "", montant: "" }]);
    onSucces(etat.message);
  });
  const json = JSON.stringify(
    echeances.filter((e) => e.date && Number(e.montant) > 0).map((e) => ({ date: e.date, montant: Number(e.montant) })),
  );

  return (
    <form key={resetKey} action={action} className="mt-3 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      {Object.entries(base).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="echeances" value={json} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Nouveau plan de paiement (≤ 36 échéances)</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="libelle" maxLength={120} placeholder="Libellé (facultatif)" />
        <Select name="creanceId" defaultValue="">
          <option value="">Tout le compte</option>
          {creances.map((c) => (
            <option key={c.id} value={c.id}>{c.libelle}</option>
          ))}
        </Select>
      </div>
      {echeances.map((e, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <Input type="date" value={e.date} onChange={(ev) => setEcheances(echeances.map((x, j) => (j === i ? { ...x, date: ev.target.value } : x)))} />
          <Input inputMode="numeric" placeholder="Montant" value={e.montant} onChange={(ev) => setEcheances(echeances.map((x, j) => (j === i ? { ...x, montant: ev.target.value.replace(/[^\d]/g, "") } : x)))} />
          <button type="button" onClick={() => setEcheances(echeances.filter((_, j) => j !== i))} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50">
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => echeances.length < 36 && setEcheances([...echeances, { date: "", montant: "" }])}
          className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 hover:underline"
        >
          <Plus size={13} /> Ajouter une échéance
        </button>
        <SubmitButton className="w-auto px-5">Enregistrer le plan</SubmitButton>
      </div>
    </form>
  );
}

function FormAvance({ base, onSucces }: { base: Record<string, string>; onSucces: (message?: string) => void }) {
  const [etat, action] = useActionState(enregistrerAvance, INITIAL);
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => {
    setResetKey((k) => k + 1);
    onSucces(etat.message);
  });
  return (
    <form key={resetKey} action={action} className="mt-3 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      {Object.entries(base).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Enregistrer une avance / un acompte</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input name="montant" required inputMode="numeric" placeholder="Montant (F CFA)" />
        <Select name="mode" defaultValue="especes">
          {Object.entries(LIBELLE_MODE).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Input name="reference" maxLength={80} placeholder="Référence (facultatif)" />
      </div>
      <SubmitButton className="w-auto px-5">Enregistrer l&apos;avance</SubmitButton>
    </form>
  );
}

function FormRemboursement({
  base, paiements, onSucces,
}: {
  base: Record<string, string>;
  paiements: { id: string; libelle: string }[];
  onSucces: (message?: string) => void;
}) {
  const [etat, action] = useActionState(demanderRemboursement, INITIAL);
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => {
    setResetKey((k) => k + 1);
    onSucces(etat.message);
  });
  return (
    <form key={resetKey} action={action} className="mt-3 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      {Object.entries(base).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Demander un remboursement</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select name="paiementId" defaultValue="">
          <option value="">— Sans paiement d&apos;origine —</option>
          {paiements.map((p) => (
            <option key={p.id} value={p.id}>{p.libelle}</option>
          ))}
        </Select>
        <Input name="montant" required inputMode="numeric" placeholder="Montant (F CFA)" />
      </div>
      <Input name="motif" required maxLength={300} placeholder="Motif (obligatoire)" />
      <SubmitButton className="w-auto px-5">Soumettre la demande</SubmitButton>
    </form>
  );
}

function FormCloture({ base, onSucces }: { base: Record<string, string>; onSucces: (message?: string) => void }) {
  const [motif, setMotif] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300}
        placeholder="Motif (transfert, démission…) — obligatoire" className="max-w-md"
      />
      <BoutonActionConfirmee
        libelle="Clôturer le compte" icone={Lock} ton="danger"
        action={cloturerCompteEleve}
        champs={{ ...base, motif }}
        onSucces={onSucces}
        desactive={!motif.trim()}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Aides & remboursements (file d'instruction de l'établissement)
// ─────────────────────────────────────────────────────────────

export function OngletAidesScolarite({
  remboursements, exonerations, bourses, peutEcrire, onApres,
}: {
  remboursements: RemboursementVue[];
  exonerations: ExonerationVue[];
  bourses: BourseVue[];
  peutEcrire: boolean;
  onApres?: (message?: string) => void;
}) {
  const rafraichir = (message?: string) => onApres?.(message);
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Undo2 size={18} className="text-forest-600" /> Demandes de remboursement à instruire
        </h2>
        <p className="mb-3 text-xs text-ink-700/60">
          Workflow : demande → validation/refus → paiement (le paiement crée le décaissement au journal, catégorie 65).
          Les demandes se déposent depuis le Compte financier de l&apos;élève.
        </p>
        {remboursements.length === 0 ? (
          <p className="text-sm text-ink-700/60">Aucune demande en cours.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Élève</th>
                  <th className="py-1.5 pr-2 text-right">Montant</th>
                  <th className="py-1.5 pr-2">Motif</th>
                  <th className="py-1.5 pr-2">État</th>
                  {peutEcrire && <th className="py-1.5 text-right">Décision</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {remboursements.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-2 font-medium text-forest-900">{r.eleveNom}</td>
                    <td className="py-2 pr-2 text-right">{fcfa(r.montant)}</td>
                    <td className="py-2 pr-2">{r.motif}</td>
                    <td className="py-2 pr-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.statut === "validee" ? "bg-gold-100 text-gold-800" : "bg-cream-200 text-forest-800"}`}>
                        {r.statut === "validee" ? "Validée — à payer" : "Demandée"}
                      </span>
                    </td>
                    {peutEcrire && (
                      <td className="py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {r.statut === "demandee" && (
                            <>
                              <BoutonActionConfirmee libelle="Valider" icone={Check} ton="primaire" action={deciderRemboursement} champs={{ id: r.id, decision: "valider", version: String(r.version) }} onSucces={rafraichir} />
                              <BoutonActionConfirmee libelle="Refuser" icone={Ban} ton="danger" action={deciderRemboursement} champs={{ id: r.id, decision: "refuser", version: String(r.version) }} onSucces={rafraichir} />
                            </>
                          )}
                          {r.statut === "validee" && <PayerRemboursement id={r.id} version={r.version} onSucces={rafraichir} />}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <BadgePercent size={18} className="text-forest-600" /> Dernières exonérations
          </h2>
          <ListeSimple
            vide="Aucune exonération accordée."
            lignes={exonerations.map((x) => ({
              id: x.id,
              texte: `${x.eleveNom} — ${x.type === "totale" ? "totale" : x.taux != null ? `${x.taux} %` : fcfa(x.montant ?? 0)} · ${x.decision}`,
              annulation: peutEcrire ? { action: annulerExoneration, champs: { id: x.id, version: String(x.version) } } : undefined,
            }))}
            onSucces={rafraichir}
          />
        </Card>
        <Card>
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
            <GraduationCap size={18} className="text-forest-600" /> Dernières bourses
          </h2>
          <ListeSimple
            vide="Aucune bourse accordée."
            lignes={bourses.map((b) => ({
              id: b.id,
              texte: `${b.eleveNom} — ${LIBELLE_TYPE_BOURSE[b.type] ?? b.type}, ${b.taux != null ? `${b.taux} %` : fcfa(b.montantFixe ?? 0)} · ${b.periode}`,
              annulation: peutEcrire ? { action: annulerBourse, champs: { id: b.id, version: String(b.version) } } : undefined,
            }))}
            onSucces={rafraichir}
          />
        </Card>
      </div>
    </div>
  );
}

function PayerRemboursement({ id, version, onSucces }: { id: string; version: number; onSucces: (m?: string) => void }) {
  const [mode, setMode] = useState("especes");
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select value={mode} onChange={(e) => setMode(e.target.value)} className="h-8 w-auto text-xs">
        {Object.entries(LIBELLE_MODE).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </Select>
      <BoutonActionConfirmee
        libelle="Payer" icone={HandCoins} ton="primaire"
        action={payerRemboursement} champs={{ id, mode, version: String(version) }} onSucces={onSucces}
      />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
//  Paramétrage : catégories, règles de pénalités, règles de blocage
// ─────────────────────────────────────────────────────────────

export function OngletParametrageScolarite({
  etablissementId, categories, reglesPenalites, reglesBlocage, blocages, peutEcrire, onApres,
}: {
  etablissementId: string;
  categories: CategorieFraisVue[];
  reglesPenalites: ReglePenaliteVue[];
  reglesBlocage: RegleBlocageVue[];
  blocages: ApercuBlocageVue[];
  peutEcrire: boolean;
  onApres?: (message?: string) => void;
}) {
  const rafraichir = (message?: string) => onApres?.(message);
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="mb-2 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Settings2 size={18} className="text-forest-600" /> Catégories de frais & priorité d&apos;imputation
        </h2>
        <p className="mb-3 text-xs text-ink-700/60">
          L&apos;ordre d&apos;imputation (1 = imputé en premier) pilote l&apos;affectation des avances aux créances ouvertes.
        </p>
        <ul className="divide-y divide-cream-100">
          {categories.map((c) => (
            <li key={c.id} className="py-2">
              <FormCategorie etablissementId={etablissementId} categorie={c} peutEcrire={peutEcrire} onSucces={rafraichir} />
            </li>
          ))}
        </ul>
        {peutEcrire && <FormCategorie etablissementId={etablissementId} categorie={null} peutEcrire onSucces={rafraichir} />}
      </Card>

      <Card>
        <h2 className="mb-2 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileWarning size={18} className="text-forest-600" /> Règles de pénalités
        </h2>
        <p className="mb-3 text-xs text-ink-700/60">
          Appliquées depuis le Compte financier (« Appliquer les pénalités ») — une pénalité par créance et par règle.
          Le déclencheur « rejet bancaire » attend les données bancaires (specs 09/10).
        </p>
        <ul className="divide-y divide-cream-100 text-sm">
          {reglesPenalites.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {LIBELLE_DECLENCHEUR[r.declencheur] ?? r.declencheur} — {LIBELLE_TYPE_PENALITE[r.type] ?? r.type} :{" "}
                <strong>{r.type === "fixe" ? fcfa(r.valeur) : `${r.valeur} %${r.type === "interet_journalier" ? "/jour" : ""}`}</strong>
                {r.delaiJours > 0 && ` · délai de grâce ${r.delaiJours} j`}
                {!r.actif && <span className="ml-2 rounded-full bg-cream-200 px-2 py-0.5 text-xs">inactive</span>}
              </span>
              {peutEcrire && (
                <BoutonActionConfirmee
                  libelle="Retirer" icone={Ban} ton="danger"
                  action={supprimerReglePenalite} champs={{ id: r.id, version: String(r.version) }} onSucces={rafraichir}
                />
              )}
            </li>
          ))}
          {reglesPenalites.length === 0 && <li className="py-2 text-ink-700/60">Aucune règle définie.</li>}
        </ul>
        {peutEcrire && <FormReglePenalite etablissementId={etablissementId} onSucces={rafraichir} />}
      </Card>

      <Card>
        <h2 className="mb-2 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <AlertTriangle size={18} className="text-forest-600" /> Règles de blocage pédagogique
        </h2>
        <p className="mb-3 text-xs text-ink-700/60">
          CONFIGURATION + consultation en V1 : l&apos;application effective (bulletins, compositions, réinscriptions,
          transport, cantine) sera branchée dans les modules concernés par les prochaines spécifications.
        </p>
        <ul className="divide-y divide-cream-100 text-sm">
          {reglesBlocage.map((r) => {
            const apercu = blocages.find((b) => b.regleId === r.id);
            return (
              <li key={r.id} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{LIBELLE_TYPE_BLOCAGE[r.type] ?? r.type}</strong> —{" "}
                    {r.seuilImpaye != null ? `impayé ≥ ${fcfa(r.seuilImpaye)}` : "tout impayé"}
                    {!r.actif && <span className="ml-2 rounded-full bg-cream-200 px-2 py-0.5 text-xs">inactive</span>}
                  </span>
                  {peutEcrire && (
                    <BoutonActionConfirmee
                      libelle="Retirer" icone={Ban} ton="danger"
                      action={supprimerRegleBlocage} champs={{ id: r.id, version: String(r.version) }} onSucces={rafraichir}
                    />
                  )}
                </div>
                {apercu && (
                  <p className="mt-1 text-xs text-ink-700/60">
                    {apercu.nombreBloquables === 0
                      ? "Aucun élève actuellement concerné."
                      : `${apercu.nombreBloquables} élève(s) actuellement bloquable(s)${apercu.exemples.length > 0 ? ` — ex. : ${apercu.exemples.slice(0, 5).map((e) => `${e.eleveNom} (${fcfa(e.reste)})`).join(", ")}` : ""}.`}
                  </p>
                )}
              </li>
            );
          })}
          {reglesBlocage.length === 0 && <li className="py-2 text-ink-700/60">Aucune règle de blocage définie.</li>}
        </ul>
        {peutEcrire && <FormRegleBlocage etablissementId={etablissementId} onSucces={rafraichir} />}
      </Card>
    </div>
  );
}

function FormCategorie({
  etablissementId, categorie, peutEcrire, onSucces,
}: {
  etablissementId: string;
  categorie: CategorieFraisVue | null;
  peutEcrire: boolean;
  onSucces: (message?: string) => void;
}) {
  const [etat, action] = useActionState(enregistrerCategorie, INITIAL);
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => {
    if (!categorie) setResetKey((k) => k + 1);
    onSucces(etat.message);
  });

  if (!peutEcrire && categorie) {
    return (
      <p className="text-sm">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-forest-50 text-xs font-bold text-forest-800">{categorie.ordreImputation}</span>
        {categorie.nom} {categorie.code && <span className="text-ink-700/50">({categorie.code})</span>}
      </p>
    );
  }
  return (
    <form key={resetKey} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {categorie && <input type="hidden" name="id" value={categorie.id} />}
      {categorie && <input type="hidden" name="version" value={categorie.version} />}
      <Input name="ordreImputation" defaultValue={categorie?.ordreImputation ?? ""} inputMode="numeric" placeholder="Ordre" className="w-20" title="Ordre d'imputation (1 = en premier)" />
      <Input name="nom" defaultValue={categorie?.nom ?? ""} required maxLength={80} placeholder="Nom de la catégorie" className="w-56 flex-1" />
      <Input name="code" defaultValue={categorie?.code ?? ""} maxLength={20} placeholder="Code" className="w-24" />
      <SubmitButton className="w-auto px-4">{categorie ? "Enregistrer" : "Ajouter"}</SubmitButton>
      {categorie && (
        <BoutonActionConfirmee
          libelle="Retirer" icone={Ban} ton="danger"
          action={supprimerCategorie} champs={{ id: categorie.id, version: String(categorie.version) }} onSucces={onSucces}
        />
      )}
      {etat.message && !etat.ok && <span className="w-full text-xs text-red-600">{etat.message}</span>}
    </form>
  );
}

function FormReglePenalite({ etablissementId, onSucces }: { etablissementId: string; onSucces: (m?: string) => void }) {
  const [etat, action] = useActionState(enregistrerReglePenalite, INITIAL);
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => {
    setResetKey((k) => k + 1);
    onSucces(etat.message);
  });
  return (
    <form key={resetKey} action={action} className="mt-3 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Nouvelle règle de pénalité</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <Select name="declencheur" defaultValue="echeance">
          {Object.entries(LIBELLE_DECLENCHEUR).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Select name="type" defaultValue="fixe">
          {Object.entries(LIBELLE_TYPE_PENALITE).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Input name="valeur" required inputMode="decimal" placeholder="Valeur (F ou %)" />
        <Input name="delaiJours" inputMode="numeric" placeholder="Délai de grâce (jours)" />
      </div>
      <SubmitButton className="w-auto px-5">Ajouter la règle</SubmitButton>
    </form>
  );
}

function FormRegleBlocage({ etablissementId, onSucces }: { etablissementId: string; onSucces: (m?: string) => void }) {
  const [etat, action] = useActionState(enregistrerRegleBlocage, INITIAL);
  const [resetKey, setResetKey] = useState(0);
  useApresSucces(etat, () => {
    setResetKey((k) => k + 1);
    onSucces(etat.message);
  });
  return (
    <form key={resetKey} action={action} className="mt-3 space-y-2 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Nouvelle règle de blocage</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="type" defaultValue="bulletin">
          {Object.entries(LIBELLE_TYPE_BLOCAGE).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Input name="seuilImpaye" inputMode="numeric" placeholder="Seuil d'impayé (vide = tout impayé)" />
        <Select name="actif" defaultValue="oui">
          <option value="oui">Active</option>
          <option value="non">Inactive</option>
        </Select>
      </div>
      <SubmitButton className="w-auto px-5">Enregistrer la règle</SubmitButton>
    </form>
  );
}
