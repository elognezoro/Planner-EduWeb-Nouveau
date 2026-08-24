"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2, Save, DoorClosed } from "lucide-react";
import { enregistrerSalles, type EtatForm } from "./config-actions";
import { Input, Select, FormAlert, SubmitButton } from "@/components/ui/form";

const TYPES = [
  { v: "ordinaire", l: "Salle ordinaire" },
  { v: "laboratoire", l: "Laboratoire" },
  { v: "salle_informatique", l: "Salle informatique" },
  { v: "atelier", l: "Atelier" },
  { v: "salle_eps", l: "Salle / espace EPS" },
  { v: "autre", l: "Autre" },
];

export interface SalleInitiale {
  id: string;
  nom: string;
  capacite: number;
  type: string;
  classeIds: string[];
}

interface Ligne {
  id?: string;
  nom: string;
  capacite: number;
  type: string;
  classeIds: string[];
}

/**
 * Désignation des salles (nom personnalisé, capacité, type) et AFFECTATION aux classes
 * pédagogiques. En double vacation, une même salle physique peut être affectée à DEUX classes
 * (matin + après-midi) : deux emplacements de classe par salle. Les noms saisis ici sont ceux
 * qui apparaîtront sur les emplois du temps.
 */
export function SallesBlock({
  etablissementId,
  sallesInitiales,
  classes,
}: {
  etablissementId: string;
  sallesInitiales: SalleInitiale[];
  classes: { id: string; nom: string }[];
}) {
  const [salles, setSalles] = useState<Ligne[]>(() => sallesInitiales.map((s) => ({ ...s, classeIds: [...s.classeIds] })));
  const [etat, action] = useActionState(enregistrerSalles, { ok: false } as EtatForm);

  const assignees = useMemo(() => new Set(salles.flatMap((s) => s.classeIds)), [salles]);

  const majLigne = (i: number, patch: Partial<Ligne>) => setSalles((p) => p.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setSlot = (i: number, slot: 0 | 1, cid: string) =>
    setSalles((p) =>
      p.map((s, j) => {
        if (j !== i) return s;
        const arr = [s.classeIds[0] ?? "", s.classeIds[1] ?? ""];
        arr[slot] = cid;
        return { ...s, classeIds: arr.filter(Boolean) };
      }),
    );
  const ajouter = () => setSalles((p) => [...p, { nom: "", capacite: 40, type: "ordinaire", classeIds: [] }]);
  const supprimer = (i: number) => setSalles((p) => p.filter((_, j) => j !== i));

  // Options d'un emplacement : classes NON déjà affectées ailleurs, + la sélection courante.
  const optionsSlot = (courant: string) => classes.filter((c) => !assignees.has(c.id) || c.id === courant);

  const nbAffectees = assignees.size;
  const chargeUtile = JSON.stringify(
    salles.map((s) => ({ id: s.id, nom: s.nom.trim(), capacite: s.capacite, type: s.type, classeIds: s.classeIds })),
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-700/60">
        Nommez vos salles physiques et affectez-les aux classes pédagogiques. En double vacation, une
        même salle peut servir <strong>deux classes</strong> (une le matin, une l&apos;après-midi). Les
        noms saisis ici sont ceux qui apparaîtront sur les emplois du temps ; les classes non affectées
        reçoivent une salle au choix du générateur.
      </p>

      <div className="space-y-3">
        {salles.length === 0 && (
          <p className="rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 px-4 py-6 text-center text-sm text-ink-700/55">
            Aucune salle nommée. Ajoutez vos salles ci-dessous.
          </p>
        )}
        {salles.map((s, i) => {
          const c0 = s.classeIds[0] ?? "";
          const c1 = s.classeIds[1] ?? "";
          return (
            <div key={s.id ?? `nouvelle-${i}`} className="rounded-2xl border border-cream-200 bg-cream-50/50 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_100px_170px_auto]">
                <Input
                  placeholder="Nom de la salle (ex. Salle 12, Bâtiment A-101)"
                  value={s.nom}
                  onChange={(e) => majLigne(i, { nom: e.target.value })}
                  maxLength={80}
                />
                <Input
                  type="number"
                  min={0}
                  max={2000}
                  placeholder="Capacité"
                  value={s.capacite || ""}
                  onChange={(e) => majLigne(i, { capacite: Math.max(0, Number(e.target.value) || 0) })}
                />
                <Select value={s.type} onChange={(e) => majLigne(i, { type: e.target.value })}>
                  {TYPES.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => supprimer(i)}
                  aria-label="Supprimer cette salle"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cream-300 text-ink-700/60 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-forest-900">Classe affectée</span>
                  <Select value={c0} onChange={(e) => setSlot(i, 0, e.target.value)}>
                    <option value="">— aucune —</option>
                    {optionsSlot(c0).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-forest-900">
                    2<sup>e</sup> classe <span className="text-ink-700/50">(double vacation)</span>
                  </span>
                  <Select value={c1} onChange={(e) => setSlot(i, 1, e.target.value)} disabled={!c0}>
                    <option value="">— aucune —</option>
                    {optionsSlot(c1).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={ajouter}
        className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50"
      >
        <Plus size={15} /> Ajouter une salle
      </button>

      <form action={action} className="flex flex-wrap items-center gap-3 border-t border-cream-200 pt-4">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        <input type="hidden" name="salles" value={chargeUtile} />
        <SubmitButton className="w-auto px-6">
          <Save size={16} /> Enregistrer les salles
        </SubmitButton>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-700/55">
          <DoorClosed size={14} /> {salles.length} salle(s) · {nbAffectees} classe(s) affectée(s)
        </span>
      </form>

      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
    </div>
  );
}
