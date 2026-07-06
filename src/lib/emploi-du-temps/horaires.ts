// Calcule les créneaux horaires réels d'une journée à partir des horaires configurés
// de l'établissement (début, pauses, fin). Une séance dure UNE UNITÉ FIXE de 55 minutes
// (modèle national ivoirien) : les périodes sont posées bout à bout depuis le début de
// chaque bloc d'enseignement (matin, fin de matinée, après-midi), séparées par les pauses.
// Sert à afficher « 07h30–08h25 » au lieu de « P1 » ET à informer le solveur des frontières
// de blocs (un cours long ne doit pas traverser une pause).

/** Durée unitaire d'une séance, en minutes (cf. tâche « durée unitaire de séance 55 min »). */
export const DUREE_SEANCE_MIN = 55;

export interface EtablissementHoraires {
  creneauxParJour: number;
  horaireDebutMatin: string | null;
  horairePauseMatinDebut: string | null;
  horairePauseMatinFin: string | null;
  horairePauseMidiDebut: string | null;
  horaireRepriseApresMidi: string | null;
  horaireFinJournee: string | null;
}

export interface CreneauHoraire {
  debut: string; // ex : "07h30"
  fin: string; // ex : "08h30"
}

function toMin(v: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function fmt(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${String(h).padStart(2, "0")}h${String(r).padStart(2, "0")}`;
}

/**
 * Découpe la journée en blocs d'enseignement (hors pauses) et répartit `creneauxParJour`
 * périodes dessus, proportionnellement à la durée de chaque bloc (min. 1 par bloc).
 * Détermine COMBIEN de périodes tombent dans chaque bloc (leur nombre) ; leur DURÉE, elle,
 * est fixe (55 min, cf. `periodesHoraires`). Renvoie `null` si les horaires sont inexploitables.
 */
function decouperJournee(
  etab: EtablissementHoraires,
): { blocs: [number, number][]; counts: number[]; pauses: ("recreation" | "dejeuner")[] } | null {
  const N = Math.max(1, etab.creneauxParJour);
  const debut = toMin(etab.horaireDebutMatin);
  const fin = toMin(etab.horaireFinJournee);
  if (debut == null || fin == null || fin <= debut) return null;

  const pmD = toMin(etab.horairePauseMatinDebut);
  const pmF = toMin(etab.horairePauseMatinFin);
  const midiD = toMin(etab.horairePauseMidiDebut);
  const repriseAM = toMin(etab.horaireRepriseApresMidi);

  // Plages d'enseignement (on saute les pauses valides), avec la pause qui SUIT chaque plage.
  const plages: { plage: [number, number]; pauseApres: "recreation" | "dejeuner" | null }[] = [];
  let curseur = debut;
  if (pmD != null && pmF != null && pmD > curseur && pmF > pmD && pmF < fin) {
    plages.push({ plage: [curseur, pmD], pauseApres: "recreation" });
    curseur = pmF;
  }
  if (midiD != null && repriseAM != null && midiD > curseur && repriseAM > midiD && repriseAM < fin) {
    plages.push({ plage: [curseur, midiD], pauseApres: "dejeuner" });
    curseur = repriseAM;
  }
  if (fin > curseur) plages.push({ plage: [curseur, fin], pauseApres: null });

  const gardees = plages.filter(({ plage: [a, b] }) => b > a);
  const blocs = gardees.map((g) => g.plage);
  const pauses = gardees.slice(0, -1).map((g) => g.pauseApres ?? "dejeuner");
  if (blocs.length === 0 || N < blocs.length) return null;

  // Répartition des N périodes sur les blocs, proportionnellement à leur durée (min. 1 chacun).
  const durees = blocs.map(([a, b]) => b - a);
  const total = durees.reduce((a, b) => a + b, 0);
  const ideal = durees.map((d) => (N * d) / total);
  const counts = ideal.map((x) => Math.max(1, Math.round(x)));
  let somme = counts.reduce((a, b) => a + b, 0);
  while (somme > N) {
    let i = -1;
    let best = -Infinity;
    for (let k = 0; k < counts.length; k++) {
      if (counts[k] <= 1) continue;
      const ecart = counts[k] - ideal[k];
      if (ecart > best) {
        best = ecart;
        i = k;
      }
    }
    if (i < 0) break;
    counts[i] -= 1;
    somme -= 1;
  }
  while (somme < N) {
    let i = 0;
    let best = -Infinity;
    for (let k = 0; k < counts.length; k++) {
      const ecart = ideal[k] - counts[k];
      if (ecart > best) {
        best = ecart;
        i = k;
      }
    }
    counts[i] += 1;
    somme += 1;
  }

  // Une séance dure 55 min FIXE et se pose au début du bloc : un bloc ne peut donc contenir que
  // floor(durée / 55) séances sans qu'une séance déborde sur la pause qui le suit (et ne décale
  // ainsi la RÉCRÉATION ou la PAUSE DÉJEUNER — ex. la pause de midi qui glissait à 12h50 au lieu
  // de 12h00). On plafonne chaque bloc AVANT une pause à sa capacité réelle et on reporte
  // l'excédent sur le DERNIER bloc : aucune pause ne le suit, il peut donc s'étendre en fin de
  // journée sans fausser l'heure d'aucune pause. La somme des créneaux reste égale à N.
  const dernier = blocs.length - 1;
  for (let b = 0; b < dernier; b++) {
    const capacite = Math.max(1, Math.floor(durees[b] / DUREE_SEANCE_MIN));
    if (counts[b] > capacite) {
      counts[dernier] += counts[b] - capacite;
      counts[b] = capacite;
    }
  }

  return { blocs, counts, pauses };
}

/**
 * Horaires de chaque période de la journée en MINUTES (début/fin), séances de 55 minutes
 * posées bout à bout depuis le début de chaque bloc d'enseignement. Base commune de
 * `creneauxHoraires`, `minutesParPeriode` et `periodesDansPlages`.
 */
function periodesHoraires(etab: EtablissementHoraires): { debut: number; fin: number }[] | null {
  const decoupe = decouperJournee(etab);
  if (!decoupe) return null;
  const res: { debut: number; fin: number }[] = [];
  for (let b = 0; b < decoupe.blocs.length; b++) {
    const depart = decoupe.blocs[b][0];
    for (let k = 0; k < decoupe.counts[b]; k++) {
      res.push({ debut: depart + k * DUREE_SEANCE_MIN, fin: depart + (k + 1) * DUREE_SEANCE_MIN });
    }
  }
  return res;
}

/**
 * Renvoie `creneauxParJour` plages horaires (séances de 55 min), ou `null` si les horaires
 * sont inexploitables (dans ce cas l'appelant retombe sur « P1, P2… »).
 */
export function creneauxHoraires(etab: EtablissementHoraires): CreneauHoraire[] | null {
  const periodes = periodesHoraires(etab);
  if (!periodes) return null;
  return periodes.map((p) => ({ debut: fmt(p.debut), fin: fmt(p.fin) }));
}

/**
 * Nombre de périodes par bloc d'enseignement (ex : [3, 2, 3] pour matin / fin de matinée /
 * après-midi). Sert au solveur pour empêcher un cours de plusieurs périodes de traverser une
 * pause. Renvoie `null` si le découpage est impossible (le solveur retombe alors sur un bloc
 * unique = aucune contrainte de pause).
 */
export function periodesParBloc(etab: EtablissementHoraires): number[] | null {
  const decoupe = decouperJournee(etab);
  return decoupe ? decoupe.counts : null;
}

/**
 * Répartit les indices de périodes en MATIN et APRÈS-MIDI, la frontière étant la pause
 * méridienne (déjeuner). Les blocs d'enseignement situés avant la pause déjeuner sont le
 * matin ; ceux d'après sont l'après-midi. En l'absence de pause déjeuner, on retombe sur
 * la moitié des périodes. Sert aux plages « sans cours » (demi-journée) de l'établissement.
 */
export function periodesMatinApresMidi(
  etab: EtablissementHoraires,
): { matin: number[]; apresMidi: number[] } | null {
  const decoupe = decouperJournee(etab);
  if (!decoupe) return null;
  const { counts, pauses } = decoupe;
  const total = counts.reduce((a, b) => a + b, 0);

  // Frontière = fin du dernier bloc précédant la pause « dejeuner ».
  let frontiere = -1;
  let cumul = 0;
  for (let b = 0; b < counts.length; b++) {
    cumul += counts[b];
    if (b < pauses.length && pauses[b] === "dejeuner") {
      frontiere = cumul; // les périodes 0..frontiere-1 sont le matin
      break;
    }
  }
  if (frontiere < 0) frontiere = Math.ceil(total / 2); // pas de pause déjeuner → moitié

  const matin: number[] = [];
  const apresMidi: number[] = [];
  for (let i = 0; i < total; i++) (i < frontiere ? matin : apresMidi).push(i);
  return { matin, apresMidi };
}

/** Bande de pause à matérialiser dans les grilles d'emploi du temps. */
export interface BandePause {
  /** Indice de la période APRÈS laquelle la bande s'affiche. */
  apresPeriode: number;
  /** Texte de la bande : « RÉCRÉATION » ou « PAUSE DÉJEUNER ». */
  libelle: string;
}

/**
 * Bandes de pause de la journée : la pause matinale (RÉCRÉATION) et la pause méridienne
 * (PAUSE DÉJEUNER), positionnées après la dernière période de leur bloc d'enseignement.
 * Renvoie `null` si les horaires sont inexploitables.
 */
export function bandesPause(etab: EtablissementHoraires): BandePause[] | null {
  const decoupe = decouperJournee(etab);
  if (!decoupe) return null;
  const res: BandePause[] = [];
  let cumul = 0;
  for (let b = 0; b < decoupe.counts.length - 1; b++) {
    cumul += decoupe.counts[b];
    res.push({
      apresPeriode: cumul - 1,
      libelle: decoupe.pauses[b] === "recreation" ? "RÉCRÉATION" : "PAUSE DÉJEUNER",
    });
  }
  return res;
}

/**
 * Durée (en minutes) de chacune des périodes de la journée, dans l'ordre. Chaque séance
 * dure 55 minutes (unité fixe). Sert au calcul des volumes horaires hebdomadaires affichés
 * sur les emplois du temps. Renvoie `null` si les horaires sont inexploitables (l'appelant
 * retombe alors sur 55 min par période).
 */
export function minutesParPeriode(etab: EtablissementHoraires): number[] | null {
  const periodes = periodesHoraires(etab);
  if (!periodes) return null;
  return periodes.map(() => DUREE_SEANCE_MIN);
}

/**
 * Indices des périodes ENTIÈREMENT comprises dans l'une des plages « HH:MM » données
 * (ex : plages d'EPS de l'établissement). Renvoie `null` si aucune plage exploitable
 * n'est fournie ou si les horaires de la journée sont inexploitables — l'appelant
 * n'applique alors aucune restriction.
 */
export function periodesDansPlages(
  etab: EtablissementHoraires,
  plages: { debut: string | null; fin: string | null }[],
): number[] | null {
  const valides = plages
    .map((p) => ({ debut: toMin(p.debut), fin: toMin(p.fin) }))
    .filter((p): p is { debut: number; fin: number } => p.debut != null && p.fin != null && p.fin > p.debut);
  if (valides.length === 0) return null;

  const periodes = periodesHoraires(etab);
  if (!periodes) return null;

  const indices: number[] = [];
  for (let i = 0; i < periodes.length; i++) {
    const p = periodes[i];
    if (valides.some((v) => p.debut >= v.debut && p.fin <= v.fin)) indices.push(i);
  }
  return indices;
}
