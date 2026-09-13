"use client";

import { useState, useActionState, useTransition, useEffect, useId } from "react";
import { Plus, X, Trash2, Loader2, Check, CloudOff, Pencil } from "lucide-react";
import { enregistrerSeances, enregistrerSeancesAuto, type EtatForm } from "./actions";
import { ajouterDisciplineReferentiel, renommerDisciplineDepuisEtab } from "../config-actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { estOption, estParentAOptions, parentDeOption } from "@/lib/disciplines/options-disciplines";

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

/** État de l'enregistrement automatique d'un niveau (remonté sur l'onglet du niveau). */
export type EtatAuto = "repos" | "encours" | "enregistre" | "erreur";

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

/** Nom normalisé (sans accents ni casse) — rapprochement option ↔ discipline-parent. */
const normNom = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Discipline de la liste d'ajout d'une grille. */
export interface DisciplineListe {
  id: string;
  nom: string;
  couleur: string | null;
  /** `masquee` : retirée de la liste locale — jamais proposée à l'ajout (les lignes déjà
   *  configurées restent affichées) ; alignée sur le tableau des effectifs par spécialité. */
  masquee?: boolean;
  /** Créée PAR cet établissement (par saisie), et non issue du référentiel national partagé. */
  propre?: boolean;
  /** Déjà présente dans une grille d'un niveau du primaire/préscolaire de l'établissement. */
  utilisee?: boolean;
}

export function GrilleNiveauEditor({
  etablissementId,
  niveauId,
  niveauNom,
  disciplines,
  toutesDisciplines,
  listeRestreinte = false,
  onDisciplineAjoutee,
  onEtatAuto,
}: {
  etablissementId: string;
  niveauId: string;
  niveauNom: string;
  disciplines: DisciplineLigne[];
  toutesDisciplines: DisciplineListe[];
  /** Niveau préscolaire/primaire d'un établissement de cette catégorie : la liste d'ajout ne
   *  propose PAS les spécialités partagées du secondaire, seulement les disciplines de
   *  l'établissement (créées par saisie ou déjà utilisées au primaire). La liste n'est JAMAIS
   *  désactivée : une discipline créée doit toujours pouvoir rejoindre un niveau. */
  listeRestreinte?: boolean;
  /** Discipline ajoutée à ce niveau (liste ou « Créer ») : le bloc la propose aussitôt aux autres
   *  niveaux primaires, sans attendre un rechargement (l'enregistrement auto ne revalide pas). */
  onDisciplineAjoutee?: (disciplineId: string) => void;
  /** État de l'enregistrement automatique, affiché sur l'onglet du niveau : un échec reste visible
   *  même quand ce niveau n'est plus à l'écran. */
  onEtatAuto?: (niveauId: string, etat: EtatAuto) => void;
}) {
  // Enregistrement MANUEL : le payload soumis est mémorisé, pour qu'un succès efface aussi un
  // échec antérieur de l'enregistrement automatique (message rouge, pastille de l'onglet).
  const [etat, action] = useActionState<EtatForm & { payload?: string }, FormData>(
    async (prev, fd) => ({ ...(await enregistrerSeances(prev, fd)), payload: String(fd.get("payload") ?? "") }),
    initial,
  );
  const [data, setData] = useState<Etat>(() => dataInitiale(disciplines));
  const [ajout, setAjout] = useState("");
  const [pendingDisc, startDisc] = useTransition();
  const [nouvelleDisc, setNouvelleDisc] = useState("");
  const [msgDisc, setMsgDisc] = useState<string | null>(null);
  // Renommage inline d'une discipline de la liste (national → expression locale ; propre → renommage réel).
  const [renommeId, setRenommeId] = useState<string | null>(null);
  const [renommeNom, setRenommeNom] = useState("");
  const [pendingRen, startRen] = useTransition();
  const idAideRestreinte = useId();

  // ── ENREGISTREMENT AUTOMATIQUE ────────────────────────────────────────────────────────────
  // La saisie est enregistrée seule, peu après la dernière frappe. Le bouton manuel reste :
  // beaucoup d'utilisateurs ont besoin de voir qu'ils ont « validé » (et lui revalide la page).
  // Dernier RÉSULTAT d'enregistrement automatique (l'état « en cours » est dérivé plus bas).
  const [dernierResultat, setDernierResultat] = useState<EtatAuto>("repos");
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [heureEnreg, setHeureEnreg] = useState<string | null>(null);
  // Dernier état RÉELLEMENT persisté (JSON) : évite de ré-enregistrer à l'identique (montage,
  // aller-retour sur une valeur, re-rendu du parent). En ÉTAT, pas en ref : il sert aussi, au
  // rendu, à savoir si une saisie attend encore son enregistrement.
  const [dernierEnregistre, setDernierEnregistre] = useState(() => JSON.stringify(dataInitiale(disciplines)));

  // RESYNCHRONISATION sur le serveur : les éditeurs des niveaux déjà ouverts restent montés
  // (volumes-block) — une grille modifiée ailleurs (import de configuration, collègue, bouton
  // « Enregistrer ») doit donc remplacer l'affichage… mais JAMAIS une saisie en attente.
  const signatureServeur = JSON.stringify(dataInitiale(disciplines));
  const [signaturePrec, setSignaturePrec] = useState(signatureServeur);
  if (signatureServeur !== signaturePrec) {
    setSignaturePrec(signatureServeur);
    if (JSON.stringify(data) === dernierEnregistre) {
      setData(dataInitiale(disciplines));
      setDernierEnregistre(signatureServeur);
    }
  }

  // Succès du bouton « Enregistrer la grille » : il vaut enregistrement — l'état automatique est
  // aligné (plus de message d'échec ni de pastille rouge sur l'onglet).
  const [etatManuelPrec, setEtatManuelPrec] = useState(etat);
  if (etat !== etatManuelPrec) {
    setEtatManuelPrec(etat);
    if (etat.ok && etat.payload) {
      setDernierEnregistre(etat.payload);
      setDernierResultat("enregistre");
      setAutoMsg(null);
    }
  }
  useEffect(() => {
    if (etat.ok) onEtatAuto?.(niveauId, "enregistre");
  }, [etat, niveauId, onEtatAuto]);

  // État AFFICHÉ : « en cours » dès qu'une saisie attend son enregistrement — DÉRIVÉ au rendu
  // (aucun setState synchrone dans l'effet), sinon le dernier résultat obtenu.
  const autoEtat: EtatAuto =
    JSON.stringify(data) !== dernierEnregistre && dernierResultat !== "erreur" ? "encours" : dernierResultat;

  useEffect(() => {
    const payload = JSON.stringify(data);
    if (payload === dernierEnregistre) return;
    // Débounce : on attend une pause dans la saisie plutôt que d'écrire à chaque caractère.
    const minuteur = setTimeout(async () => {
      try {
        const r = await enregistrerSeancesAuto(etablissementId, niveauId, payload);
        if (r.ok) {
          setDernierEnregistre(payload);
          setDernierResultat("enregistre");
          onEtatAuto?.(niveauId, "enregistre");
          setAutoMsg(null);
          setHeureEnreg(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
        } else {
          setDernierResultat("erreur");
          onEtatAuto?.(niveauId, "erreur");
          // Verrou de configuration : réessayer n'y changerait rien — pas d'invitation au bouton.
          setAutoMsg(
            r.verrouillee
              ? (r.message ?? "Configuration verrouillée.")
              : `${r.message ?? "Enregistrement automatique impossible."} Utilisez le bouton pour réessayer.`,
          );
        }
      } catch {
        setDernierResultat("erreur");
        onEtatAuto?.(niveauId, "erreur");
        setAutoMsg("Enregistrement automatique impossible (connexion ?). Utilisez le bouton pour réessayer.");
      }
    }, 1000);
    return () => clearTimeout(minuteur);
  }, [data, dernierEnregistre, etablissementId, niveauId, onEtatAuto]);

  // Crée une discipline PAR SAISIE (liste propre à l'établissement) et l'AJOUTE AUSSITÔT à ce
  // niveau ; elle est ensuite proposée dans la liste pour les autres niveaux. Un nom déjà présent
  // (aux accents et à la casse près : « Francais » = « Français ») n'est pas recréé : la
  // discipline existante est ajoutée à ce niveau.
  function creerDiscipline() {
    const nomDisc = nouvelleDisc.trim();
    if (!nomDisc) return;
    setMsgDisc(null);
    const dejaDansCeNiveau = new Set(Object.keys(data));
    startDisc(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set("nom", nomDisc);
      const r = await ajouterDisciplineReferentiel({ ok: false }, fd);
      let idDisc = r.disciplineId;
      let nomRetenu = r.disciplineNom ?? nomDisc;
      let noteParent = "";
      // Un COUPLE (« X / Y ») ne se déclare jamais dans la grille : une ligne = une discipline.
      if (idDisc && estCouple(nomRetenu)) {
        setMsgDisc(`${r.message ?? ""} Un couple ne s'ajoute pas à la grille : ajoutez chacune de ses disciplines séparément.`.trim());
        if (r.ok) setNouvelleDisc("");
        return;
      }
      // OPTION d'une famille (Musique, Arts Plastiques, LV2-Allemand…) : au SECONDAIRE, seule la
      // discipline-PARENT se déclare (le solveur donne son option à chaque classe) — on ajoute donc
      // le parent. Au PRIMAIRE (liste restreinte), pas de déclinaison : la matière s'ajoute telle quelle.
      if (idDisc && !listeRestreinte && estOption(nomRetenu)) {
        const nomParent = parentDeOption(nomRetenu);
        const parent = nomParent
          ? toutesDisciplines.find((d) => !d.masquee && normNom(d.nom) === normNom(nomParent))
          : undefined;
        if (!parent) {
          setMsgDisc(
            `${r.message ?? ""} C'est une option de « ${nomParent} » : ajoutez cette discipline-parent au niveau (chaque classe reçoit ensuite son option à la génération).`.trim(),
          );
          if (r.ok) setNouvelleDisc("");
          return;
        }
        noteParent = `« ${nomRetenu} » est une option de « ${parent.nom} » : c'est la discipline-parent qui figure dans la grille (chaque classe reçoit son option à la génération). `;
        idDisc = parent.id;
        nomRetenu = parent.nom;
      }
      if (!idDisc) {
        setMsgDisc(r.message ?? null);
        if (r.ok) setNouvelleDisc("");
        return;
      }
      setNouvelleDisc("");
      if (dejaDansCeNiveau.has(idDisc)) {
        setMsgDisc(`${noteParent}« ${nomRetenu} » figure déjà dans ce niveau.`);
        return;
      }
      const idAjoute = idDisc;
      setData((s) => (s[idAjoute] ? s : { ...s, [idAjoute]: { coef: 1, seances: [DUREE_SEANCE] } }));
      onDisciplineAjoutee?.(idAjoute);
      setMsgDisc(
        noteParent
          ? `${noteParent}Ajoutée à ce niveau (1 séance de ${DUREE_SEANCE} min, à ajuster).`
          : r.ok
            ? `« ${nomRetenu} » ajoutée à ce niveau (1 séance de ${DUREE_SEANCE} min, à ajuster) et à la liste de l'établissement.`
            : `« ${nomRetenu} » existait déjà dans la liste : ajoutée à ce niveau (1 séance de ${DUREE_SEANCE} min, à ajuster).`,
      );
    });
  }

  // Renomme une discipline (libellé propre à l'établissement) directement depuis la grille.
  function ouvrirRenommage(id: string, nom: string) {
    setMsgDisc(null);
    setRenommeId(id);
    setRenommeNom(nom);
  }
  function renommerDiscipline() {
    const id = renommeId;
    if (!id) return;
    const nomDisc = renommeNom.trim();
    if (!nomDisc) return;
    setMsgDisc(null);
    startRen(async () => {
      const fd = new FormData();
      fd.set("etablissementId", etablissementId);
      fd.set("disciplineId", id);
      fd.set("nom", nomDisc);
      const r = await renommerDisciplineDepuisEtab({ ok: false }, fd);
      if (r.ok) setRenommeId(null);
      setMsgDisc(r.message ?? null);
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
  // « Volumes » liste la discipline-PARENT (LV2, « Arts (Plastiques & Musicale) »…), PAS ses OPTIONS :
  // c'est à la génération de l'EDT que chaque classe reçoit une option concrète (LV2-Allemand,
  // Arts Plastiques, Musique…), choisie par le solveur. On exclut donc les options de la liste
  // d'ajout (comme les couples et les disciplines masquées) — SAUF au primaire, où Musique ou
  // Arts plastiques sont des matières ordinaires du maître (aucune déclinaison par classe).
  // Niveau primaire/préscolaire (liste restreinte) : seulement les disciplines de l'établissement
  // — créées par saisie ou déjà utilisées au primaire —, jamais les spécialités du secondaire.
  const dispoAjout = toutesDisciplines.filter(
    (d) =>
      data[d.id] === undefined &&
      !estCouple(d.nom) &&
      !d.masquee &&
      (listeRestreinte || !estOption(d.nom)) &&
      (!listeRestreinte || d.propre || d.utilisee),
  );

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
    onDisciplineAjoutee?.(ajout);
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
                    {renommeId === d.id ? (
                      <span className="inline-flex items-center gap-1.5 align-middle">
                        <input
                          value={renommeNom}
                          onChange={(e) => setRenommeNom(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); renommerDiscipline(); }
                            if (e.key === "Escape") setRenommeId(null);
                          }}
                          autoFocus
                          maxLength={80}
                          className="h-7 w-48 rounded border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                        />
                        <button type="button" onClick={renommerDiscipline} disabled={pendingRen} title="Enregistrer le nom" className="flex h-6 w-6 items-center justify-center rounded text-forest-700 hover:bg-forest-50 disabled:opacity-50">
                          {pendingRen ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button type="button" onClick={() => setRenommeId(null)} title="Annuler" className="flex h-6 w-6 items-center justify-center rounded text-ink-700/40 hover:bg-cream-100">
                          <X size={13} />
                        </button>
                      </span>
                    ) : (
                      <>
                        {d.nom}
                        <button
                          type="button"
                          onClick={() => ouvrirRenommage(d.id, d.nom)}
                          title={`Renommer ${d.nom} pour cet établissement`}
                          aria-label={`Renommer la discipline ${d.nom}`}
                          className="ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full align-middle text-ink-700/35 hover:bg-forest-50 hover:text-forest-700"
                        >
                          <Pencil size={12} />
                        </button>
                      </>
                    )}
                    {facultatives.has(d.id) && (
                      <span
                        className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 align-middle text-[0.65rem] font-semibold text-gold-800"
                        title="Facultative (modèle national) : non générée par défaut. Conservez-la pour l'inclure dans votre grille, ou retirez-la."
                      >
                        facultative
                      </span>
                    )}
                    {estParentAOptions(d.nom) && (
                      <span
                        className="ml-2 rounded-full bg-forest-50 px-2 py-0.5 align-middle text-[0.6rem] font-semibold text-forest-700"
                        title="Discipline à options : à la génération de l'EDT, chaque classe reçoit une option concrète (ex. LV2-Allemand/LV2-Espagnol, Arts Plastiques/Musique) selon les enseignants disponibles."
                      >
                        déclinée par classe
                      </span>
                    )}
                    {/* Au primaire, une option (Musique, Arts plastiques) est une matière ordinaire :
                        pas d'invitation à la remplacer par sa discipline-parent. */}
                    {!listeRestreinte && parentDeOption(d.nom) && (
                      <span
                        className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 align-middle text-[0.6rem] font-semibold text-gold-700"
                        title={`Option de « ${parentDeOption(d.nom)} ». Désormais, seule la discipline-parent se déclare ici ; retirez cette ligne et ajoutez « ${parentDeOption(d.nom)} ».`}
                      >
                        option · {parentDeOption(d.nom)}
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

      {/* Ajout d'une discipline à ce niveau : depuis la LISTE, ou par SAISIE (création + ajout).
          La liste n'est jamais désactivée : au primaire elle est seulement RESTREINTE. */}
      <div className="space-y-2 border-t border-cream-100 pt-3">
        {dispoAjout.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={ajout}
              onChange={(e) => setAjout(e.target.value)}
              aria-label={`Ajouter une discipline à ${niveauNom}`}
              aria-describedby={listeRestreinte ? idAideRestreinte : undefined}
              className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-50"
            >
              <option value="">{listeRestreinte ? "Ajouter une discipline de l'établissement…" : "Ajouter depuis la liste…"}</option>
              {dispoAjout.map((d) => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addDiscipline}
              disabled={!ajout}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
        )}
        {listeRestreinte && (
          <p id={idAideRestreinte} className="text-[0.7rem] text-ink-700/55">
            Au primaire/préscolaire, les spécialités du secondaire ne sont pas proposées : créez les
            disciplines de ce niveau par saisie — chacune s&apos;ajoute aussitôt à ce niveau, puis
            reste proposée dans la liste pour les autres niveaux.
          </p>
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
            aria-label={`Créer une discipline et l'ajouter à ${niveauNom}`}
            aria-describedby={listeRestreinte ? idAideRestreinte : undefined}
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
        {/* Région annoncée par les lecteurs d'écran : toujours montée (une région live insérée en
            même temps que son texte n'est souvent pas lue), simplement vide au repos. */}
        <p role="status" aria-live="polite" className={msgDisc ? "text-xs text-ink-700/70" : "sr-only"}>
          {msgDisc ?? ""}
        </p>
        <p className="text-[0.7rem] text-ink-700/45">
          « Créer » ajoute la discipline à ce niveau et à la liste de l&apos;établissement (si elle existe déjà, elle est simplement ajoutée à ce niveau). Vos saisies de la grille sont enregistrées automatiquement : vous ne perdez rien en créant une discipline.
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
              <CloudOff size={13} /> {autoMsg}
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
