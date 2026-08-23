/**
 * Correction AUTOMATIQUE de la configuration par l'IA d'EduWeb Planner.
 *
 * Quand la génération d'emploi du temps bute sur un blocage STRUCTUREL (arithmétique
 * prouvée par les pré-contrôles du solveur), l'IA calcule les corrections de configuration
 * qui le lèvent, les applique EN MÉMOIRE, re-résout, et ne les retient que si la génération
 * ABOUTIT — l'action serveur les persiste alors avec l'emploi du temps, en les listant
 * intégralement au chef d'établissement (traçabilité + transparence).
 *
 * Catalogue FERMÉ de corrections (jamais d'invention de ressources — ni enseignants ni
 * salles fantômes ; un déficit humain n'est JAMAIS auto-corrigé) :
 *  1. retirer_plage        — supprimer une plage sans cours dont TOUS les niveaux visés
 *                            avaient besoin de ces créneaux ;
 *  2. restreindre_plage    — retirer un ou plusieurs niveaux d'une plage sans cours (ceux
 *                            dont les classes saturent), en préservant la plage pour les
 *                            autres niveaux — correction MINIMALE préférée au retrait total ;
 *  3. elargir_eps          — élargir une plage d'EPS DÉJÀ CONFIGURÉE (jamais créer une
 *                            fenêtre sur une demi-journée que le chef a laissée sans EPS) ;
 *  4. vacation_journee_entiere — basculer un NIVEAU en vacation simple quand la double
 *                            vacation est mathématiquement impossible (périodes en salle >
 *                            créneaux d'une demi-journée, ou salle attitrée partagée saturée
 *                            au-delà de la semaine entière).
 *
 * Principes de sûreté : corrections MINIMALES (on ne retire jamais plus que nécessaire),
 * DÉTERMINISTES, et toujours VALIDÉES par re-résolution avant d'être retenues.
 */

import type { Etablissement } from "@prisma/client";
import type { BlocCours, Probleme, Resultat } from "@/lib/solveur";
import { resoudre } from "@/lib/solveur";
import {
  construireProbleme,
  type ClasseInput,
  type ConstruireProblemeInput,
} from "@/lib/emploi-du-temps/construire-probleme";
import {
  periodesHorairesMinutes,
  periodesMatinApresMidi,
  periodesParBloc,
} from "@/lib/emploi-du-temps/horaires";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const MOMENTS: Record<string, string> = { matin: "matin", apresmidi: "après-midi", journee: "journée entière" };

export type CorrectionEdt =
  | { type: "retirer_plage"; cle: string; entreeCle: string; jour: number; moment: string; description: string }
  | {
      type: "restreindre_plage";
      cle: string;
      entreeCle: string;
      jour: number;
      moment: string;
      /** Liste RÉSULTANTE des niveaux encore visés par la plage après retrait (persistée telle quelle). */
      niveauIdsRestants: string[];
      /** Niveaux RETIRÉS de la plage (pour la description). */
      niveauxRetires: string[];
      description: string;
    }
  | { type: "elargir_eps"; cle: string; cote: "matin" | "apresmidi"; debut: string; fin: string; description: string }
  | { type: "vacation_journee_entiere"; cle: string; niveauId: string; niveauNom: string; description: string };

/** Entrée normalisée de `Etablissement.plagesSansCours` avec ses créneaux (jour:période) pré-calculés. */
interface EntreePlage {
  jour: number;
  moment: string;
  niveauIds: string[] | null;
  cle: string;
  cellules: Set<string>;
}

function toMin(v: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function fmtHM(min: number): string {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Contexte de fenêtres horaires partagé par toutes les analyses. */
function contexteFenetres(etab: Etablissement) {
  const N = Math.max(1, etab.creneauxParJour);
  const decoupeMA = periodesMatinApresMidi(etab);
  const moitie = Math.ceil(N / 2);
  const matinIdx = decoupeMA?.matin ?? Array.from({ length: moitie }, (_, i) => i);
  const apmIdx = decoupeMA?.apresMidi ?? Array.from({ length: N - moitie }, (_, i) => moitie + i);
  const finBlocFit = new Array<number>(N);
  const blocsDecoupe = periodesParBloc(etab);
  const dec = blocsDecoupe && blocsDecoupe.reduce((a, b) => a + b, 0) === N ? blocsDecoupe : [N];
  let deb = 0;
  for (const taille of dec) {
    const fin = deb + taille - 1;
    for (let i = deb; i <= fin && i < N; i++) finBlocFit[i] = fin;
    deb += taille;
  }
  for (let i = 0; i < N; i++) if (finBlocFit[i] == null) finBlocFit[i] = N - 1;
  return { N, matinIdx, apmIdx, finBlocFit };
}

function periodesDeMoment(moment: string, ctx: { N: number; matinIdx: number[]; apmIdx: number[] }): number[] {
  if (moment === "journee") return Array.from({ length: ctx.N }, (_, i) => i);
  if (moment === "matin") return ctx.matinIdx;
  if (moment === "apresmidi") return ctx.apmIdx;
  return [];
}

function lirePlages(etab: Etablissement, ctx: ReturnType<typeof contexteFenetres>): EntreePlage[] {
  const brutes = Array.isArray(etab.plagesSansCours)
    ? (etab.plagesSansCours as { jour?: unknown; moment?: unknown; niveauIds?: unknown }[])
    : [];
  const entrees: EntreePlage[] = [];
  for (const pl of brutes) {
    const jour = Number(pl?.jour);
    if (!Number.isInteger(jour) || jour < 0 || jour > 4) continue;
    const moment = String(pl?.moment ?? "");
    if (!MOMENTS[moment]) continue;
    const niveauIds =
      Array.isArray(pl?.niveauIds) && (pl.niveauIds as unknown[]).length > 0 ? (pl.niveauIds as unknown[]).map(String) : null;
    const cellules = new Set(periodesDeMoment(moment, ctx).map((per) => `${jour}:${per}`));
    entrees.push({ jour, moment, niveauIds, cle: `${jour}:${moment}:${(niveauIds ?? []).slice().sort().join(",")}`, cellules });
  }
  return entrees;
}

/**
 * Candidat « élargir la plage d'EPS » d'un côté de la journée pour qu'une séance de `duree`
 * périodes consécutives y tienne. N'agit QUE sur un côté DÉJÀ configuré par le chef : jamais
 * de création d'une fenêtre d'EPS sur une demi-journée laissée volontairement sans EPS
 * (respect de la politique horaire de l'établissement). Élargissement MINIMAL (la fin
 * actuelle est conservée si une position le permet). Renvoie null si ce côté n'a pas de
 * plage, si une position tient déjà, ou si la demi-journée est trop courte.
 */
function candidatElargirEPS(etab: Etablissement, cote: "matin" | "apresmidi", duree: number): CorrectionEdt | null {
  const debCur = toMin(cote === "matin" ? etab.epsMatinDebut : etab.epsApresMidiDebut);
  const finCur = toMin(cote === "matin" ? etab.epsMatinFin : etab.epsApresMidiFin);
  // Ce côté n'a AUCUNE plage d'EPS configurée : ne rien fabriquer (le chef y a délibérément
  // exclu l'EPS ; l'ouvrir contournerait sa politique). L'élargissement ne touche qu'un côté
  // que le chef a déjà ouvert à l'EPS.
  if (debCur == null || finCur == null) return null;

  const periodes = periodesHorairesMinutes(etab);
  if (!periodes) return null;
  const ctx = contexteFenetres(etab);
  const idx = cote === "matin" ? ctx.matinIdx : ctx.apmIdx;
  const idxSet = new Set(idx);

  // Courses de `duree` périodes consécutives dans la demi-journée, sans traverser de pause.
  const courses: { debut: number; fin: number }[] = [];
  for (const i of idx) {
    let ok = i + duree - 1 <= ctx.finBlocFit[i];
    for (let d = 0; ok && d < duree; d++) if (!idxSet.has(i + d)) ok = false;
    if (ok && i + duree - 1 < periodes.length) courses.push({ debut: periodes[i].debut, fin: periodes[i + duree - 1].fin });
  }
  if (courses.length === 0) return null; // demi-journée trop courte : inélargissable

  // Une position tient déjà dans la fenêtre actuelle → la plage n'est pas la cause.
  if (courses.some((r) => r.debut >= debCur && r.fin <= finCur)) return null;

  // Préférer garder la FIN actuelle : course la plus tardive qui se termine avant elle.
  const dansFin = courses.filter((r) => r.fin <= finCur);
  const choix = dansFin.length > 0 ? dansFin[dansFin.length - 1] : courses.reduce((a, b) => (b.debut < a.debut ? b : a));
  const nvDebut = fmtHM(Math.min(debCur, choix.debut));
  const nvFin = fmtHM(Math.max(finCur, choix.fin));
  return {
    type: "elargir_eps",
    cle: `eps:${cote}:${nvDebut}-${nvFin}`,
    cote,
    debut: nvDebut,
    fin: nvFin,
    description: `Plage d'EPS ${cote === "matin" ? "du matin" : "de l'après-midi"} élargie (${nvDebut}–${nvFin}) pour qu'une séance d'EPS de ${duree} période(s) puisse s'y tenir.`,
  };
}

/**
 * Classes en DOUBLE vacation dont l'EPS n'a pas pu être isolée dans la demi-journée opposée
 * (repli du constructeur de problème) alors que le réglage « EPS opposée » est actif :
 * l'élargissement de la plage d'EPS du côté opposé peut restaurer l'isolement.
 */
function replisEPS(etab: Etablissement, probleme: Probleme) {
  if (!etab.epsDemiJourneeOpposee) return null;
  const parClasse = new Map<string, { groupe: 0 | 1 | null; eps: BlocCours[] }>();
  for (const b of probleme.blocs) {
    const e = parClasse.get(b.classeId) ?? { groupe: b.vacationGroupe ?? null, eps: [] };
    if (b.salleTypeRequis === "salle_eps") e.eps.push(b);
    parClasse.set(b.classeId, e);
  }
  const classesIds = new Set<string>();
  const dureeParClasse = new Map<string, number>();
  const coteParClasse = new Map<string, "matin" | "apresmidi">();
  let dureeMax = 1;
  for (const [cid, info] of parClasse) {
    if (info.groupe === null || info.eps.length === 0) continue;
    const isolee = info.eps.every(
      (b) =>
        b.vacationParJour &&
        !b.vacationParJour.some((v) => v === null) &&
        b.vacationParJour.some((v) => v !== null && v !== info.groupe),
    );
    if (isolee) continue;
    const cote = info.groupe === 0 ? "apresmidi" : "matin";
    classesIds.add(cid);
    coteParClasse.set(cid, cote);
    dureeParClasse.set(
      cid,
      info.eps.reduce((a, b) => a + b.duree, 0),
    );
    for (const b of info.eps) dureeMax = Math.max(dureeMax, b.duree);
  }
  return classesIds.size > 0 ? { classesIds, dureeParClasse, coteParClasse, dureeMax } : null;
}

/**
 * Calcule les corrections candidates à partir des blocages STRUCTURÉS du solveur.
 * Déterministe et minimal : accumule d'abord, pour chaque plage, l'ensemble des niveaux à en
 * retirer et des niveaux à basculer, puis matérialise UNE correction par plage.
 */
export function proposerCorrections(args: {
  etab: Etablissement;
  classes: ClasseInput[];
  probleme: Probleme;
  resultat: Resultat;
}): CorrectionEdt[] {
  const { etab, classes, probleme, resultat } = args;
  const data = resultat.blocagesData ?? [];
  // Déficit HUMAIN (enseignants) : aucune correction de configuration n'y remédie.
  if (data.some((d) => d.type === "enseignants")) return [];

  const ctx = contexteFenetres(etab);
  const entrees = lirePlages(etab, ctx);
  const entreeParCle = new Map(entrees.map((e) => [e.cle, e]));
  const allLevels = [...new Set(classes.map((c) => c.niveau.id))];
  const nomNiveau = new Map(classes.map((c) => [c.niveau.id, c.niveau.nom]));
  const classesParId = new Map(classes.map((c) => [c.id, c]));
  const front = probleme.frontiereMatinAprem ?? Math.floor(ctx.N / 2);

  // État MUTABLE des corrections, accumulé puis matérialisé.
  const releases = new Map<string, Set<string>>(); // cle d'entrée → niveaux retirés
  const bascules = new Set<string>(); // niveauId → vacation journée entière
  const basculeMotif = new Map<string, string>();
  const epsCorrections = new Map<"matin" | "apresmidi", CorrectionEdt>();

  const couvreToutes = (e: EntreePlage) => !e.niveauIds || allLevels.every((n) => e.niveauIds!.includes(n));
  const releasedSet = (e: EntreePlage) => releases.get(e.cle);
  const effectiveCouvreToutes = (e: EntreePlage) => couvreToutes(e) && !(releasedSet(e)?.size);
  const closesLevel = (e: EntreePlage, lvl: string) =>
    (couvreToutes(e) || (e.niveauIds?.includes(lvl) ?? false)) && !releasedSet(e)?.has(lvl);
  const liberer = (e: EntreePlage, lvl: string) => {
    const s = releases.get(e.cle) ?? new Set<string>();
    s.add(lvl);
    releases.set(e.cle, s);
  };
  const basculer = (niveauId: string, motif: string) => {
    if (!bascules.has(niveauId)) basculeMotif.set(niveauId, motif);
    bascules.add(niveauId);
  };

  // Créneaux d'établissement encore fermés (entrées effectivement couvrantes).
  const fermeturesEtab = (): Set<string> => {
    const s = new Set<string>();
    for (const e of entrees) if (effectiveCouvreToutes(e)) for (const c of e.cellules) s.add(c);
    return s;
  };

  // ── EPS ──
  const repli = replisEPS(etab, probleme);
  const cotesElargis = new Set<"matin" | "apresmidi">();
  const proposerEPS = (cote: "matin" | "apresmidi", duree: number): boolean => {
    // Re-propose pour une durée PLUS GRANDE même si le côté a déjà un candidat (une séance
    // plus longue peut exiger une fenêtre plus large).
    const c = candidatElargirEPS(etab, cote, duree);
    if (!c) return cotesElargis.has(cote); // pas de nouveau candidat : succès seulement si déjà élargi
    epsCorrections.set(cote, c);
    cotesElargis.add(cote);
    return true;
  };
  // Proactif : réglage « EPS opposée » actif mais des classes sont retombées au comportement
  // classique (fenêtre opposée trop étroite). Avec « salle attitrée », ce repli casse aussi
  // l'appariement des salles → corriger la plage opposée restaure le réglage ET l'appariement.
  if (repli && (etab.salleFixeParClasse || data.some((d) => d.type === "classe_creneaux" && repli.classesIds.has(d.classeId)))) {
    for (const cid of repli.classesIds) proposerEPS(repli.coteParClasse.get(cid)!, repli.dureeMax);
  }
  // Blocages « aucune période autorisée » sur l'EPS : plage trop étroite en valeur absolue.
  for (const d of data) {
    if (d.type === "periodes_autorisees" && d.salleTypeRequis === "salle_eps") {
      proposerEPS("matin", d.duree);
      proposerEPS("apresmidi", d.duree);
    }
  }

  // ── Salles attitrées surchargées ──
  for (const d of data) {
    if (d.type !== "salle_imposee") continue;
    const niveaux = [...new Set(d.classeIds.map((cid) => classesParId.get(cid)?.niveau.id).filter((x): x is string => !!x))];
    if (d.periodes <= d.creneauxSemaine) {
      // Une semaine COMPLÈTE suffirait : libérer le niveau de la salle des plages
      // d'établissement (les convertit en plages ciblées : les AUTRES niveaux gardent leur
      // demi-journée libre) jusqu'à ce que les créneaux ouverts couvrent la demande.
      let ouverts = d.creneauxSemaine - fermeturesEtab().size;
      let garde = entrees.length + 1;
      while (ouverts < d.periodes && garde-- > 0) {
        const candidats = entrees.filter((e) => effectiveCouvreToutes(e));
        if (candidats.length === 0) break;
        // Plus grande fermeture d'abord (gain maximal).
        candidats.sort((a, b) => b.cellules.size - a.cellules.size);
        for (const lvl of niveaux) liberer(candidats[0], lvl);
        ouverts = d.creneauxSemaine - fermeturesEtab().size;
      }
      if (ouverts >= d.periodes) continue;
    }
    // Plus que la semaine entière d'une salle : la salle partagée ne peut pas absorber les
    // deux classes → leur niveau passe en journée entière (salle exclusive).
    for (const niveauId of niveaux) {
      const cl = classes.find((c) => c.niveau.id === niveauId);
      if (!cl || cl.regimeVacation !== "double") continue;
      basculer(
        niveauId,
        `la salle attitrée partagée « ${d.salleNom} » devrait accueillir ${d.periodes} périodes, plus que ce qu'une salle peut offrir sur la semaine — chaque classe reçoit sa salle exclusive.`,
      );
    }
  }

  // ── Fenêtre de créneaux des classes ──
  for (const d of data) {
    if (d.type !== "classe_creneaux") continue;
    const cl = classesParId.get(d.classeId);
    if (!cl) continue;
    const niveauId = cl.niveau.id;

    let requis = d.requis;
    // EPS repliée dans la fenêtre de la classe : si la plage opposée est élargie, l'EPS
    // s'isolera et libérera sa part de la fenêtre.
    if (repli?.classesIds.has(d.classeId)) {
      const cote = repli.coteParClasse.get(d.classeId);
      if (cote && (cotesElargis.has(cote) || proposerEPS(cote, repli.dureeMax))) {
        requis -= repli.dureeParClasse.get(d.classeId) ?? 0;
      }
    }
    if (requis <= d.disponibles) continue; // l'élargissement d'EPS suffit à lui seul

    if (requis <= d.disponiblesSansFermetures) {
      // Fenêtre EXACTE de la classe (comme le solveur : bornes par jour selon la vacation
      // effective du bloc de référence — un jour de vacation simple compte la journée entière).
      const ref =
        probleme.blocs.find((b) => b.classeId === d.classeId && !b.joursAutorises) ??
        probleme.blocs.find((b) => b.classeId === d.classeId);
      const groupeDe = (jour: number): 0 | 1 | null => {
        if (!ref?.vacationParJour) return ref?.vacationGroupe ?? null;
        const v = ref.vacationParJour[jour];
        return v === undefined ? ref.vacationGroupe : v;
      };
      const fenetre = new Set<string>();
      for (let jour = 0; jour < 5; jour++) {
        const g = groupeDe(jour);
        const [deb, fin] = g === null ? [0, ctx.N - 1] : g === 0 ? [0, front - 1] : [front, ctx.N - 1];
        for (let per = deb; per <= fin; per++) fenetre.add(`${jour}:${per}`);
      }
      const cellulesFermees = (): Set<string> => {
        const s = new Set<string>();
        for (const e of entrees) {
          if (!closesLevel(e, niveauId)) continue;
          for (const c of e.cellules) if (fenetre.has(c)) s.add(c);
        }
        return s;
      };
      let dispo = fenetre.size - cellulesFermees().size;
      let garde = entrees.length * 2 + 1;
      while (dispo < requis && garde-- > 0) {
        const candidats = entrees.filter((e) => closesLevel(e, niveauId) && [...e.cellules].some((c) => fenetre.has(c)));
        if (candidats.length === 0) break;
        // Gain MARGINAL de la libération (cellules réellement rouvertes pour cette classe).
        const fermeesAvant = cellulesFermees();
        let meilleur: EntreePlage | null = null;
        let meilleurGain = 0;
        for (const e of candidats) {
          liberer(e, niveauId);
          const gain = fermeesAvant.size - cellulesFermees().size;
          releases.get(e.cle)!.delete(niveauId);
          if (gain > meilleurGain) {
            meilleurGain = gain;
            meilleur = e;
          }
        }
        if (meilleur) {
          liberer(meilleur, niveauId);
        } else {
          // Gains unitaires tous nuls (fermetures qui se CHEVAUCHENT — plusieurs entrées
          // couvrant les mêmes créneaux) : libérer TOUS les candidats ensemble pour rompre le
          // blocage (la réouverture complète est prouvée suffisante : requis ≤ disponiblesSansFermetures).
          for (const e of candidats) liberer(e, niveauId);
        }
        dispo = fenetre.size - cellulesFermees().size;
      }
      if (dispo >= requis) continue;
    }

    // Même toutes fermetures rouvertes, la demi-journée ne suffit pas : journée entière —
    // prouvé pour une classe en double vacation (ex : 27 périodes > 25 créneaux).
    if (cl.regimeVacation === "double" && d.requis <= ctx.N * 5) {
      basculer(
        niveauId,
        `${d.requis} périodes à placer pour ${d.disponiblesSansFermetures} créneaux d'une demi-journée au mieux — la double vacation est mathématiquement impossible pour ce niveau.`,
      );
    }
  }

  // ── Matérialisation ──
  const corrections: CorrectionEdt[] = [...epsCorrections.values()];
  for (const [cle, rel] of releases) {
    if (rel.size === 0) continue;
    const e = entreeParCle.get(cle);
    if (!e) continue;
    // Un niveau basculé en journée entière n'a plus besoin qu'on retire sa plage : on ne le
    // compte pas dans le retrait (évite une correction redondante).
    const relEff = [...rel].filter((n) => !bascules.has(n));
    if (relEff.length === 0) continue;
    const targeted = couvreToutes(e) ? allLevels : e.niveauIds!;
    const restants = targeted.filter((n) => !relEff.includes(n));
    if (restants.length === 0) {
      corrections.push({
        type: "retirer_plage",
        cle: `plage:${cle}`,
        entreeCle: cle,
        jour: e.jour,
        moment: e.moment,
        description: `Plage sans cours « ${JOURS[e.jour]} — ${MOMENTS[e.moment]} » retirée : ces créneaux sont indispensables pour caser tous les cours (classes ou salles saturées sans eux).`,
      });
    } else {
      const noms = relEff.map((n) => nomNiveau.get(n) ?? n);
      corrections.push({
        type: "restreindre_plage",
        cle: `plage:${cle}`,
        entreeCle: cle,
        jour: e.jour,
        moment: e.moment,
        niveauIdsRestants: restants,
        niveauxRetires: relEff,
        description: `Plage sans cours « ${JOURS[e.jour]} — ${MOMENTS[e.moment]} » : le(s) niveau(x) ${noms.join(", ")} en est/sont retiré(s) (leurs classes ont besoin de ces créneaux pour caser tous leurs cours) ; conservée pour les autres niveaux.`,
      });
    }
  }
  for (const niveauId of bascules) {
    corrections.push({
      type: "vacation_journee_entiere",
      cle: `vac:${niveauId}`,
      niveauId,
      niveauNom: nomNiveau.get(niveauId) ?? niveauId,
      description: `Niveau ${nomNiveau.get(niveauId) ?? niveauId} basculé en vacation simple (journée entière) : ${basculeMotif.get(niveauId) ?? ""}`,
    });
  }
  return corrections;
}

/** Applique des corrections à des COPIES de l'établissement et des classes (jamais l'original). */
export function appliquerCorrections(
  etab: Etablissement,
  classes: ClasseInput[],
  corrections: CorrectionEdt[],
): { etab: Etablissement; classes: ClasseInput[] } {
  const e: Etablissement = { ...etab };
  let plages = Array.isArray(etab.plagesSansCours)
    ? [...(etab.plagesSansCours as { jour?: unknown; moment?: unknown; niveauIds?: unknown }[])]
    : [];
  let cls = classes;
  const cleDe = (pl: { jour?: unknown; moment?: unknown; niveauIds?: unknown }) => {
    const ids =
      Array.isArray(pl?.niveauIds) && (pl.niveauIds as unknown[]).length > 0 ? (pl.niveauIds as unknown[]).map(String) : null;
    return `${Number(pl?.jour)}:${String(pl?.moment ?? "")}:${(ids ?? []).slice().sort().join(",")}`;
  };
  for (const c of corrections) {
    switch (c.type) {
      case "retirer_plage":
        plages = plages.filter((pl) => cleDe(pl) !== c.entreeCle);
        break;
      case "restreindre_plage":
        // UNE correction par entrée : on écrit directement la liste résultante (aucune
        // dépendance à l'ordre, aucune clé recalculée sur un état déjà modifié).
        plages = plages.map((pl) =>
          cleDe(pl) === c.entreeCle ? { ...pl, niveauIds: c.niveauIdsRestants } : pl,
        );
        break;
      case "elargir_eps":
        if (c.cote === "matin") {
          e.epsMatinDebut = c.debut;
          e.epsMatinFin = c.fin;
        } else {
          e.epsApresMidiDebut = c.debut;
          e.epsApresMidiFin = c.fin;
        }
        break;
      case "vacation_journee_entiere":
        cls = cls.map((cl) => (cl.niveau.id === c.niveauId ? { ...cl, regimeVacation: "simple" } : cl));
        break;
    }
  }
  e.plagesSansCours = plages as never;
  return { etab: e, classes: cls };
}

export interface GenerationCorrigee {
  resultat: Resultat;
  /** Corrections APPLIQUÉES (vide si la génération a réussi sans, ou si rien n'a abouti). */
  corrections: CorrectionEdt[];
  /** Blocages de la tentative INITIALE quand des corrections ont été appliquées (explication IA). */
  blocagesInitiaux?: string[];
  etabCorrige: Etablissement;
  classesCorrigees: ClasseInput[];
}

/**
 * Résout l'emploi du temps AVEC correction automatique : tentative normale d'abord, puis
 * boucles analyse → corrections → re-résolution (3 tours max, budget partagé). Les
 * corrections ne sont RETENUES que si la génération corrigée ABOUTIT ; sinon l'état
 * d'origine (et ses blocages) est rendu tel quel — la configuration n'est jamais dégradée
 * pour rien.
 */
export function resoudreAvecCorrectionsAuto(input: ConstruireProblemeInput, budgetMs: number): GenerationCorrigee {
  const debut = Date.now();
  let etabC = input.etab;
  let classesC = input.classes;
  let probleme = construireProbleme(input);
  let resultat = resoudre({ ...probleme, budgetMs });
  const resultatInitial = resultat;
  const appliquees: CorrectionEdt[] = [];
  const clesVues = new Set<string>();

  for (let tour = 0; tour < 3 && !resultat.ok; tour++) {
    const restant = budgetMs - (Date.now() - debut);
    if (restant < 15_000) break; // plus assez de budget pour prouver une correction
    const candidates = proposerCorrections({ etab: etabC, classes: classesC, probleme, resultat }).filter(
      (c) => !clesVues.has(c.cle),
    );
    if (candidates.length === 0) break;
    for (const c of candidates) clesVues.add(c.cle);
    ({ etab: etabC, classes: classesC } = appliquerCorrections(etabC, classesC, candidates));
    appliquees.push(...candidates);
    probleme = construireProbleme({ ...input, etab: etabC, classes: classesC });
    if (probleme.blocs.length === 0) break;
    resultat = resoudre({ ...probleme, budgetMs: restant });
  }

  if (!resultat.ok) {
    // Échec malgré tout : NE RIEN CHANGER — blocages d'origine, configuration intacte.
    return { resultat: resultatInitial, corrections: [], etabCorrige: input.etab, classesCorrigees: input.classes };
  }
  return {
    resultat,
    corrections: appliquees,
    blocagesInitiaux: appliquees.length > 0 ? resultatInitial.blocages : undefined,
    etabCorrige: etabC,
    classesCorrigees: classesC,
  };
}
