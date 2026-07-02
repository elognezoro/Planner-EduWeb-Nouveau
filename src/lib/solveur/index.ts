/**
 * Solveur d'emplois du temps — backtracking avec heuristiques (cahier §5.3.0).
 *
 * Approche par COMPTEURS d'enseignants : les enseignants sont des unités anonymes regroupées
 * en « pools » par cycle + discipline (ex. 4 profs de Maths au collège). Le solveur choisit,
 * pour chaque séance, un créneau + une salle + une unité-enseignant du bon pool, sans jamais
 * violer les contraintes dures. En sur-contrainte, il renvoie des points de blocage explicites.
 */

export interface SalleSolveur {
  nom: string;
  capacite: number;
  type: string;
}

export interface EnseignantUnite {
  id: string;
  pool: string; // ex : "college:<disciplineId>"
  nom: string; // libellé affiché (ex : "Prof Mathématiques (collège) #2")
}

export interface BlocCours {
  id: string;
  classeId: string;
  classeNom: string;
  effectif: number;
  vacationGroupe: 0 | 1 | null;
  disciplineId: string;
  disciplineNom: string;
  /** Pool d'enseignants requis (cycle:disciplineId). */
  enseignantPool: string;
  /** Libellé lisible du pool, pour les messages de blocage (ex : "Mathématiques (collège)"). */
  poolLabel: string;
  duree: number;
  salleTypeRequis: string | null;
}

export interface Probleme {
  joursOuvres: number;
  periodesParJour: number;
  salles: SalleSolveur[];
  enseignants: EnseignantUnite[];
  blocs: BlocCours[];
  appliquerTypeSalle: boolean;
  /**
   * Nombre de périodes par bloc d'enseignement (séparés par les pauses), ex : [3, 2, 3].
   * Un cours de plusieurs périodes ne peut pas chevaucher une frontière de bloc (pause).
   * Absent / vide ⇒ un seul bloc = aucune contrainte de pause.
   */
  blocsPeriodes?: number[];
}

export interface Placement {
  blocId: string;
  classeId: string;
  classeNom: string;
  disciplineId: string;
  disciplineNom: string;
  enseignantId: string;
  enseignantNom: string;
  salleNom: string;
  jour: number;
  periode: number;
  duree: number;
}

/** Détail des pénalités sur les contraintes souples (cahier §6, V2). */
export interface PenalitesSouples {
  trous: number; // heures creuses (trous) dans la journée d'une classe
  repartition: number; // même discipline plusieurs fois le même jour
  consecutives: number; // plus de 2 heures consécutives de la même discipline
  finJournee: number; // cours en toute dernière période
  pauseMidi: number; // absence de pause méridienne (période centrale occupée)
}

/** Score de qualité global d'un emploi du temps (0–100), avec le détail des pénalités. */
export interface Qualite {
  score: number; // qualité finale (après optimisation)
  scoreInitial: number; // qualité de la première solution (avant optimisation)
  penalites: PenalitesSouples;
}

export interface Resultat {
  ok: boolean;
  placements: Placement[];
  blocages: string[];
  stats: { blocs: number; places: number; etapes: number };
  qualite?: Qualite;
}

const LIMITE_ETAPES = 400_000;
/** Garde-fou temps réel : au-delà, on abandonne proprement avec un blocage explicite
 *  (jamais de requête qui tourne sans fin — cahier §5.3.0-f). */
const LIMITE_MS = 25_000;
/** Nombre de tentatives de résolution (redémarrages randomisés — remède standard aux
 *  explosions pathologiques du backtracking sur un ordre de parcours malchanceux). */
const NB_TENTATIVES = 3;

/** Générateur pseudo-aléatoire déterministe (mulberry32) — résultats reproductibles. */
function mulberry32(graine: number): () => number {
  let seed = graine | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function melanger<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function typeCompatible(p: Probleme, bloc: BlocCours, salle: SalleSolveur): boolean {
  if (salle.capacite < bloc.effectif) return false;
  if (!p.appliquerTypeSalle) return true;
  // Cours à salle spécialisée (EPS, informatique, labo…) : type exact requis.
  if (bloc.salleTypeRequis) return salle.type === bloc.salleTypeRequis;
  // Cours ordinaire : salle ordinaire uniquement (ne pas gaspiller un plateau/labo).
  return salle.type === "ordinaire";
}

function bornesPeriodes(p: Probleme, groupe: 0 | 1 | null): [number, number] {
  if (groupe === null) return [0, p.periodesParJour - 1];
  const moitie = Math.floor(p.periodesParJour / 2);
  return groupe === 0 ? [0, moitie - 1] : [moitie, p.periodesParJour - 1];
}

export function resoudre(p: Probleme): Resultat {
  const blocages: string[] = [];

  // Frontières de blocs d'enseignement (pauses) : pour chaque période, dernière période de SON
  // bloc. Un cours ne peut pas déborder au-delà (il traverserait une pause). Défaut : bloc unique.
  const finBloc: number[] = new Array(p.periodesParJour);
  {
    const decoupe =
      p.blocsPeriodes && p.blocsPeriodes.reduce((a, b) => a + b, 0) === p.periodesParJour
        ? p.blocsPeriodes
        : [p.periodesParJour];
    let deb = 0;
    for (const taille of decoupe) {
      const fin = deb + taille - 1;
      for (let i = deb; i <= fin && i < p.periodesParJour; i++) finBloc[i] = fin;
      deb += taille;
    }
    for (let i = 0; i < p.periodesParJour; i++) if (finBloc[i] == null) finBloc[i] = p.periodesParJour - 1;
  }
  const tientDansBloc = (periode: number, duree: number) => periode + duree - 1 <= finBloc[periode];

  const unitesParPool = new Map<string, EnseignantUnite[]>();
  for (const u of p.enseignants) {
    const arr = unitesParPool.get(u.pool) ?? [];
    arr.push(u);
    unitesParPool.set(u.pool, arr);
  }

  // ── Pré-vérifications ──
  const sallesCompatibles = new Map<string, SalleSolveur[]>();
  const poolsVus = new Set<string>();
  for (const bloc of p.blocs) {
    const compat = p.salles.filter((s) => typeCompatible(p, bloc, s));
    sallesCompatibles.set(bloc.id, compat);
    if (compat.length === 0) {
      const msg = bloc.salleTypeRequis
        ? `Aucune salle compatible (type « ${bloc.salleTypeRequis} », capacité ≥ ${bloc.effectif}) pour ${bloc.disciplineNom} – ${bloc.classeNom}.`
        : `Aucune salle de capacité ≥ ${bloc.effectif} pour ${bloc.disciplineNom} – ${bloc.classeNom}.`;
      if (!blocages.includes(msg)) blocages.push(msg);
    }
    if (!poolsVus.has(bloc.enseignantPool)) {
      poolsVus.add(bloc.enseignantPool);
      if ((unitesParPool.get(bloc.enseignantPool)?.length ?? 0) === 0) {
        blocages.push(`Aucun enseignant déclaré pour ${bloc.poolLabel}. Renseignez les effectifs enseignants.`);
      }
    }
  }

  // Capacité globale salles.
  const demande = p.blocs.reduce((a, b) => a + b.duree, 0);
  const offreSalles = p.joursOuvres * p.periodesParJour * p.salles.length;
  if (offreSalles > 0 && demande > offreSalles) {
    blocages.push(`Volume total trop élevé : ${demande} créneaux-séances pour ${offreSalles} créneaux-salles. Ajoutez des salles ou réduisez les volumes.`);
  }

  // Capacité par pool d'enseignants.
  const demandeParPool = new Map<string, { duree: number; label: string }>();
  for (const b of p.blocs) {
    const e = demandeParPool.get(b.enseignantPool) ?? { duree: 0, label: b.poolLabel };
    e.duree += b.duree;
    demandeParPool.set(b.enseignantPool, e);
  }
  for (const [pool, info] of demandeParPool) {
    const n = unitesParPool.get(pool)?.length ?? 0;
    const offre = n * p.joursOuvres * p.periodesParJour;
    if (n > 0 && info.duree > offre) {
      const manque = Math.ceil(info.duree / (p.joursOuvres * p.periodesParJour)) - n;
      blocages.push(`Pas assez d'enseignants pour ${info.label} : ${info.duree} créneaux à couvrir, ${n} enseignant(s) déclaré(s) (ajoutez ~${manque}).`);
    }
  }

  // Capacité par classe.
  const parClasse = new Map<string, { duree: number; nom: string; groupe: 0 | 1 | null }>();
  for (const b of p.blocs) {
    const e = parClasse.get(b.classeId) ?? { duree: 0, nom: b.classeNom, groupe: b.vacationGroupe };
    e.duree += b.duree;
    parClasse.set(b.classeId, e);
  }
  for (const [, info] of parClasse) {
    const [deb, fin] = bornesPeriodes(p, info.groupe);
    const dispo = p.joursOuvres * (fin - deb + 1);
    if (info.duree > dispo) {
      blocages.push(`${info.nom} : ${info.duree} créneaux à placer pour ${dispo} disponibles dans la semaine. Réduisez le volume horaire.`);
    }
  }

  if (blocages.length > 0) {
    return { ok: false, placements: [], blocages, stats: { blocs: p.blocs.length, places: 0, etapes: 0 } };
  }

  // ── Heuristique : blocs les plus contraints d'abord ──
  // La durée prime : un cours de 2 périodes n'a qu'une poignée de positions possibles par
  // jour (il ne peut pas traverser une pause), là où un cours d'1 période en a bien plus.
  // Les placer en premier (grille encore vide) évite les impasses tardives du backtracking.
  const ordre = [...p.blocs].sort((a, b) => {
    if (b.duree !== a.duree) return b.duree - a.duree;
    const ra = sallesCompatibles.get(a.id)!.length;
    const rb = sallesCompatibles.get(b.id)!.length;
    if (ra !== rb) return ra - rb;
    const na = unitesParPool.get(a.enseignantPool)!.length;
    const nb = unitesParPool.get(b.enseignantPool)!.length;
    if (na !== nb) return na - nb;
    return (a.vacationGroupe !== null ? 0 : 1) - (b.vacationGroupe !== null ? 0 : 1);
  });

  // État de la tentative courante (réinitialisé à chaque redémarrage randomisé).
  let occT = new Set<string>(); // unitéEnseignant occupée
  let occC = new Set<string>(); // classe occupée
  let occR = new Set<string>(); // salle occupée
  let placements: Placement[] = [];
  let etapes = 0;
  let etapesTotal = 0;
  const debutMs = Date.now();
  let finTentativeMs = debutMs + LIMITE_MS / NB_TENTATIVES;
  let abandonne = false; // limite d'étapes OU de temps atteinte → déroulage rapide de la pile
  // Ordres de parcours actifs (tentative 0 = déterministe, suivantes = mélangées).
  let sallesActives = sallesCompatibles;
  let unitesActives = unitesParPool;

  function creneauLibre(jour: number, periode: number, duree: number, classeId: string, salleNom: string, uniteId: string): boolean {
    for (let d = 0; d < duree; d++) {
      const pp = periode + d;
      if (occC.has(`${classeId}:${jour}:${pp}`)) return false;
      if (occR.has(`${salleNom}:${jour}:${pp}`)) return false;
      if (occT.has(`${uniteId}:${jour}:${pp}`)) return false;
    }
    return true;
  }
  function basculer(jour: number, periode: number, duree: number, classeId: string, salleNom: string, uniteId: string, set: boolean) {
    const op = set ? "add" : "delete";
    for (let d = 0; d < duree; d++) {
      const pp = periode + d;
      occC[op](`${classeId}:${jour}:${pp}`);
      occR[op](`${salleNom}:${jour}:${pp}`);
      occT[op](`${uniteId}:${jour}:${pp}`);
    }
  }

  function placer(i: number): boolean {
    if (i >= ordre.length) return true;
    if (abandonne) return false;
    if (++etapes > LIMITE_ETAPES || (etapes % 2048 === 0 && Date.now() > finTentativeMs)) {
      abandonne = true;
      return false;
    }
    const bloc = ordre[i];
    const [deb, fin] = bornesPeriodes(p, bloc.vacationGroupe);
    const compat = sallesActives.get(bloc.id)!;
    const unites = unitesActives.get(bloc.enseignantPool)!;

    // Étalement (souple) : jours où la classe a le moins de séances d'abord.
    const sessionsJour = new Array(p.joursOuvres).fill(0);
    for (const pl of placements) if (pl.classeId === bloc.classeId) sessionsJour[pl.jour]++;
    const jours = [...Array(p.joursOuvres).keys()].sort((x, y) => sessionsJour[x] - sessionsJour[y]);

    for (const jour of jours) {
      if (abandonne) return false;
      for (let periode = deb; periode + bloc.duree - 1 <= fin; periode++) {
        if (!tientDansBloc(periode, bloc.duree)) continue; // ne pas traverser une pause
        for (const salle of compat) {
          if (abandonne) return false;
          for (const unite of unites) {
            if (!creneauLibre(jour, periode, bloc.duree, bloc.classeId, salle.nom, unite.id)) continue;
            basculer(jour, periode, bloc.duree, bloc.classeId, salle.nom, unite.id, true);
            placements.push({
              blocId: bloc.id,
              classeId: bloc.classeId,
              classeNom: bloc.classeNom,
              disciplineId: bloc.disciplineId,
              disciplineNom: bloc.disciplineNom,
              enseignantId: unite.id,
              enseignantNom: unite.nom,
              salleNom: salle.nom,
              jour,
              periode,
              duree: bloc.duree,
            });
            if (placer(i + 1)) return true;
            placements.pop();
            basculer(jour, periode, bloc.duree, bloc.classeId, salle.nom, unite.id, false);
          }
        }
      }
    }
    return false;
  }

  // ── Évaluation des contraintes SOUPLES (V2) : pénalités d'UNE classe ──
  function penalitesBrutesClasse(pls: Placement[]): PenalitesSouples {
    const pen: PenalitesSouples = { trous: 0, repartition: 0, consecutives: 0, finJournee: 0, pauseMidi: 0 };
    const milieu = Math.floor(p.periodesParJour / 2);
    const parJour = new Map<number, Placement[]>();
    for (const pl of pls) {
      const arr = parJour.get(pl.jour);
      if (arr) arr.push(pl);
      else parJour.set(pl.jour, [pl]);
    }
    for (const liste of parJour.values()) {
      const periodeDisc = new Map<number, string>();
      let min = Infinity;
      let max = -Infinity;
      let milieuOccupe = false;
      for (const pl of liste) {
        for (let d = 0; d < pl.duree; d++) {
          const per = pl.periode + d;
          periodeDisc.set(per, pl.disciplineId);
          if (per < min) min = per;
          if (per > max) max = per;
          if (per === milieu) milieuOccupe = true;
          if (per === p.periodesParJour - 1) pen.finJournee += 1;
        }
      }
      if (max >= min) pen.trous += max - min + 1 - periodeDisc.size;
      let run = 1;
      for (let per = min + 1; per <= max; per++) {
        const cur = periodeDisc.get(per);
        const prev = periodeDisc.get(per - 1);
        if (cur != null && cur === prev) {
          run += 1;
          if (run > 2) pen.consecutives += 1;
        } else run = 1;
      }
      if (milieuOccupe) pen.pauseMidi += 1;
    }
    const cnt = new Map<string, number>();
    for (const pl of pls) {
      const k = `${pl.jour}:${pl.disciplineId}`;
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
    for (const c of cnt.values()) if (c > 1) pen.repartition += c - 1;
    return pen;
  }

  function grouperParClasse(): Map<string, Placement[]> {
    const m = new Map<string, Placement[]>();
    for (const pl of placements) {
      const arr = m.get(pl.classeId);
      if (arr) arr.push(pl);
      else m.set(pl.classeId, [pl]);
    }
    return m;
  }

  function evaluerPenalites(): PenalitesSouples {
    const tot: PenalitesSouples = { trous: 0, repartition: 0, consecutives: 0, finJournee: 0, pauseMidi: 0 };
    for (const pls of grouperParClasse().values()) {
      const c = penalitesBrutesClasse(pls);
      tot.trous += c.trous;
      tot.repartition += c.repartition;
      tot.consecutives += c.consecutives;
      tot.finJournee += c.finJournee;
      tot.pauseMidi += c.pauseMidi;
    }
    return tot;
  }

  function poids(pen: PenalitesSouples): number {
    return pen.trous * 3 + pen.repartition * 2 + pen.consecutives * 2 + pen.finJournee * 1 + pen.pauseMidi * 1;
  }
  function penaliteClasse(pls: Placement[]): number {
    return poids(penalitesBrutesClasse(pls));
  }
  function scoreDe(pen: PenalitesSouples): number {
    const parBloc = poids(pen) / Math.max(1, placements.length);
    return Math.max(0, Math.min(100, Math.round(100 - parBloc * 12)));
  }

  // ── Optimisation (V2) : recherche locale par déplacements de créneaux ──
  // Chaque cours est déplacé (même salle + même enseignant) vers le créneau qui minimise
  // la pénalité de SA classe (répartition, heures consécutives, fin de journée, trous),
  // sans jamais violer les contraintes dures. Budget borné pour rester rapide.
  function optimiserDeplacements() {
    const parClasse = grouperParClasse();
    const classeVac = new Map<string, 0 | 1 | null>();
    for (const b of p.blocs) if (!classeVac.has(b.classeId)) classeVac.set(b.classeId, b.vacationGroupe);
    let budget = 1_500_000;
    for (let pass = 0; pass < 4; pass++) {
      let ameliore = false;
      for (const pl of placements) {
        const cls = parClasse.get(pl.classeId)!;
        const [deb, fin] = bornesPeriodes(p, classeVac.get(pl.classeId) ?? null);
        const avant = penaliteClasse(cls);
        const oj = pl.jour;
        const op = pl.periode;
        basculer(oj, op, pl.duree, pl.classeId, pl.salleNom, pl.enseignantId, false);
        let bj = oj;
        let bp = op;
        let best = avant;
        for (let jour = 0; jour < p.joursOuvres && budget > 0; jour++) {
          for (let per = deb; per + pl.duree - 1 <= fin; per++) {
            if (jour === oj && per === op) continue;
            if (!tientDansBloc(per, pl.duree)) continue; // ne pas traverser une pause
            if (--budget <= 0) break;
            if (!creneauLibre(jour, per, pl.duree, pl.classeId, pl.salleNom, pl.enseignantId)) continue;
            pl.jour = jour;
            pl.periode = per;
            const pen = penaliteClasse(cls);
            if (pen < best) {
              best = pen;
              bj = jour;
              bp = per;
            }
          }
        }
        pl.jour = bj;
        pl.periode = bp;
        basculer(bj, bp, pl.duree, pl.classeId, pl.salleNom, pl.enseignantId, true);
        if (best < avant) ameliore = true;
        if (budget <= 0) break;
      }
      if (!ameliore || budget <= 0) break;
    }
  }

  // ── Optimisation (V2) : échanges de créneaux entre classes ──
  // Échange les temps de deux cours de classes différentes (chacun conserve sa salle et son
  // enseignant) quand la pénalité combinée des deux classes diminue. Échantillonnage strié +
  // budget borné ; n'applique que des échanges améliorants (score non régressif).
  function optimiserSwaps() {
    const n = placements.length;
    if (n < 2) return;
    const parClasse = grouperParClasse();
    const classeVac = new Map<string, 0 | 1 | null>();
    for (const b of p.blocs) if (!classeVac.has(b.classeId)) classeVac.set(b.classeId, b.vacationGroupe);
    const W = 30;
    const stride = Math.max(1, Math.floor(n / W));
    let budget = 300_000;
    for (let pass = 0; pass < 2 && budget > 0; pass++) {
      let ameliore = false;
      for (let a = 0; a < n && budget > 0; a++) {
        const pl1 = placements[a];
        for (let k = 1; k <= W; k++) {
          if (--budget <= 0) break;
          const pl2 = placements[(a + k * stride) % n];
          if (pl2 === pl1 || pl1.classeId === pl2.classeId || pl1.duree !== pl2.duree) continue;
          if (pl1.jour === pl2.jour && pl1.periode === pl2.periode) continue;
          const [d1, f1] = bornesPeriodes(p, classeVac.get(pl1.classeId) ?? null);
          const [d2, f2] = bornesPeriodes(p, classeVac.get(pl2.classeId) ?? null);
          if (pl2.periode < d1 || pl2.periode + pl1.duree - 1 > f1) continue;
          if (pl1.periode < d2 || pl1.periode + pl2.duree - 1 > f2) continue;
          // Ni l'un ni l'autre ne doit traverser une pause à sa nouvelle place.
          if (!tientDansBloc(pl2.periode, pl1.duree) || !tientDansBloc(pl1.periode, pl2.duree)) continue;
          const cls1 = parClasse.get(pl1.classeId)!;
          const cls2 = parClasse.get(pl2.classeId)!;
          const avant = penaliteClasse(cls1) + penaliteClasse(cls2);
          const oj1 = pl1.jour, op1 = pl1.periode, oj2 = pl2.jour, op2 = pl2.periode;
          basculer(oj1, op1, pl1.duree, pl1.classeId, pl1.salleNom, pl1.enseignantId, false);
          basculer(oj2, op2, pl2.duree, pl2.classeId, pl2.salleNom, pl2.enseignantId, false);
          // Faisabilité de l'échange (chaque cours va sur le créneau de l'autre).
          let faisable = creneauLibre(oj2, op2, pl1.duree, pl1.classeId, pl1.salleNom, pl1.enseignantId);
          if (faisable) {
            basculer(oj2, op2, pl1.duree, pl1.classeId, pl1.salleNom, pl1.enseignantId, true);
            faisable = creneauLibre(oj1, op1, pl2.duree, pl2.classeId, pl2.salleNom, pl2.enseignantId);
            basculer(oj2, op2, pl1.duree, pl1.classeId, pl1.salleNom, pl1.enseignantId, false);
          }
          if (!faisable) {
            basculer(oj1, op1, pl1.duree, pl1.classeId, pl1.salleNom, pl1.enseignantId, true);
            basculer(oj2, op2, pl2.duree, pl2.classeId, pl2.salleNom, pl2.enseignantId, true);
            continue;
          }
          pl1.jour = oj2; pl1.periode = op2;
          pl2.jour = oj1; pl2.periode = op1;
          const apres = penaliteClasse(cls1) + penaliteClasse(cls2);
          if (apres < avant) {
            basculer(pl1.jour, pl1.periode, pl1.duree, pl1.classeId, pl1.salleNom, pl1.enseignantId, true);
            basculer(pl2.jour, pl2.periode, pl2.duree, pl2.classeId, pl2.salleNom, pl2.enseignantId, true);
            ameliore = true;
          } else {
            pl1.jour = oj1; pl1.periode = op1; pl2.jour = oj2; pl2.periode = op2;
            basculer(oj1, op1, pl1.duree, pl1.classeId, pl1.salleNom, pl1.enseignantId, true);
            basculer(oj2, op2, pl2.duree, pl2.classeId, pl2.salleNom, pl2.enseignantId, true);
          }
        }
      }
      if (!ameliore) break;
    }
  }

  // ── Tentatives : déterministe d'abord, puis redémarrages avec ordres mélangés ──
  let succes = false;
  let tempsEpuise = false;
  for (let essai = 0; essai < NB_TENTATIVES && !succes; essai++) {
    if (essai > 0) {
      if (Date.now() - debutMs > LIMITE_MS) {
        tempsEpuise = true;
        break;
      }
      const rnd = mulberry32(1789 + essai * 977);
      sallesActives = new Map(
        [...sallesCompatibles].map(([id, liste]) => [id, melanger(liste, rnd)]),
      );
      unitesActives = new Map(
        [...unitesParPool].map(([pool, liste]) => [pool, melanger(liste, rnd)]),
      );
    }
    occT = new Set();
    occC = new Set();
    occR = new Set();
    placements = [];
    etapes = 0;
    abandonne = false;
    finTentativeMs = Math.min(Date.now() + LIMITE_MS / NB_TENTATIVES, debutMs + LIMITE_MS);
    succes = placer(0);
    etapesTotal += etapes;
    if (abandonne) tempsEpuise = tempsEpuise || Date.now() - debutMs > LIMITE_MS;
  }

  if (!succes) {
    const restant = ordre[placements.length];
    if (tempsEpuise || abandonne || etapes > LIMITE_ETAPES) {
      blocages.push("Génération trop complexe pour aboutir dans le temps imparti. Réduisez les contraintes (volumes, double vacation) ou ajoutez des ressources (salles, enseignants).");
    } else if (restant) {
      blocages.push(`Impossible de placer ${restant.disciplineNom} – ${restant.classeNom} sans conflit (enseignant, classe ou salle occupés sur tous les créneaux possibles).`);
    } else {
      blocages.push("Aucune solution complète n'a pu être trouvée avec les contraintes actuelles.");
    }
    return { ok: false, placements: [], blocages, stats: { blocs: p.blocs.length, places: placements.length, etapes: etapesTotal } };
  }

  // Qualité de la première solution, puis optimisation, puis qualité finale.
  const scoreInitial = scoreDe(evaluerPenalites());
  optimiserDeplacements();
  optimiserSwaps();
  optimiserDeplacements();
  const penalites = evaluerPenalites();
  const score = scoreDe(penalites);

  return {
    ok: true,
    placements: [...placements],
    blocages: [],
    stats: { blocs: p.blocs.length, places: placements.length, etapes: etapesTotal },
    qualite: { score, scoreInitial, penalites },
  };
}
