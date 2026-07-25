"use client";

/**
 * Sous-module ENCAISSEMENTS (08) — enrichissements de l'onglet Encaissements :
 * tableau de bord (recettes jour/mois/année, parts par mode, top caissiers, avances,
 * remboursements) et RÈGLEMENT VENTILÉ d'une ou plusieurs factures (07) en un paiement
 * (trop-perçu conservé en avance). Confirmations 2 clics, jamais de dialogue natif.
 */

import { useActionState, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, FileText, HandCoins, PiggyBank, Undo2, UserRound, Wallet } from "lucide-react";
import { Card } from "@/components/app/ui";
import { FormAlert, Label, Input, SubmitButton } from "@/components/ui/form";
import type { EtatForm } from "@/lib/finances/actions";
import { encaisserSurFactures } from "@/lib/finances/actions-encaissements";
import type { StatistiquesEncaissementsVue } from "@/lib/finances/encaissements/types";
import type { FactureVue } from "@/lib/finances/facturation/types";
import { ChampsModeEtDate, SelecteurEleve, useApresSucces } from "./scolarite-onglets";
import { LIBELLE_MODE, fcfa, type EleveVue } from "./types";

const INITIAL: EtatForm = { ok: false };

const dateFr = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso)) : "—";

/** Bandeau KPI des encaissements (08) — données agrégées côté serveur. */
export function BandeauEncaissements({ stats }: { stats: StatistiquesEncaissementsVue }) {
  const cartes: { libelle: string; valeur: string; Icone: typeof Wallet; ton?: "gold" }[] = [
    { libelle: `Encaissé aujourd'hui (${stats.nombreJour} reçu${stats.nombreJour > 1 ? "s" : ""})`, valeur: fcfa(stats.jour), Icone: CalendarDays },
    { libelle: "Encaissé ce mois", valeur: fcfa(stats.mois), Icone: CalendarClock },
    { libelle: "Encaissé cette année", valeur: fcfa(stats.annee), Icone: Wallet },
    { libelle: "Avances disponibles", valeur: fcfa(stats.avancesDisponibles), Icone: PiggyBank, ton: "gold" },
    { libelle: "Remboursements payés (année)", valeur: fcfa(stats.remboursementsPayes), Icone: Undo2, ton: "gold" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cartes.map((c) => (
          <div key={c.libelle} className="rounded-2xl border border-cream-200 bg-white p-3.5 shadow-soft">
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${c.ton === "gold" ? "bg-gold-100 text-gold-700" : "bg-forest-50 text-forest-700"}`}>
              <c.Icone size={15} />
            </span>
            <p className="mt-1.5 font-display text-base font-bold text-forest-900">{c.valeur}</p>
            <p className="text-xs text-ink-700/60">{c.libelle}</p>
          </div>
        ))}
      </div>
      {(stats.parMode.length > 0 || stats.parCaissier.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-cream-200 bg-white p-3.5 shadow-soft">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Parts par moyen de paiement (année)</p>
            {stats.parMode.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucun encaissement cette année.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {stats.parMode.map((m) => (
                  <li key={m.mode} className="flex items-center justify-between gap-2">
                    <span>{LIBELLE_MODE[m.mode] ?? m.mode}</span>
                    <span className="font-medium text-forest-900">{fcfa(m.total)} <span className="text-xs text-ink-700/55">({m.pourcentage} %)</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-cream-200 bg-white p-3.5 shadow-soft">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700/55">
              <UserRound size={13} /> Encaissements par caissier (année)
            </p>
            {stats.parCaissier.length === 0 ? (
              <p className="text-sm text-ink-700/60">Aucun caissier identifié.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {stats.parCaissier.map((c) => (
                  <li key={c.nom} className="flex items-center justify-between gap-2">
                    <span>{c.nom}</span>
                    <span className="font-medium text-forest-900">{fcfa(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * RÈGLEMENT VENTILÉ (08) : choisir un élève, cocher ses factures ouvertes, encaisser en un
 * reçu — répartition par échéance, trop-perçu conservé en avance. Le paiement multi-mode du
 * 08 se réalise par plusieurs encaissements successifs sur les mêmes factures.
 */
export function ReglerFactures({
  etablissementId, eleves, factures,
}: {
  etablissementId: string;
  eleves: EleveVue[];
  factures: FactureVue[];
}) {
  const [etat, action] = useActionState(encaisserSurFactures, INITIAL);
  const [eleveId, setEleveId] = useState("");
  const [choisies, setChoisies] = useState<Set<string>>(new Set());
  const [montant, setMontant] = useState("");
  const [resetKey, setResetKey] = useState(0);

  useApresSucces(etat, () => {
    setChoisies(new Set());
    setMontant("");
    setResetKey((k) => k + 1);
  });

  const ouvertes = useMemo(
    () =>
      factures
        .filter(
          (f) =>
            f.eleveId === eleveId &&
            f.type === "facture" &&
            (f.statut === "emise" || f.statut === "partiellement_payee") &&
            f.netDu - f.paye > 0,
        )
        .map((f) => ({ ...f, reste: Math.max(0, f.netDu - f.paye) })),
    [factures, eleveId],
  );
  const totalChoisi = ouvertes.filter((f) => choisies.has(f.id)).reduce((s, f) => s + f.reste, 0);

  function basculer(id: string) {
    const suivantes = new Set(choisies);
    if (suivantes.has(id)) suivantes.delete(id);
    else suivantes.add(id);
    setChoisies(suivantes);
  }

  return (
    <Card>
      <h2 className="mb-1 inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
        <FileText size={18} className="text-forest-600" /> Régler des factures (paiement ventilé)
      </h2>
      <p className="mb-3 text-xs text-ink-700/60">
        Un seul reçu peut solder plusieurs factures : répartition sur les restes dus dans l&apos;ordre des
        échéances ; tout trop-perçu est conservé en AVANCE sur le compte de l&apos;élève.
      </p>

      <form key={resetKey} action={action} className="space-y-3">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        <input type="hidden" name="eleveId" value={eleveId} />
        <input type="hidden" name="factureIds" value={JSON.stringify([...choisies])} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

        <div>
          <Label>Élève</Label>
          <SelecteurEleve
            eleves={eleves}
            valeur={eleveId}
            onChange={(id) => { setEleveId(id); setChoisies(new Set()); setMontant(""); }}
            name="eleveRecherche"
          />
        </div>

        {eleveId && (
          ouvertes.length === 0 ? (
            <p className="rounded-2xl border border-cream-200 bg-cream-50/50 px-3 py-2 text-sm text-ink-700/60">
              Aucune facture ouverte pour cet élève (émettez d&apos;abord ses factures à l&apos;onglet Facturation).
            </p>
          ) : (
            <div className="space-y-1 rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
              {ouvertes.map((f) => (
                <label key={f.id} className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-forest-50">
                  <span className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={choisies.has(f.id)} onChange={() => basculer(f.id)} className="accent-forest-700" />
                    <span className="font-mono text-xs text-ink-700/70">{f.numero ?? "—"}</span>
                    <span className="font-medium text-forest-900">{f.objet}</span>
                    <span className="text-xs text-ink-700/55">échéance {dateFr(f.dateEcheance)}</span>
                  </span>
                  <span>Reste dû : <strong className="text-red-700">{fcfa(f.reste)}</strong></span>
                </label>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 pt-2">
                <p className="text-xs text-ink-700/60">
                  {choisies.size} facture(s) cochée(s) — restes cumulés : <strong>{fcfa(totalChoisi)}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setMontant(String(totalChoisi))}
                  disabled={totalChoisi === 0}
                  className="rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-forest-800 hover:bg-forest-50 disabled:opacity-40"
                >
                  Reporter ce total dans le montant
                </button>
              </div>
            </div>
          )
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="montant-ventile">Montant encaissé (F CFA)</Label>
            <Input
              id="montant-ventile" name="montant" required inputMode="numeric"
              value={montant} onChange={(e) => setMontant(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Ex. : 100000"
            />
          </div>
        </div>

        <ChampsModeEtDate />

        <SubmitButton className="w-auto px-6" disabled={choisies.size === 0}>
          <HandCoins size={16} /> Encaisser et ventiler
        </SubmitButton>
      </form>
    </Card>
  );
}
