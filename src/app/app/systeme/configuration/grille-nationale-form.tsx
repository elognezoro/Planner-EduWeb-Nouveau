"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { enregistrerGrilleNationale, type EtatForm } from "./actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { PAYS_ONU } from "@/lib/referentiels/pays";
import { drapeauUrl, trouverPays } from "@/lib/referentiels/pays";

const initial: EtatForm = { ok: false };

/** Filtre pays en tête de page : les conditions nationales sont définies pays par pays. */
export function FiltrePaysConfiguration({ pays }: { pays: string }) {
  const router = useRouter();
  const info = trouverPays(pays);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cream-200 bg-white px-4 py-3 shadow-soft">
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-700/55">
        Pays
      </span>
      {info && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={drapeauUrl(info.code, 40)} alt="" className="h-4 w-6 rounded-sm object-cover" />
      )}
      <select
        value={pays}
        onChange={(e) => router.push(`/app/systeme/configuration?pays=${encodeURIComponent(e.target.value)}`)}
        className="h-10 rounded-full border border-cream-300 bg-white px-4 pr-8 text-sm font-medium text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        aria-label="Pays dont on définit les conditions nationales"
      >
        {PAYS_ONU.map((p) => (
          <option key={p.code} value={p.nom}>
            {p.nom}
          </option>
        ))}
      </select>
      <span className="text-xs text-ink-700/55">
        Les paramètres ci-dessous (grille horaire nationale…) s&apos;appliquent par défaut aux
        établissements de ce pays — chaque établissement peut ensuite les personnaliser.
      </span>
    </div>
  );
}

/**
 * Grille horaire nationale ÉDITABLE : heures hebdomadaires par niveau × discipline pour
 * le pays sélectionné. Vide ou 0 = pas de cours (tiret). Les établissements du pays
 * héritent de ce modèle et peuvent le personnaliser dans leur console (bloc Volumes).
 */
export function GrilleNationaleForm({
  pays,
  niveaux,
  disciplines,
  heures,
}: {
  pays: string;
  niveaux: { id: string; nom: string }[];
  disciplines: { id: string; nom: string; couleur: string | null }[];
  heures: Record<string, number>;
}) {
  const [etat, action] = useActionState(enregistrerGrilleNationale, initial);

  return (
    <form action={action}>
      <input type="hidden" name="pays" value={pays} />
      {etat.message && (
        <div className="mb-3">
          <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left">
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Discipline</th>
              {niveaux.map((n) => (
                <th key={n.id} className="px-1 py-2.5 text-center font-semibold text-ink-700/70">
                  {n.nom}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {disciplines.map((d) => (
              <tr key={d.id} className="border-b border-cream-100 last:border-0">
                <td className="py-2 pr-4 font-medium text-forest-900">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                    style={{ backgroundColor: d.couleur ?? "#999" }}
                  />
                  {d.nom}
                </td>
                {niveaux.map((n) => {
                  const valeur = heures[`${n.id}:${d.id}`] ?? 0;
                  return (
                    <td key={n.id} className="px-1 py-1.5 text-center">
                      {/* key liée à la valeur persistée : resynchronisation après enregistrement. */}
                      <input
                        key={`${pays}:${n.id}:${d.id}:${valeur}`}
                        type="number"
                        name={`h:${n.id}:${d.id}`}
                        min={0}
                        max={40}
                        step={0.5}
                        defaultValue={valeur || ""}
                        placeholder="—"
                        aria-label={`${d.nom} — ${n.nom} (heures / semaine)`}
                        className="h-8 w-14 rounded-lg border border-cream-300 bg-white px-1 text-center text-sm outline-none placeholder:text-ink-700/25 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <SubmitButton className="w-auto px-6">Enregistrer la grille nationale</SubmitButton>
      </div>
    </form>
  );
}
