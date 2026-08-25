"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2, Save, DoorClosed, ChevronDown } from "lucide-react";
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
const LIBELLE_TYPE = new Map(TYPES.map((t) => [t.v, t.l]));

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
  /** UI seulement : le volet accordéon est-il déplié ? (jamais envoyé au serveur). */
  ouverte?: boolean;
}

/**
 * Désignation des salles (nom personnalisé, capacité, type) et AFFECTATION aux classes
 * pédagogiques, présentée en ACCORDÉON (une salle repliable par ligne — gain de place sur les
 * grands établissements). En double vacation, une même salle physique peut être affectée à DEUX
 * classes (matin + après-midi) : on choisit chaque classe dans une LISTE DÉROULANTE. Les noms
 * saisis ici sont ceux qui apparaîtront sur les emplois du temps.
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
  // Salles repliées par défaut (gain de place) ; une salle nouvellement ajoutée s'ouvre.
  const [salles, setSalles] = useState<Ligne[]>(() =>
    sallesInitiales.map((s) => ({ ...s, classeIds: [...s.classeIds], ouverte: false })),
  );
  const [etat, action] = useActionState(enregistrerSalles, { ok: false } as EtatForm);

  const nomClasse = useMemo(() => new Map(classes.map((c) => [c.id, c.nom])), [classes]);
  const assignees = useMemo(() => new Set(salles.flatMap((s) => s.classeIds)), [salles]);

  const majLigne = (i: number, patch: Partial<Ligne>) => setSalles((p) => p.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const basculer = (i: number) => setSalles((p) => p.map((s, j) => (j === i ? { ...s, ouverte: !s.ouverte } : s)));
  const setSlot = (i: number, slot: 0 | 1, cid: string) =>
    setSalles((p) =>
      p.map((s, j) => {
        if (j !== i) return s;
        const arr = [s.classeIds[0] ?? "", s.classeIds[1] ?? ""];
        arr[slot] = cid;
        return { ...s, classeIds: arr.filter(Boolean) };
      }),
    );
  const ajouter = () => setSalles((p) => [...p, { nom: "", capacite: 40, type: "ordinaire", classeIds: [], ouverte: true }]);
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
        Nommez vos salles physiques et affectez-les aux classes pédagogiques via les listes déroulantes.
        En double vacation, une même salle peut servir <strong>deux classes</strong> (une le matin, une
        l&apos;après-midi). Chaque salle se replie/déplie pour gagner de la place. Les classes non affectées
        reçoivent une salle au choix du générateur.
      </p>

      <div className="space-y-2">
        {salles.length === 0 && (
          <p className="rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 px-4 py-6 text-center text-sm text-ink-700/55">
            Aucune salle nommée. Ajoutez vos salles ci-dessous.
          </p>
        )}
        {salles.map((s, i) => {
          const c0 = s.classeIds[0] ?? "";
          const c1 = s.classeIds[1] ?? "";
          const resume = s.classeIds.map((cid) => nomClasse.get(cid) ?? "?").join(" · ");
          return (
            <div key={s.id ?? `nouvelle-${i}`} className="overflow-hidden rounded-2xl border border-cream-200 bg-cream-50/50">
              {/* En-tête d'accordéon : bascule + résumé + suppression */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => basculer(i)}
                  aria-expanded={!!s.ouverte}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-ink-700/45 transition-transform ${s.ouverte ? "" : "-rotate-90"}`}
                  />
                  <DoorClosed size={15} className="shrink-0 text-forest-700/70" />
                  <span className="truncate font-semibold text-forest-900">
                    {s.nom.trim() || <span className="italic text-ink-700/45">Nouvelle salle</span>}
                  </span>
                  <span className="shrink-0 rounded-full bg-cream-100 px-2 py-0.5 text-[0.65rem] font-medium text-ink-700/60">
                    {LIBELLE_TYPE.get(s.type) ?? s.type}
                  </span>
                  {s.classeIds.length > 0 ? (
                    <span className="truncate text-xs text-ink-700/55">
                      {s.classeIds.length} classe(s) : {resume}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs italic text-ink-700/40">aucune classe affectée</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => supprimer(i)}
                  aria-label="Supprimer cette salle"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cream-300 text-ink-700/60 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Corps d'accordéon : édition */}
              {s.ouverte && (
                <div className="border-t border-cream-200 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_110px_180px]">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-forest-900">Nom de la salle</span>
                      <Input
                        placeholder="Ex. Salle 12, Bâtiment A-101, LABO 1"
                        value={s.nom}
                        onChange={(e) => majLigne(i, { nom: e.target.value })}
                        maxLength={80}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-forest-900">Capacité</span>
                      <Input
                        type="number"
                        min={0}
                        max={2000}
                        placeholder="Capacité"
                        value={s.capacite || ""}
                        onChange={(e) => majLigne(i, { capacite: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-forest-900">Type</span>
                      <Select value={s.type} onChange={(e) => majLigne(i, { type: e.target.value })}>
                        {TYPES.map((t) => (
                          <option key={t.v} value={t.v}>
                            {t.l}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  <p className="mb-1.5 mt-3 text-xs font-semibold text-forest-900">
                    Classes affectées <span className="font-normal text-ink-700/50">(jusqu&apos;à 2 — double vacation : matin + après-midi)</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[0.7rem] font-medium text-ink-700/60">1<sup>re</sup> classe (matin)</span>
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
                      <span className="mb-1 block text-[0.7rem] font-medium text-ink-700/60">
                        2<sup>e</sup> classe (après-midi) <span className="text-ink-700/40">— optionnel</span>
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
              )}
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
