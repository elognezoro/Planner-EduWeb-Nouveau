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
import { estOption, estParentAOptions, parentDeOption } from "@/lib/disciplines/options-disciplines";

const initial: EtatForm = { ok: false };

export function EffectifsEnseignantsForm({
  etablissementId,
  disciplines,
  valeurs,
  volume1erCycle,
  volume2ndCycle,
  desactive = false,
}: {
  etablissementId: string;
  /** `propre` : discipline créée par CET établissement (renommée dans sa ligne). Une NATIONALE
   *  (propre = false) reçoit une EXPRESSION LOCALE — le référentiel partagé reste intact.
   *  `nom` = expression affichée ; `nomCanonique` = nom du référentiel (détections structurelles). */
  disciplines: { id: string; nom: string; nomCanonique: string; propre: boolean }[];
  valeurs: Record<string, number>;
  volume1erCycle: number;
  volume2ndCycle: number;
  /** Préscolaire/primaire : sans objet (maîtres polyvalents) — grisé, non pris en compte par le solveur. */
  desactive?: boolean;
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

  // #3 — Ce bloc liste les disciplines-PARENTS (« LV2 », « Arts (Plastiques & Musicale) »…) et les
  // disciplines simples ; les OPTIONS d'une famille (LV2-Allemand, Arts Plastiques…) N'Y FIGURENT
  // PAS : on déclare UN effectif sur le parent (pool partagé au solveur). Les détections s'appuient
  // sur le nom CANONIQUE (référentiel), jamais sur l'expression locale.
  const estCouple = (d: { nomCanonique: string }) => d.nomCanonique.includes("/");
  const visibles = disciplines.filter((d) => !estOption(d.nomCanonique));
  const simples = visibles.filter((d) => !estCouple(d));
  const couples = visibles.filter((d) => estCouple(d));
  // Options rattachées à chaque parent — affichées en SOUS-LIGNES (visualisation) sous leur parent.
  // La saisie de l'effectif reste sur le parent ; les options sont en lecture seule ici.
  const normNom = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const optionsParParent = new Map<string, { id: string; nom: string }[]>();
  for (const d of disciplines) {
    const parent = parentDeOption(d.nomCanonique);
    if (!parent) continue;
    const cle = normNom(parent);
    optionsParParent.set(cle, [...(optionsParParent.get(cle) ?? []), { id: d.id, nom: d.nom }]);
  }

  /** Ligne d'une discipline (`sous` conservé pour compat : toujours false ici). */
  const rendreLigne = (d: { id: string; nom: string; propre: boolean }, sous: boolean) => (
    <tr key={d.id} className="border-b border-cream-100 last:border-0">
      <td className="py-2 pr-4 font-medium text-forest-900">
        {editionId === d.id ? (
          <span className={`inline-flex items-center gap-1.5 ${sous ? "pl-5" : ""}`}>
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
          <span className={`inline-flex items-center gap-1.5 ${sous ? "pl-5" : ""}`}>
            {sous && <span aria-hidden className="text-ink-700/35">└</span>}
            {d.nom}
            {/* Crayon sur CHAQUE discipline : une PROPRE est renommée dans sa ligne ; une
                NATIONALE reçoit une EXPRESSION LOCALE (le référentiel partagé reste intact). */}
            <button
              type="button"
              onClick={() => {
                setEditionId(d.id);
                setNomEdite(d.nom);
                setConfirmeRetrait(null);
              }}
              title={
                d.propre
                  ? `Renommer ${d.nom} (discipline de cet établissement)`
                  : `Modifier l'expression de ${d.nom} pour cet établissement (le référentiel national reste inchangé)`
              }
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
  );

  /** Sous-ligne d'OPTION (visualisation, lecture seule) : l'effectif est déclaré sur le parent. */
  const rendreOptionVisuelle = (o: { id: string; nom: string }) => (
    <tr key={`opt-${o.id}`} className="border-b border-cream-50 bg-cream-50/30 last:border-0">
      <td className="py-1.5 pr-4">
        <span className="inline-flex items-center gap-1.5 pl-6 text-sm text-ink-700/70">
          <span aria-hidden className="text-ink-700/35">└</span> {o.nom}
          <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-700/45">option</span>
        </span>
      </td>
      <td className="px-3 py-1.5 text-center text-xs text-ink-700/35" title="Effectif déclaré sur la discipline-parent">—</td>
      <td className="px-3 py-1.5 text-center text-xs text-ink-700/35" title="Effectif déclaré sur la discipline-parent">—</td>
      <td />
    </tr>
  );

  return (
    <div className="space-y-4">
      <form action={action} data-config-save className="space-y-4">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

        {/* Volumes horaires hebdomadaires dus par enseignant — plafond de service du solveur. */}
        <div className="rounded-2xl border border-cream-200 bg-cream-50/60 p-4">
          <p className="mb-1 text-sm font-semibold text-forest-900">Plafond de service hebdomadaire par enseignant</p>
          <p className="mb-3 text-xs text-ink-700/60">
            Heures dues officielles : <strong>21 h</strong> (1<sup>er</sup> cycle) / <strong>18 h</strong>{" "}
            (2<sup>nd</sup> cycle) — au-delà, ce sont des heures supplémentaires. Ce plafond borne le
            maximum atteignable (heures supplémentaires comprises) : le solveur ne charge jamais un
            enseignant au-delà. Laisser à <strong>0</strong> pour ne pas plafonner. En cas de blocage
            dû au volume horaire, EduWeb Planner relève ce plafond au strict nécessaire, réparti équitablement.
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

        {desactive && (
          <div className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
            Sans objet au préscolaire/primaire — maîtres polyvalents. Ce tableau ne concerne que
            les établissements à spécialités (secondaire/supérieur) et n&apos;est pas pris en
            compte par le générateur d&apos;emploi du temps ; il reste modifiable si vous changez
            de catégorie pédagogique en tête de la configuration.
          </div>
        )}
        <fieldset disabled={desactive} className="m-0 min-w-0 border-0 p-0 disabled:opacity-50">
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
              {simples.map((d) => {
                const options = estParentAOptions(d.nomCanonique) ? optionsParParent.get(normNom(d.nomCanonique)) ?? [] : [];
                return (
                  <Fragment key={d.id}>
                    {rendreLigne(d, false)}
                    {options.map((o) => rendreOptionVisuelle(o))}
                  </Fragment>
                );
              })}
              {couples.length > 0 && (
                <>
                  <tr key="titre-couples">
                    <td colSpan={4} className="pb-1 pt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/50">
                      Couples de spécialités
                    </td>
                  </tr>
                  {couples.map((d) => rendreLigne(d, false))}
                </>
              )}
            </tbody>
          </table>
        </div>
        </fieldset>

        {!desactive && (
          <>
            <SubmitButton className="w-auto px-6">Enregistrer les effectifs enseignants</SubmitButton>
            <p className="text-xs text-ink-700/55">
              Nombre d&apos;enseignants disponibles par discipline et par cycle. Le solveur répartit ces
              enseignants (anonymes) sur les classes sans jamais les mettre en double sur un même créneau.
            </p>
          </>
        )}
        {desactive && (
          <SubmitButton className="w-auto px-6">Enregistrer le volume horaire</SubmitButton>
        )}
      </form>

      {/* Ajout d'une discipline ou d'un couple de disciplines à la liste des compétences. */}
      <fieldset disabled={desactive} className="m-0 min-w-0 border-0 p-0 disabled:opacity-50">
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
      </fieldset>
    </div>
  );
}
