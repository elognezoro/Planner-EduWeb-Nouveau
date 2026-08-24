"use client";

import { useActionState, useState, useTransition } from "react";
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

  // Les couples de spécialités (« Anglais / EPS ») sont regroupés en bas du tableau,
  // sous les spécialités simples — chaque groupe reste trié alphabétiquement.
  // TOUTES les détections structurelles s'appuient sur le nom CANONIQUE (référentiel), jamais
  // sur l'expression locale : renommer « LV2-Espagnol » en « Espagnol » ne la sort pas de la
  // famille et ne ressuscite aucune ligne virtuelle en doublon.
  const estCouple = (d: { nomCanonique: string }) => d.nomCanonique.includes("/");
  const normNom = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const estVarianteLV2 = (d: { nomCanonique: string }) => /^lv2[\s-]/.test(normNom(d.nomCanonique));
  const simples = disciplines.filter((d) => !estCouple(d));
  const couples = disciplines.filter((d) => estCouple(d));
  // Famille LV2 (règle client : LV2 = Espagnol ou Allemand) : la ligne générique « LV2 » sert
  // de parent, et « LV2-Espagnol » / « LV2-Allemand » s'affichent en SOUS-LIGNES (ses options).
  // Une option pas encore créée est proposée en ligne VIRTUELLE : déclarer un effectif la crée.
  const lv2Parent = simples.find((d) => normNom(d.nomCanonique) === "lv2") ?? null;
  const sousLignesLV2 = simples.filter((d) => estVarianteLV2(d));
  const horsFamille = simples.filter((d) => d !== lv2Parent && !estVarianteLV2(d));
  const afficherFamilleLV2 = lv2Parent !== null || sousLignesLV2.length > 0;
  /** Options canoniques de LV2, dans un ordre FIXE — réelles si présentes, virtuelles sinon. */
  const OPTIONS_LV2 = [
    { cle: "allemand", nom: "LV2-Allemand" },
    { cle: "espagnol", nom: "LV2-Espagnol" },
  ];

  /** Ligne d'une discipline — `sous` : sous-ligne (option) de la famille LV2, indentée. */
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

  /** Sous-ligne VIRTUELLE d'une option LV2 : créée à l'enregistrement si un effectif est déclaré. */
  const rendreVirtuelle = (v: { cle: string; nom: string }) => (
    <tr key={`virtuelle-${v.cle}`} className="border-b border-cream-100 last:border-0">
      <td className="py-2 pr-4 font-medium text-forest-900">
        <span className="inline-flex items-center gap-1.5 pl-5">
          <span aria-hidden className="text-ink-700/35">└</span> {v.nom}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="number"
          name={`effvar_college_${v.cle}`}
          min={0}
          placeholder="0"
          className="h-9 w-20 rounded-lg border border-cream-300 bg-white px-2 text-center text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="number"
          name={`effvar_lycee_${v.cle}`}
          min={0}
          placeholder="0"
          className="h-9 w-20 rounded-lg border border-cream-300 bg-white px-2 text-center text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </td>
      <td className="py-2 text-right">
        <span
          className="pr-2 text-[0.6rem] font-medium uppercase tracking-wide text-ink-700/35"
          title="Cette option sera créée pour l'établissement à l'enregistrement, dès qu'un effectif y est déclaré."
        >
          auto
        </span>
      </td>
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
              {(() => {
                // Spécialités simples, avec la FAMILLE LV2 insérée à sa place alphabétique :
                // parent « LV2 » puis ses options en sous-lignes (réelles ou virtuelles).
                const lignes: React.ReactNode[] = [];
                let familleInseree = !afficherFamilleLV2;
                const insererFamille = () => {
                  familleInseree = true;
                  if (lv2Parent) lignes.push(rendreLigne(lv2Parent, false));
                  else
                    lignes.push(
                      <tr key="lv2-etiquette" className="border-b border-cream-100">
                        <td className="py-2 pr-4 font-medium text-forest-900">LV2</td>
                        <td colSpan={3} className="px-3 py-2 text-xs text-ink-700/50">
                          Répartie entre ses options ci-dessous.
                        </td>
                      </tr>,
                    );
                  // Ordre FIXE des options (Allemand puis Espagnol), réelle ou virtuelle ;
                  // puis les éventuelles autres variantes LV2-x du référentiel.
                  const parCanonique = new Map(sousLignesLV2.map((s) => [normNom(s.nomCanonique), s]));
                  for (const opt of OPTIONS_LV2) {
                    const reelle = parCanonique.get(normNom(opt.nom));
                    if (reelle) lignes.push(rendreLigne(reelle, true));
                    else lignes.push(rendreVirtuelle(opt));
                  }
                  // Toute sous-ligne non rendue par la boucle des options : autres variantes
                  // LV2-x ET doublon éventuel (variante propre coexistant avec la nationale) —
                  // rien n'est silencieusement caché.
                  for (const s of sousLignesLV2) {
                    const cle = normNom(s.nomCanonique);
                    const estOptionElue = OPTIONS_LV2.some((o) => normNom(o.nom) === cle) && parCanonique.get(cle) === s;
                    if (!estOptionElue) lignes.push(rendreLigne(s, true));
                  }
                };
                for (const d of horsFamille) {
                  if (!familleInseree && d.nom.localeCompare("LV2", "fr", { sensitivity: "base" }) > 0) {
                    insererFamille();
                  }
                  lignes.push(rendreLigne(d, false));
                }
                if (!familleInseree) insererFamille();
                if (couples.length > 0) {
                  lignes.push(
                    <tr key="titre-couples">
                      <td
                        colSpan={4}
                        className="pb-1 pt-4 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-700/50"
                      >
                        Couples de spécialités
                      </td>
                    </tr>,
                  );
                  for (const d of couples) lignes.push(rendreLigne(d, false));
                }
                return lignes;
              })()}
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
