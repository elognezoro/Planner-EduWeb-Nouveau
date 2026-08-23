"use client";

import { useState, useActionState, useTransition, useEffect, useRef } from "react";
import { Plus, X, Trash2, Loader2, Check, CloudOff } from "lucide-react";
import { enregistrerSeances, enregistrerSeancesAuto, type EtatForm } from "./actions";
import { ajouterDisciplineReferentiel } from "../config-actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

/** Durée unitaire d'une séance (modèle national ivoirien : 55 minutes). */
export const DUREE_SEANCE = 55;

export interface DisciplineLigne {
  disciplineId: string;
  nom: string;
  couleur: string | null;
  coef: number;
  seances: number[];
  /** Discipline FACULTATIVE du modèle national (ex : LV2 en 1èreC/D) : proposée, non générée par
   *  défaut. En la conservant ici, l'établissement l'inclut dans SA grille (et sa génération). */
  facultatif?: boolean;
}

type Etat = Record<string, { coef: number; seances: number[] }>;

/**
 * Discipline « couplée » : deux matières réunies sous un même libellé (« Anglais / EPS »,
 * « Histoire-Géographie / EC », « Mathématiques / TICE »…). Héritage des anciens référentiels.
 *
 * On ne les propose plus à l'ajout : la grille horaire se compose matière par matière, chacune
 * portant SON coefficient et SES séances. Un couple additionnerait deux enseignements dans une
 * seule ligne, ce qui fausse le volume hebdomadaire et la répartition faite ensuite par le solveur.
 *
 * Le séparateur reconnu est la barre oblique entourée d'espaces : « Arts & Musique » ou
 * « Physique-Chimie » (trait d'union) sont des disciplines à part entière, et restent proposées.
 */
function estCouple(nom: string): boolean {
  return /\s\/\s/.test(nom);
}

/** État initial dérivé des lignes reçues du serveur (sert aussi de référence « déjà enregistré »). */
function dataInitiale(disciplines: DisciplineLigne[]): Etat {
  return Object.fromEntries(disciplines.map((d) => [d.disciplineId, { coef: d.coef, seances: [...d.seances] }]));
}

function formatVolume(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function GrilleNiveauEditor({
  etablissementId,
  niveauId,
  niveauNom,
  disciplines,
  toutesDisciplines,
  ajoutDepuisListeDesactive = false,
}: {
  etablissementId: string;
  niveauId: string;
  niveauNom: string;
  disciplines: DisciplineLigne[];
  /** `masquee` : retirée de la liste locale — jamais proposée à l'ajout (les lignes déjà
   *  configurées restent affichées) ; alignée sur le tableau des effectifs par spécialité. */
  toutesDisciplines: { id: string; nom: string; couleur: string | null; masquee?: boolean }[];
  /** Préscolaire/primaire : pas de liste de spécialités partagées — création par saisie uniquement. */
  ajoutDepuisListeDesactive?: boolean;
}) {
  const [etat, action] = useActionState(enregistrerSeances, initial);
  const [data, setData] = useState<Etat>(() => dataInitiale(disciplines));
  const [ajout, setAjout] = useState("");
  const [pendingDisc, startDisc] = useTransition();
  const [nouvelleDisc, setNouvelleDisc] = useState("");
  const [msgDisc, setMsgDisc] = useState<string | null>(null);

  // ── ENREGISTREMENT AUTOMATIQUE ────────────────────────────────────────────────────────────
  // La saisie est enregistrée seule, peu après la dernière frappe. Le bouton manuel reste :
  // beaucoup d'utilisateurs ont besoin de voir qu'ils ont « validé » (et lui revalide la page).
  const [autoEtat, setAutoEtat] = useState<"repos" | "encours" | "enregistre" | "erreur">("repos");
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [heureEnreg, setHeureEnreg] = useState<string | null>(null);
  // Dernier état RÉELLEMENT persisté : évite de ré-enregistrer à l'identique (montage, aller-retour
  // sur une valeur, re-rendu du parent).
  const dejaEnregistre = useRef(JSON.stringify(dataInitiale(disciplines)));

  useEffect(() => {
    const payload = JSON.stringify(data);
    if (payload === dejaEnregistre.current) return;
    setAutoEtat("encours");
    // Débounce : on attend une pause dans la saisie plutôt que d'écrire à chaque caractère.
    const minuteur = setTimeout(async () => {
      try {
        const r = await enregistrerSeancesAuto(etablissementId, niveauId, payload);
        if (r.ok) {
          dejaEnregistre.current = payload;
          setAutoEtat("enregistre");
          setAutoMsg(null);
          setHeureEnreg(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
        } else {
          setAutoEtat("erreur");
          setAutoMsg(r.message ?? "Enregistrement automatique impossible.");
        }
      } catch {
        setAutoEtat("erreur");
        setAutoMsg("Enregistrement automatique impossible (connexion ?).");
      }
    }, 1000);
    return () => clearTimeout(minuteur);
  }, [data, etablissementId, niveauId]);

  // Crée une discipline PAR SAISIE dans le référentiel (elle rejoint ensuite la liste ci-dessus).
  function creerDiscipline() {
    const nomDisc = nouvelleDisc.trim();
    if (!nomDisc) return;
    setMsgDisc(null);
    startDisc(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set("nom", nomDisc);
      const r = await ajouterDisciplineReferentiel({ ok: false }, fd);
      setMsgDisc(r.message ?? null);
      if (r.ok) setNouvelleDisc("");
    });
  }

  // Disciplines affichées : celles présentes dans la config, dans l'ordre du référentiel.
  // ⚠️ AUCUN filtre ici : un niveau déjà configuré avec une discipline couplée doit continuer de
  // l'afficher (et de pouvoir la retirer). Le filtre ci-dessous ne vise QUE la liste d'ajout.
  const lignes = toutesDisciplines.filter((d) => data[d.id] !== undefined);
  // Disciplines FACULTATIVES du modèle national (proposées, non générées par défaut) : marquées
  // d'un badge. En les conservant, l'établissement les inclut dans SA grille ; il les retire sinon.
  const facultatives = new Set(disciplines.filter((d) => d.facultatif).map((d) => d.disciplineId));
  // On ne PROPOSE plus les disciplines « couplées » (« Anglais / EPS », « Physique-Chimie / SVT »…) :
  // la grille se compose discipline par discipline, chacune avec son coefficient et ses séances
  // propres — un couple fausserait ce décompte. Les composantes qui n'existeraient pas encore
  // isolément se créent en un clic via « Créer une discipline par saisie » juste en dessous.
  const dispoAjout = toutesDisciplines.filter((d) => data[d.id] === undefined && !estCouple(d.nom) && !d.masquee);

  function setCoef(id: string, coef: number) {
    setData((s) => ({ ...s, [id]: { ...s[id], coef } }));
  }
  function setSeance(id: string, idx: number, val: number) {
    setData((s) => {
      const seances = [...s[id].seances];
      seances[idx] = val;
      return { ...s, [id]: { ...s[id], seances } };
    });
  }
  function addSeance(id: string) {
    setData((s) => ({ ...s, [id]: { ...s[id], seances: [...s[id].seances, DUREE_SEANCE] } }));
  }
  function removeSeance(id: string, idx: number) {
    setData((s) => ({ ...s, [id]: { ...s[id], seances: s[id].seances.filter((_, i) => i !== idx) } }));
  }
  function removeDiscipline(id: string) {
    setData((s) => {
      const copie = { ...s };
      delete copie[id];
      return copie;
    });
  }
  function addDiscipline() {
    if (!ajout || data[ajout]) return;
    setData((s) => ({ ...s, [ajout]: { coef: 1, seances: [DUREE_SEANCE] } }));
    setAjout("");
  }

  const totalSeances = lignes.reduce((acc, d) => acc + (data[d.id]?.seances.length ?? 0), 0);
  const totalMinutes = lignes.reduce(
    (acc, d) => acc + (data[d.id]?.seances.reduce((a, b) => a + (Number(b) || 0), 0) ?? 0),
    0,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="niveauId" value={niveauId} />
      <input type="hidden" name="payload" value={JSON.stringify(data)} />

      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left">
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Discipline</th>
              <th className="px-2 py-2.5 font-semibold text-ink-700/70">Coef.</th>
              <th className="px-2 py-2.5 font-semibold text-ink-700/70">Séances (durée en min)</th>
              <th className="px-2 py-2.5 text-right font-semibold text-ink-700/70">Volume hebdo</th>
              <th className="px-2 py-2.5 text-center font-semibold text-ink-700/70">Statut</th>
              <th className="w-8 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-sm text-ink-700/55">
                  Aucune discipline. Ajoutez-en ci-dessous pour ce niveau.
                </td>
              </tr>
            )}
            {lignes.map((d) => {
              const ligne = data[d.id];
              const minutes = ligne.seances.reduce((a, b) => a + (Number(b) || 0), 0);
              const ok = ligne.seances.length > 0 && minutes > 0;
              return (
                <tr key={d.id} className="border-b border-cream-100 last:border-0 align-top">
                  <td className="py-2.5 pr-4 font-medium text-forest-900">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: d.couleur ?? "#999" }} />
                    {d.nom}
                    {facultatives.has(d.id) && (
                      <span
                        className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 align-middle text-[0.65rem] font-semibold text-gold-800"
                        title="Facultative (modèle national) : non générée par défaut. Conservez-la pour l'inclure dans votre grille, ou retirez-la."
                      >
                        facultative
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={ligne.coef}
                      onChange={(e) => setCoef(d.id, Number(e.target.value))}
                      className="h-8 w-16 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ligne.seances.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-cream-300 bg-cream-50 py-0.5 pl-1.5 pr-0.5">
                          <input
                            type="number"
                            min={0}
                            step={5}
                            value={s}
                            onChange={(e) => setSeance(d.id, i, Number(e.target.value))}
                            className="h-7 w-14 rounded border-0 bg-transparent px-1 text-sm outline-none"
                          />
                          <span className="text-[0.6rem] text-ink-700/50">min</span>
                          <button
                            type="button"
                            onClick={() => removeSeance(d.id, i)}
                            className="flex h-5 w-5 items-center justify-center rounded text-ink-700/40 hover:bg-red-50 hover:text-red-600"
                            aria-label="Retirer la séance"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => addSeance(d.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-forest-300 px-2 py-1 text-xs font-medium text-forest-700 hover:bg-forest-50"
                      >
                        <Plus size={12} /> séance
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{formatVolume(minutes)}</td>
                  <td className="px-2 py-2.5 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${ok ? "bg-forest-100 text-forest-800" : "bg-gold-100 text-gold-800"}`}>
                      {ok ? "OK" : "À définir"}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeDiscipline(d.id)}
                      title={`Retirer ${d.nom} de ce niveau`}
                      aria-label={`Retirer la discipline ${d.nom}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/40 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-cream-200">
              <td className="py-2.5 pr-4 font-medium text-ink-700/70">Total — {niveauNom}</td>
              <td />
              <td className="px-2 py-2.5 font-semibold text-gold-700">{totalSeances} séance(s)</td>
              <td className="px-2 py-2.5 text-right font-display font-bold text-forest-900">{formatVolume(totalMinutes)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Ajout d'une discipline à ce niveau : depuis la LISTE, ou par SAISIE (création) */}
      <div className="space-y-2 border-t border-cream-100 pt-3">
        {dispoAjout.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ajout}
              onChange={(e) => setAjout(e.target.value)}
              disabled={ajoutDepuisListeDesactive}
              className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-50"
            >
              <option value="">Ajouter depuis la liste…</option>
              {dispoAjout.map((d) => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addDiscipline}
              disabled={ajoutDepuisListeDesactive || !ajout}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
            >
              <Plus size={14} /> Ajouter
            </button>
            {ajoutDepuisListeDesactive && (
              <p className="w-full text-[0.7rem] text-ink-700/50">
                Au primaire/préscolaire, créez vos disciplines par saisie.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nouvelleDisc}
            onChange={(e) => setNouvelleDisc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                creerDiscipline();
              }
            }}
            placeholder="Créer une discipline par saisie…"
            className="h-9 w-60 rounded-lg border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          <button
            type="button"
            onClick={creerDiscipline}
            disabled={pendingDisc || !nouvelleDisc.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
          >
            {pendingDisc ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
          </button>
        </div>
        {msgDisc && <p className="text-xs text-ink-700/70">{msgDisc}</p>}
        <p className="text-[0.7rem] text-ink-700/45">
          « Créer » ajoute la discipline au référentiel puis elle apparaît dans la liste ci-dessus. Vos saisies de la grille sont enregistrées automatiquement : vous ne perdez rien en créant une discipline.
        </p>
      </div>

      {/* Enregistrement : automatique au fil de la saisie + bouton manuel (rassurance). */}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="w-auto px-8">Enregistrer la grille de {niveauNom}</SubmitButton>
        <span aria-live="polite" className="inline-flex items-center gap-1.5 text-xs">
          {autoEtat === "encours" && (
            <span className="inline-flex items-center gap-1.5 text-ink-700/60">
              <Loader2 size={13} className="animate-spin" /> Enregistrement…
            </span>
          )}
          {autoEtat === "enregistre" && (
            <span className="inline-flex items-center gap-1.5 font-medium text-forest-700">
              <Check size={13} /> Enregistré automatiquement{heureEnreg ? ` à ${heureEnreg}` : ""}
            </span>
          )}
          {autoEtat === "erreur" && (
            <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
              <CloudOff size={13} /> {autoMsg} Utilisez le bouton pour réessayer.
            </span>
          )}
          {autoEtat === "repos" && (
            <span className="text-ink-700/45">Vos saisies s&apos;enregistrent toutes seules.</span>
          )}
        </span>
      </div>
    </form>
  );
}
