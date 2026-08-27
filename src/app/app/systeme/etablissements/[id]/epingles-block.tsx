"use client";

import { useActionState } from "react";
import { Pin, Trash2 } from "lucide-react";
import { epinglerEnseignant, desepinglerEnseignant } from "./config-actions";
import { Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

type EtatForm = { ok: boolean; message?: string };
const initial: EtatForm = { ok: false };

/**
 * Épinglage MANUEL enseignant↔classe↔discipline (choix RH du chef) : le générateur d'EDT IMPOSE
 * l'enseignant désigné à cette classe pour cette discipline. Contrainte DURE ; l'auto-affectation
 * ne le remplace jamais. Même donnée que la page « Vie scolaire › Affectations ».
 */
export function EpinglesBlock({
  etablissementId,
  classes,
  disciplines,
  enseignants,
  epingles,
}: {
  etablissementId: string;
  classes: { id: string; nom: string }[];
  disciplines: { id: string; nom: string }[];
  enseignants: { id: string; nom: string }[];
  epingles: { id: string; classeNom: string; disciplineNom: string; enseignantNom: string }[];
}) {
  const [etat, action] = useActionState(epinglerEnseignant, initial);

  if (classes.length === 0 || enseignants.length === 0) {
    return (
      <p className="text-sm text-ink-700/65">
        Il faut au moins une classe et un enseignant rattaché pour épingler une affectation.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {epingles.length > 0 && (
        <ul className="divide-y divide-cream-100 rounded-xl border border-cream-200">
          {epingles.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0 text-sm text-ink-800">
                <Pin size={13} className="mr-1.5 inline fill-forest-700 text-forest-700" />
                <strong className="text-forest-900">{e.classeNom}</strong> · {e.disciplineNom} →{" "}
                <span className="font-medium">{e.enseignantNom}</span>
              </span>
              <form action={desepinglerEnseignant}>
                <input type="hidden" name="etablissementId" value={etablissementId} />
                <input type="hidden" name="affectationId" value={e.id} />
                <button
                  type="submit"
                  aria-label={`Retirer l'épinglage ${e.classeNom} ${e.disciplineNom}`}
                  title="Retirer l'épinglage (l'EDT choisira librement)"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-700/45 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-3">
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
        <input type="hidden" name="etablissementId" value={etablissementId} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="ep-classe">Classe</Label>
            <Select id="ep-classe" name="classeId" defaultValue="" required>
              <option value="" disabled>Choisir…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ep-disc">Discipline</Label>
            <Select id="ep-disc" name="disciplineId" defaultValue="" required>
              <option value="" disabled>Choisir…</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ep-ens">Enseignant imposé</Label>
            <Select id="ep-ens" name="enseignantId" defaultValue="" required>
              <option value="" disabled>Choisir…</option>
              {enseignants.map((t) => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </Select>
          </div>
        </div>
        <SubmitButton className="w-auto px-6">Épingler</SubmitButton>
      </form>
    </div>
  );
}
