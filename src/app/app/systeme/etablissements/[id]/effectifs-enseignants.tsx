"use client";

import { Fragment, useActionState, useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  enregistrerEffectifsEnseignants,
  ajouterDisciplineReferentiel,
  renommerDisciplineDepuisEtab,
  retirerDisciplineEtablissement,
  type EtatForm,
} from "./config-actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function EffectifsEnseignantsForm({
  etablissementId,
  disciplines,
  valeurs,
  volume1erCycle,
  volume2ndCycle,
}: {
  etablissementId: string;
  disciplines: { id: string; nom: string }[];
  valeurs: Record<string, number>;
  volume1erCycle: number;
  volume2ndCycle: number;
}) {
  const [etat, action] = useActionState(enregistrerEffectifsEnseignants, initial);
  // Ajout d'une discipline (ou d'un couple de disciplines) à la liste des compétences.
  const [nouvelle, setNouvelle] = useState("");
  const [messageAjout, setMessageAjout] = useState<{ ok: boolean; texte: string } | null>(null);
  const [ajoutEnCours, demarrerAjout] = useTransition();
  // Retrait d'une discipline de la liste de CET établissement (confirmation par ligne).
  const [confirmeRetrait, setConfirmeRetrait] = useState<string | null>(null);
  const [retraitEnCours, demarrerRetrait] = useTransition();
  // Renommage inline (correction d'orthographe) — le nom est partagé par la plateforme.
  const [editionId, setEditionId] = useState<string | null>(null);
  const [nomEdite, setNomEdite] = useState("");
  const [renommageEnCours, demarrerRenommage] = useTransition();

  function renommerDiscipline(disciplineId: string, ancienNom: string) {
    const nom = nomEdite.trim();
    if (!nom || nom === ancienNom) {
      setEditionId(null);
      return;
    }
    demarrerRenommage(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set("disciplineId", disciplineId);
      fd.set("nom", nom);
      const res = await renommerDisciplineDepuisEtab({ ok: false }, fd);
      setMessageAjout({ ok: res.ok, texte: res.message ?? "Erreur technique." });
      if (res.ok) setEditionId(null);
    });
  }

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

  function retirerDiscipline(disciplineId: string) {
    demarrerRetrait(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set("disciplineId", disciplineId);
      const res = await retirerDisciplineEtablissement({ ok: false }, fd);
      setConfirmeRetrait(null);
      setMessageAjout({ ok: res.ok, texte: res.message ?? "Erreur technique." });
    });
  }

  // Les couples de spécialités (« Anglais / EPS ») sont regroupés en bas du tableau,
  // sous les spécialités simples — chaque groupe reste trié alphabétiquement.
  const estCouple = (nom: string) => nom.includes("/");
  const groupesDisciplines = [
    { titre: null as string | null, items: disciplines.filter((d) => !estCouple(d.nom)) },
    { titre: "Couples de spécialités", items: disciplines.filter((d) => estCouple(d.nom)) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

        {/* Volumes horaires hebdomadaires dus par enseignant — plafond de service du solveur. */}
        <div className="rounded-2xl border border-cream-200 bg-cream-50/60 p-4">
          <p className="mb-1 text-sm font-semibold text-forest-900">Volume horaire hebdomadaire dû par enseignant</p>
          <p className="mb-3 text-xs text-ink-700/60">
            Sert de plafond de service : le solveur ne charge jamais un enseignant au-delà de ce
            volume. Laisser à <strong>0</strong> pour ne pas plafonner.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-forest-900">
                Enseignant du 1<sup>er</sup> cycle <span className="text-ink-700/50">(intervient au collège seulement)</span>
              </span>
              <input
                key={`v1:${volume1erCycle}`}
                type="number"
                name="volume_1er_cycle"
                min={0}
                max={40}
                defaultValue={volume1erCycle || ""}
                placeholder="Ex : 18"
                className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-forest-900">
                Enseignant du 2<sup>nd</sup> cycle <span className="text-ink-700/50">(compétent sur les deux cycles)</span>
              </span>
              <input
                key={`v2:${volume2ndCycle}`}
                type="number"
                name="volume_2nd_cycle"
                min={0}
                max={40}
                defaultValue={volume2ndCycle || ""}
                placeholder="Ex : 15"
                className="h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left">
                <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Discipline</th>
                <th className="px-3 py-2.5 text-center font-semibold text-ink-700/70">Premier cycle</th>
                <th className="px-3 py-2.5 text-center font-semibold text-ink-700/70">Second cycle</th>
                <th className="w-10 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {groupesDisciplines.map((g) => (
                <Fragment key={g.titre ?? "specialites-simples"}>
                  {g.titre && (
                    <tr>
                      <td
                        colSpan={4}
                        className="pb-1 pt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/50"
                      >
                        {g.titre}
                      </td>
                    </tr>
                  )}
                  {g.items.map((d) => (
                <tr key={d.id} className="border-b border-cream-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-forest-900">
                    {editionId === d.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <input
                          value={nomEdite}
                          onChange={(ev) => setNomEdite(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") {
                              ev.preventDefault();
                              renommerDiscipline(d.id, d.nom);
                            }
                            if (ev.key === "Escape") setEditionId(null);
                          }}
                          autoFocus
                          aria-label={`Nouveau nom pour ${d.nom}`}
                          className="h-9 w-44 rounded-lg border border-forest-300 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-forest-200"
                        />
                        {renommageEnCours ? (
                          <Loader2 size={14} className="animate-spin text-forest-600" />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => renommerDiscipline(d.id, d.nom)}
                              aria-label="Valider le nouveau nom"
                              className="rounded-full p-1 text-forest-700 hover:bg-forest-50"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditionId(null)}
                              aria-label="Annuler le renommage"
                              className="rounded-full p-1 text-ink-700/45 hover:bg-cream-100"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {d.nom}
                        <button
                          type="button"
                          onClick={() => {
                            setEditionId(d.id);
                            setNomEdite(d.nom);
                            setConfirmeRetrait(null);
                          }}
                          title={`Renommer ${d.nom} (correction d'orthographe)`}
                          aria-label={`Renommer ${d.nom}`}
                          className="rounded-full p-1 text-ink-700/35 hover:bg-forest-50 hover:text-forest-700"
                        >
                          <Pencil size={12} />
                        </button>
                      </span>
                    )}
                  </td>
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
                  <td className="py-2 text-right">
                    {retraitEnCours && confirmeRetrait === d.id ? (
                      <Loader2 size={15} className="ml-auto animate-spin text-forest-600" />
                    ) : confirmeRetrait === d.id ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => retirerDiscipline(d.id)}
                          className="rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-semibold text-white hover:bg-red-500"
                        >
                          Retirer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmeRetrait(null)}
                          className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-700/60 hover:bg-cream-100"
                        >
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmeRetrait(d.id)}
                        title={`Retirer ${d.nom} de la liste de cet établissement`}
                        aria-label={`Retirer ${d.nom}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/40 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
                  ))}
                </Fragment>
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
            placeholder="Ex : Allemand — ou un couple : Lettres / Anglais…"
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
          ainsi que dans les compétences des enseignants. Pour un couple de spécialités, séparer
          les deux disciplines par « / » (ex : Lettres / Anglais).
        </p>
      </div>
    </div>
  );
}
