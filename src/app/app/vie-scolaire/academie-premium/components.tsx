"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Tag, CreditCard, Smartphone, BadgePercent, Crown, ShieldCheck } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import {
  FORMULES,
  MOYENS_PAIEMENT,
  formaterFcfa,
  formaterEur,
  type FormuleId,
  type ModePaiementId,
} from "@/lib/premium/formules";
import { appliquerCode, souscrire, demanderCode, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };

export interface CodeVue {
  code: string;
  libelle: string;
  pourcentage: number;
  partenaire: boolean;
}

export function OffrePremium({
  peutSouscrire,
  etablissements,
  contexteEtabNom,
  codes,
  peutVoirReductions,
  codeInitial = null,
}: {
  peutSouscrire: boolean;
  etablissements: { id: string; nom: string }[];
  contexteEtabNom: string | null;
  codes: CodeVue[];
  /** Rubrique « Réductions disponibles » : admin système + utilisateurs expressément habilités. */
  peutVoirReductions: boolean;
  /** Code pré-appliqué depuis le lien de paiement (?code=…) d'un rabais accordé — validé serveur. */
  codeInitial?: { code: string; pourcentage: number; libelle: string } | null;
}) {
  const [formuleId, setFormuleId] = useState<FormuleId>("petit");
  const [codeInput, setCodeInput] = useState(codeInitial?.code ?? "");
  const [codeApplique, setCodeApplique] = useState<{ code: string; pourcentage: number; libelle: string } | null>(codeInitial);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<ModePaiementId>("carte");
  const [etabId, setEtabId] = useState(etablissements[0]?.id ?? "");
  const [pendingCode, startCode] = useTransition();
  const [etat, action] = useActionState(souscrire, initial);

  const formule = FORMULES[formuleId];
  const pct = codeApplique?.pourcentage ?? 0;
  const reduction = Math.round((formule.fcfa * pct) / 100);
  const total = formule.fcfa - reduction;

  function appliquer() {
    startCode(async () => {
      const r = await appliquerCode(codeInput);
      if (r.ok && r.code && r.pourcentage != null) {
        setCodeApplique({ code: r.code, pourcentage: r.pourcentage, libelle: r.libelle ?? r.code });
        setCodeMsg(null);
      } else {
        setCodeApplique(null);
        setCodeMsg(r.message ?? "Code invalide.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Formules */}
      <section id="formules">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-700/55">Choisissez votre formule</p>
        <p className="mb-3 text-sm text-ink-700/60">Tarifs annuels en FCFA selon l&apos;effectif de votre établissement.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.values(FORMULES) as (typeof FORMULES)[FormuleId][]).map((f) => {
            const actif = formuleId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormuleId(f.id)}
                className={`relative rounded-2xl border p-5 text-left transition-all ${
                  actif ? "border-forest-500 bg-forest-50/40 ring-2 ring-forest-200" : "border-cream-200 bg-white hover:border-forest-300"
                }`}
              >
                {f.populaire && (
                  <span className="absolute right-4 top-4 rounded-full bg-forest-800 px-2 py-0.5 text-[0.6rem] font-bold text-gold-300">
                    Populaire
                  </span>
                )}
                <p className="font-display text-base font-bold text-forest-900">{f.libelle}</p>
                <p className="text-xs text-ink-700/60">{f.detail}</p>
                <p className="mt-3 font-display text-2xl font-bold text-forest-800">
                  {formaterFcfa(f.fcfa)}
                  <span className="text-sm font-medium text-ink-700/55">/an</span>
                </p>
                <p className="text-xs text-ink-700/50">({formaterEur(f.fcfa)})</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Réductions : la grille des codes est RÉSERVÉE à l'admin système et aux utilisateurs
          expressément habilités ; les autres disposent d'une demande de rabais (taux + motif). */}
      <section id="reductions">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-forest-900">
          <BadgePercent size={16} /> {peutVoirReductions ? "Réductions disponibles" : "Demander un rabais"}
        </p>
        {peutVoirReductions ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            {codes.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCodeInput(c.code);
                  setCodeApplique({ code: c.code, pourcentage: c.pourcentage, libelle: c.libelle });
                  setCodeMsg(null);
                }}
                className={`rounded-xl border p-3 text-left transition-colors hover:border-forest-300 ${
                  codeApplique?.code === c.code ? "border-forest-400 bg-forest-50/50" : "border-cream-200 bg-white"
                }`}
              >
                {c.partenaire && (
                  <span className="text-[0.6rem] font-bold uppercase tracking-wide text-gold-700">Taux préférentiel</span>
                )}
                <p className="text-sm font-semibold text-forest-900">−{c.pourcentage}%</p>
                <p className="truncate text-xs text-ink-700/60">{c.libelle}</p>
                <p className="mt-0.5 font-mono text-[0.65rem] text-ink-700/45">{c.code}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-4 rounded-2xl border border-cream-200 bg-cream-50/50 p-4">
            <p className="mb-3 text-xs text-ink-700/65">
              Exprimez le taux de rabais souhaité : la demande sera instruite et vous recevrez une
              notification avec le lien de paiement au taux accordé.
            </p>
            <DemanderCodeForm />
          </div>
        )}
        <p className="mb-1.5 text-xs font-medium text-ink-700/60">Vous avez reçu un code ? Appliquez-le :</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Entrez votre code promo"
            className="h-10 min-w-[12rem] flex-1 rounded-xl border border-cream-300 bg-white px-3 text-sm uppercase outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          <button
            type="button"
            onClick={appliquer}
            disabled={pendingCode || !codeInput.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
          >
            <Tag size={14} /> Appliquer
          </button>
        </div>
        {codeMsg && <p className="mt-1.5 text-xs text-red-600">{codeMsg}</p>}
        {codeApplique && (
          <p className="mt-1.5 text-xs font-semibold text-forest-700">
            Code {codeApplique.code} appliqué : −{codeApplique.pourcentage}% ({codeApplique.libelle})
          </p>
        )}
      </section>

      {/* Paiement */}
      <section id="paiement">
        <p className="mb-2 text-sm font-bold text-forest-900">Mode de paiement</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MOYENS_PAIEMENT.map((m) => {
            const actif = mode === m.id;
            const Icone = m.id === "carte" ? CreditCard : Smartphone;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  actif ? "border-forest-500 bg-forest-50/40 ring-1 ring-forest-200" : "border-cream-200 bg-white hover:border-forest-300"
                }`}
              >
                <Icone size={18} className="text-forest-700" />
                <span>
                  <span className="block text-sm font-semibold text-forest-900">{m.libelle}</span>
                  <span className="block text-xs text-ink-700/55">{m.detail}</span>
                </span>
                {actif && <Check size={16} className="ml-auto text-forest-600" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Récapitulatif + confirmation */}
      <section className="rounded-2xl border border-cream-200 bg-cream-50/60 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-700/55">Récapitulatif</p>
        {peutSouscrire && etablissements.length > 0 && (
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-forest-900">Établissement</label>
            <select
              value={etabId}
              onChange={(e) => setEtabId(e.target.value)}
              className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400"
            >
              {etablissements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        {contexteEtabNom && (
          <p className="mb-3 text-sm text-ink-700/70">
            Établissement : <span className="font-semibold text-forest-900">{contexteEtabNom}</span>
          </p>
        )}
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-700/70">Formule</dt>
            <dd className="font-medium text-forest-900">{formule.libelle}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-700/70">Tarif de base</dt>
            <dd className="text-forest-900">{formaterFcfa(formule.fcfa)}</dd>
          </div>
          {pct > 0 && (
            <div className="flex justify-between text-forest-700">
              <dt>Réduction ({codeApplique?.code} −{pct}%)</dt>
              <dd>−{formaterFcfa(reduction)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-cream-200 pt-2 text-base">
            <dt className="font-bold text-forest-900">Total</dt>
            <dd className="text-right font-display font-bold text-forest-900">
              {formaterFcfa(total)}
              <span className="block text-xs font-normal text-ink-700/55">({formaterEur(total)})</span>
            </dd>
          </div>
        </dl>

        {etat.message && (
          <div className="mt-3">
            <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
          </div>
        )}

        {peutSouscrire ? (
          <form action={action} className="mt-4">
            <input type="hidden" name="formule" value={formuleId} />
            <input type="hidden" name="modePaiement" value={mode} />
            <input type="hidden" name="code" value={codeApplique?.code ?? ""} />
            <input type="hidden" name="etablissementId" value={etabId} />
            <SubmitButton>
              <CreditCard size={16} /> Confirmer le paiement
            </SubmitButton>
          </form>
        ) : (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-cream-200 bg-white px-3 py-2.5 text-xs text-ink-700/60">
            <ShieldCheck size={14} /> La souscription est réservée aux responsables d&apos;établissement.
          </p>
        )}
      </section>
    </div>
  );
}

/** Demande de rabais : expression du taux souhaité + motif (instruite par l'admin/habilités). */
export function DemanderCodeForm() {
  const [etat, action] = useActionState(demanderCode, initial);
  return (
    <form action={action} className="space-y-3">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="relative">
          <input
            name="taux"
            type="number"
            min={1}
            max={100}
            required
            placeholder="Taux (%)"
            aria-label="Taux de rabais souhaité (%)"
            className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 pr-7 text-sm outline-none focus:border-forest-400"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-700/45">%</span>
        </div>
        <input
          name="motif"
          required
          placeholder="Motif de la demande (situation de l'établissement, effectifs…)"
          className="h-10 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400"
        />
      </div>
      <input
        name="etablissementNom"
        placeholder="Établissement (optionnel)"
        className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400"
      />
      <SubmitButton className="w-auto px-6">
        <Crown size={15} /> Demander un rabais
      </SubmitButton>
    </form>
  );
}
