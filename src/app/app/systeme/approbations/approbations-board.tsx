"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock4, Send, Loader2, Users, X } from "lucide-react";
import { Card, Badge } from "@/components/app/ui";
import { RowActions } from "./row-actions";
import { EchangeDemande, type EchangeVue } from "./echange-demande";
import { envoyerMessageGroupe } from "./actions";

export type ItemDemande = {
  id: string;
  nomComplet: string;
  email: string;
  roleLibelle: string;
  structureDeclaree: string | null;
  dateFr: string;
  libellePortee?: string;
  rechercheEtablissement: boolean;
  options: { id: string; nom: string }[];
  suggestion: { id: string; nom: string; score: number } | null;
  echanges: EchangeVue[];
};

export function ApprobationsBoard({ items }: { items: ItemDemande[] }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, start] = useTransition();

  const toutSelectionne = selection.size === items.length && items.length > 0;
  const basculer = (id: string) =>
    setSelection((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toutBasculer = () =>
    setSelection((s) => (s.size === items.length ? new Set() : new Set(items.map((i) => i.id))));

  const envoyerGroupe = () => {
    const t = texte.trim();
    if (!t || selection.size === 0 || envoi) return;
    setErreur(null);
    start(async () => {
      const r = await envoyerMessageGroupe([...selection], t);
      if (r.ok) { setTexte(""); setSelection(new Set()); router.refresh(); }
      else setErreur(r.message ?? "Envoi impossible.");
    });
  };

  return (
    <div className="space-y-4">
      {/* Barre de sélection / message groupé */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-2.5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-forest-800">
          <input type="checkbox" checked={toutSelectionne} onChange={toutBasculer} className="h-4 w-4 rounded border-cream-300" />
          {selection.size > 0 ? `${selection.size} sélectionnée(s)` : "Tout sélectionner"}
        </label>
        {selection.size > 0 && (
          <button type="button" onClick={() => setSelection(new Set())} className="inline-flex items-center gap-1 text-xs font-medium text-ink-700/60 hover:text-ink-800">
            <X size={14} /> Effacer la sélection
          </button>
        )}
      </div>

      {selection.size > 0 && (
        <Card className="space-y-3 border-forest-200 bg-forest-50/50">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900">
            <Users size={16} /> Message groupé à {selection.size} demandeur(s)
          </p>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={3}
            placeholder="Votre message (par ex. précisions demandées avant validation)…"
            className="w-full resize-none rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          {erreur && <p className="text-xs font-medium text-amber-700">{erreur}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.65rem] text-ink-700/45">Chaque demandeur reçoit le message par e-mail ; copie à l&apos;administration.</p>
            <button
              type="button"
              onClick={envoyerGroupe}
              disabled={envoi || !texte.trim()}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
            >
              {envoi ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Envoyer à {selection.size}
            </button>
          </div>
        </Card>
      )}

      {/* Cartes de demandes */}
      <div className="space-y-4">
        {items.map((d) => (
          <Card key={d.id} className={`flex flex-col gap-4 ${selection.has(d.id) ? "ring-1 ring-forest-300" : ""}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <input
                  type="checkbox"
                  checked={selection.has(d.id)}
                  onChange={() => basculer(d.id)}
                  aria-label={`Sélectionner ${d.nomComplet}`}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-cream-300"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-forest-900">{d.nomComplet}</p>
                    <Badge ton="attente">{d.roleLibelle}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-ink-700/65">{d.email}</p>
                  {d.structureDeclaree && (
                    <p className="mt-1 text-sm text-ink-700/65">
                      Structure déclarée : <span className="font-medium">{d.structureDeclaree}</span>
                    </p>
                  )}
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-700/50">
                    <Clock4 size={13} /> Demande du {d.dateFr}
                  </p>
                </div>
              </div>
              <RowActions
                demandeId={d.id}
                libellePortee={d.libellePortee}
                rechercheEtablissement={d.rechercheEtablissement}
                options={d.options}
                suggestion={d.suggestion}
              />
            </div>

            <EchangeDemande demandeId={d.id} echanges={d.echanges} />
          </Card>
        ))}
      </div>
    </div>
  );
}
