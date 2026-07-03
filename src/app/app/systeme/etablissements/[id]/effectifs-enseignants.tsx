"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  enregistrerEffectifsEnseignants,
  ajouterDisciplineReferentiel,
  type EtatForm,
} from "./config-actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function EffectifsEnseignantsForm({
  etablissementId,
  disciplines,
  valeurs,
}: {
  etablissementId: string;
  disciplines: { id: string; nom: string }[];
  valeurs: Record<string, number>;
}) {
  const [etat, action] = useActionState(enregistrerEffectifsEnseignants, initial);
  // Ajout d'une discipline (ou d'un couple de disciplines) à la liste des compétences.
  const [nouvelle, setNouvelle] = useState("");
  const [messageAjout, setMessageAjout] = useState<{ ok: boolean; texte: string } | null>(null);
  const [ajoutEnCours, demarrerAjout] = useTransition();

  function ajouterDiscipline() {
    const nom = nouvelle.trim();
    if (!nom) return;
    demarrerAjout(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set("nom", nom);
      const res = await ajouterDisciplineReferentiel({ ok: false }, fd);
      setMessageAjout({ ok: res.ok, texte: res.message ?? "Erreur technique." });
      if (res.ok) setNouvelle("");
    });
  }

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left">
                <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Discipline</th>
                <th className="px-3 py-2.5 text-center font-semibold text-ink-700/70">Premier cycle</th>
                <th className="px-3 py-2.5 text-center font-semibold text-ink-700/70">Second cycle</th>
              </tr>
            </thead>
            <tbody>
              {disciplines.map((d) => (
                <tr key={d.id} className="border-b border-cream-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-forest-900">{d.nom}</td>
                  <td className="px-3 py-2 text-center">
                    {/* key liée à la valeur persistée : le champ se resynchronise après
                        enregistrement au lieu d'être vidé par le reset des actions serveur. */}
                    <input
                      key={`c:${d.id}:${valeurs[`college:${d.id}`] || 0}`}
                      type="number"
                      name={`eff_college_${d.id}`}
                      min={0}
                      defaultValue={valeurs[`college:${d.id}`] || ""}
                      placeholder="0"
                      className="h-9 w-20 rounded-lg border border-cream-300 bg-white px-2 text-center text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      key={`l:${d.id}:${valeurs[`lycee:${d.id}`] || 0}`}
                      type="number"
                      name={`eff_lycee_${d.id}`}
                      min={0}
                      defaultValue={valeurs[`lycee:${d.id}`] || ""}
                      placeholder="0"
                      className="h-9 w-20 rounded-lg border border-cream-300 bg-white px-2 text-center text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SubmitButton className="w-auto px-6">Enregistrer les effectifs enseignants</SubmitButton>
        <p className="text-xs text-ink-700/55">
          Nombre d&apos;enseignants disponibles par discipline et par cycle. Le solveur répartit ces
          enseignants (anonymes) sur les classes sans jamais les mettre en double sur un même créneau.
        </p>
      </form>

      {/* Ajout d'une discipline ou d'un couple de disciplines à la liste des compétences. */}
      <div className="border-t border-cream-100 pt-4">
        <p className="mb-1.5 text-sm font-semibold text-forest-900">
          Ajouter une discipline ou un couple de disciplines
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={nouvelle}
            onChange={(e) => setNouvelle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                ajouterDiscipline();
              }
            }}
            placeholder="Ex : Allemand, Lettres-Anglais, Histoire-Géographie…"
            className="h-10 min-w-[14rem] flex-1 rounded-xl border border-cream-300 bg-white px-3.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          <button
            type="button"
            onClick={ajouterDiscipline}
            disabled={ajoutEnCours || !nouvelle.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-forest-200 px-5 text-sm font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
          >
            {ajoutEnCours ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
          </button>
        </div>
        {messageAjout && (
          <p className={`mt-1.5 text-xs font-medium ${messageAjout.ok ? "text-forest-700" : "text-red-600"}`}>
            {messageAjout.texte}
          </p>
        )}
        <p className="mt-1 text-xs text-ink-700/55">
          La nouvelle entrée rejoint le référentiel des disciplines et apparaît dans ce tableau
          ainsi que dans les compétences des enseignants.
        </p>
      </div>
    </div>
  );
}
