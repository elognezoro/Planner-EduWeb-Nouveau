"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Check, X, BadgePercent, UsersRound } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { genererCode, traiterDemandePromo, enregistrerHabilitesRabais, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };
const inputCls =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface DemandeVue {
  id: string;
  demandeurNom: string;
  etablissementNom: string | null;
  motif: string;
  tauxDemande: number | null;
  date: string;
}

export interface CodeInstruction {
  code: string;
  libelle: string;
  pourcentage: number;
}

export function GenererCodeForm() {
  const [etat, action] = useActionState(genererCode, initial);
  return (
    <form action={action} className="space-y-3">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Code</label>
          <input name="code" required placeholder="EX : RENTREE2026" className={`${inputCls} uppercase`} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Remise (%)</label>
          <input name="pourcentage" type="number" min={0} max={100} required placeholder="20" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Libellé</label>
          <input name="libelle" required placeholder="Description du code" className={inputCls} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-forest-900">
        <input type="checkbox" name="partenaire" className="h-4 w-4 rounded border-cream-300" /> Taux préférentiel partenaire
      </label>
      <SubmitButton className="w-auto px-6">
        <Plus size={15} /> Générer le code
      </SubmitButton>
    </form>
  );
}

/** Gestion des utilisateurs HABILITÉS à voir les réductions et instruire les rabais (admin). */
export function HabilitesRabaisForm({ emails }: { emails: string }) {
  const [etat, action] = useActionState(enregistrerHabilitesRabais, initial);
  return (
    <form action={action} className="space-y-3">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <p className="flex items-center gap-1.5 text-sm font-semibold text-forest-900">
        <UsersRound size={15} /> Utilisateurs habilités à instruire les rabais
      </p>
      <p className="text-xs text-ink-700/60">
        En plus de l&apos;admin système, ces comptes (e-mails, un par ligne ou séparés par des virgules)
        voient les « Réductions disponibles » et approuvent ou refusent les demandes de rabais.
      </p>
      <textarea
        name="emails"
        rows={3}
        defaultValue={emails}
        placeholder={"exemple1@eduweb.ci\nexemple2@eduweb.ci"}
        className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />
      <SubmitButton className="w-auto px-6">Enregistrer les habilités</SubmitButton>
    </form>
  );
}

export function DemandesPromo({ demandes, codes }: { demandes: DemandeVue[]; codes: CodeInstruction[] }) {
  if (demandes.length === 0) {
    return <p className="text-sm text-ink-700/55">Aucune demande de rabais en attente.</p>;
  }
  return (
    <ul className="space-y-3">
      {demandes.map((d) => (
        <LigneDemande key={d.id} demande={d} codes={codes} />
      ))}
    </ul>
  );
}

function LigneDemande({ demande, codes }: { demande: DemandeVue; codes: CodeInstruction[] }) {
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  // Champ d'INCRÉMENT : taux librement fixé par l'instructeur (pré-rempli du taux demandé).
  const [taux, setTaux] = useState(demande.tauxDemande != null ? String(demande.tauxDemande) : "");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <li className="rounded-xl border border-cream-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-forest-900">{demande.demandeurNom}</p>
          <p className="text-xs text-ink-700/60">
            {demande.etablissementNom ? `${demande.etablissementNom} · ` : ""}
            {demande.motif}
          </p>
          {demande.tauxDemande != null && (
            <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-[0.68rem] font-semibold text-gold-800">
              <BadgePercent size={11} /> Taux souhaité : {demande.tauxDemande} %
            </p>
          )}
        </div>
        <span className="text-[0.65rem] text-ink-700/45">{demande.date}</span>
      </div>
      {msg && <p className="mt-2 text-xs text-ink-700/70">{msg}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Taux prédéfini (code promo)"
          className="h-8 rounded-lg border border-cream-300 bg-white px-2 text-xs outline-none focus:border-forest-400"
        >
          <option value="">Taux personnalisé ↓</option>
          {codes.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · −{c.pourcentage} %
            </option>
          ))}
        </select>
        <span className="relative">
          <input
            type="number"
            min={1}
            max={100}
            value={taux}
            disabled={Boolean(code)}
            onChange={(e) => setTaux(e.target.value)}
            placeholder="Taux"
            aria-label="Taux de rabais accordé (%)"
            className="h-8 w-24 rounded-lg border border-cream-300 bg-white px-2.5 pr-6 text-xs outline-none focus:border-forest-400 disabled:opacity-50"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[0.65rem] text-ink-700/45">%</span>
        </span>
        <button
          type="button"
          disabled={pending || (!code && !taux)}
          onClick={() =>
            start(async () => {
              const r = await traiterDemandePromo(demande.id, true, {
                code: code || undefined,
                taux: !code && taux ? Number(taux) : undefined,
              });
              setMsg(r.message ?? null);
            })
          }
          className="inline-flex h-8 items-center gap-1 rounded-full bg-forest-700 px-3 text-xs font-semibold text-cream-50 hover:bg-forest-800 disabled:opacity-50"
        >
          <Check size={13} /> Approuver
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await traiterDemandePromo(demande.id, false);
              setMsg(r.message ?? null);
            })
          }
          className="inline-flex h-8 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-semibold text-ink-700/70 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <X size={13} /> Refuser
        </button>
      </div>
    </li>
  );
}
