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
  /**
   * Périodes de la journée autorisées pour CE cours (ex : plages d'EPS de l'établissement).
   * Absent / null ⇒ toutes les périodes.
   */
  periodesAutorisees?: number[] | null;
  /** Jours autorisés pour CE cours (ex : EPS fixée au jour de vacation simple). Absent ⇒ tous. */
  joursAutorises?: number[] | null;
  /**
   * Groupe de vacation EFFECTIF par jour (longueur = jours ouvrés), prime sur vacationGroupe.
   * Permet « vacation simple le jour d'EPS » : null ce jour-là (journée entière), le groupe
   * habituel les autres jours. Absent ⇒ vacationGroupe uniforme.
   */
  vacationParJour?: (0 | 1 | null)[];
  /** Catégorie de la discipline (contraintes d'enchaînement littéraires/scientifiques). */
  disciplineCategorie?: "litteraire" | "scientifique" | "autre";
  /**
   * Séance de FRANÇAIS d'une classe de COLLÈGE (1er cycle) : préférence SOUPLE — deux séances de
   * français le même jour devraient être isolées (séparées par une autre discipline, de préférence
   * scientifique). Sert à la pénalité de qualité `francaisNonIsole`.
   */
  francaisCollege?: boolean;
  /**
   * Salle ATTITRÉE imposée à ce cours (mode « réduire les déplacements des élèves » : chaque
   * classe a sa salle, les enseignants se déplacent). Absent / null ⇒ salle au choix du
   * solveur parmi les compatibles. Les cours à salle spécialisée n'en portent jamais.
   */
  salleImposee?: string | null;
}

export interface Probleme {
  joursOuvres: number;
  periodesParJour: number;
  salles: SalleSolveur[];
  enseignants: EnseignantUnite[];
  blocs: BlocCours[];
  appliquerTypeSalle: boolean;
  /** Budget temps de RECHERCHE en millisecondes (défaut : LIMITE_MS). L'appelant le
   *  dimensionne selon la taille du problème et le plafond d'exécution de la plateforme. */
  budgetMs?: number;
  /** Salles ATTITRÉES à des classes (mode « réduire les déplacements des élèves ») : les
   *  cours SANS salle imposée les évitent tant qu'il reste au moins une salle libre
   *  compatible — recours au parc entier sinon (jamais d'échec artificiel). */
  sallesReservees?: string[];
  /** Salle attitrée SOUPLE : la salle imposée d'un cours devient une PRÉFÉRENCE (essayée en 1er) —
   *  le surplus se déplace vers une autre salle libre au lieu de bloquer (pas de blocage capacité). */
  salleImposeeSouple?: boolean;
  /** Libellés des RÉGLAGES restrictifs actifs (EPS demi-journée opposée, salle attitrée…) :
   *  rappelés dans les messages d'échec — un réglage volontairement strict peut être la
   *  cause d'une sur-contrainte, l'utilisateur doit pouvoir le relier à l'échec. */
  reglagesActifs?: string[];
  /**
   * Nombre de périodes par bloc d'enseignement (séparés par les pauses), ex : [3, 2, 3].
   * Un cours de plusieurs périodes ne peut pas chevaucher une frontière de bloc (pause).
   * Absent / vide ⇒ un seul bloc = aucune contrainte de pause.
   */
  blocsPeriodes?: number[];
  /**
   * Frontière matin / après-midi = nombre de périodes du MATIN (les indices 0..frontière-1 sont
   * le matin, frontière..N-1 l'après-midi). C'est la frontière RÉELLE de la pause déjeuner, telle
   * qu'affichée dans la grille — et NON `floor(N/2)`, qui décalait la demi-journée de vacation
   * (une classe du matin perdait alors la dernière période d'avant-déjeuner). Absent ⇒ floor(N/2).
   */
  frontiereMatinAprem?: number;
  /** Garantit à chaque unité-enseignant un jour SANS cours parmi les jours ouvrés (dure). */
  reposEnseignant?: boolean;
  /** Regroupe les heures creuses des enseignants sur une demi-journée (pénalité dédiée). */
  optimiserEnseignants?: boolean;
  /**
   * Autorise des heures creuses dans l'EDT des ÉLÈVES (pour souffler) — choix du chef :
   * les trous des classes ne sont alors plus pénalisés par l'optimisation.
   */
  autoriserHeuresCreusesEleves?: boolean;
  /**
   * Créneaux FERMÉS dans tout l'établissement (aucun cours) — clés « jour:periode ».
   * Permet un jour ou une demi-journée sans cours choisis par le chef.
   */
  periodesFermees?: Set<string>;
  /**
   * Créneaux FERMÉS PAR CLASSE (plages sans cours ciblant des NIVEAUX précis) — classeId →
   * clés « jour:periode ». S'ajoute aux fermetures d'établissement ; les autres classes
   * gardent ces créneaux ouverts.
   */
  periodesFermeesParClasse?: Map<string, Set<string>>;
  /**
   * Plafond de SERVICE hebdomadaire par unité-enseignant (id → nb de périodes max/semaine),
   * issu du « volume horaire dû » selon le cycle. Contrainte DURE : une unité n'est jamais
   * chargée au-delà. Une unité absente de la table n'a pas de plafond (capacité physique).
   */
  capaciteServiceParUnite?: Map<string, number>;
  /**
   * Interdit deux séances immédiatement consécutives de la MÊME discipline dans la journée
   * d'une classe — la pause méridienne rompt la consécutivité (contrainte DURE optionnelle).
   */
  memeDisciplineNonConsecutive?: boolean;
  /** Interdit deux disciplines LITTÉRAIRES immédiatement consécutives (classe — DURE). */
  litterairesNonConsecutifs?: boolean;
  /** Interdit deux disciplines SCIENTIFIQUES immédiatement consécutives (classe — DURE). */
  scientifiquesNonConsecutifs?: boolean;
  /**
   * Évite qu'un enseignant n'ait qu'UNE séance dans une demi-journée (il se déplacerait pour
   * un seul cours) : pénalité FORTE minimisée par l'optimisation, résidus signalés en
   * avertissements — jamais en silence.
   */
  eviterSeanceIsoleeEnseignant?: boolean;
  /**
   * Une discipline : au plus UNE séance par demi-journée dans l'EDT d'une classe (contrainte
   * DURE optionnelle). Sans pause déjeuner réelle, la journée entière compte pour une
   * demi-journée.
   */
  uneSeanceParDemiJournee?: boolean;
  /**
   * Évite qu'une classe TERMINE deux jours consécutifs par la même discipline : pénalité
   * forte minimisée par l'optimisation, résidus signalés en avertissements.
   */
  eviterFinJourneeRepetee?: boolean;
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
  /** Heures creuses dispersées des ENSEIGNANTS (si optimiserEnseignants est actif). */
  trousEnseignants?: number;
  /** Demi-journées où un enseignant n'a qu'UNE séance (si eviterSeanceIsoleeEnseignant). */
  seancesIsoleesEnseignants?: number;
  /** Paires de jours consécutifs finissant par la même discipline (si eviterFinJourneeRepetee). */
  finsJourneesRepetees?: number;
  /** Enchaînements de même CATÉGORIE (littéraires/scientifiques consécutifs) — préférence SOUPLE. */
  enchainementCategorie?: number;
  /** Français (collège) : 2 séances du même jour mal isolées (consécutives, ou non séparées par
   *  une discipline scientifique) — préférence SOUPLE. */
  francaisNonIsole?: number;
}

/** Pénalités souples d'UNE classe (détail « classes concernées » des pastilles de qualité). */
export interface PenalitesClasse {
  classeId: string;
  penalites: PenalitesSouples;
}

/** Score de qualité global d'un emploi du temps (0–100), avec le détail des pénalités. */
export interface Qualite {
  score: number; // qualité finale (après optimisation)
  scoreInitial: number; // qualité de la première solution (avant optimisation)
  penalites: PenalitesSouples;
  /** Détail PAR CLASSE (après optimisation) — seules les classes pénalisées y figurent. */
  parClasse: PenalitesClasse[];
}

/**
 * Donnée STRUCTURÉE d'un blocage de pré-contrôle, émise en parallèle du message texte pour
 * les seuls blocages sur lesquels le moteur de CORRECTION AUTOMATIQUE (IA) sait agir :
 * fenêtre de créneaux d'une classe, salle attitrée surchargée, plage d'EPS trop étroite —
 * et le marqueur « enseignants » (déficit humain, jamais auto-corrigeable).
 */
export type BlocageData =
  | {
      type: "classe_creneaux";
      classeId: string;
      classeNom: string;
      requis: number;
      /** Créneaux disponibles dans la fenêtre de vacation de la classe (fermetures déduites). */
      disponibles: number;
      /** Disponibles si TOUTES les plages sans cours étaient rouvertes (même fenêtre). */
      disponiblesSansFermetures: number;
    }
  | {
      type: "salle_imposee";
      salleNom: string;
      periodes: number;
      creneauxOuverts: number;
      /** Créneaux d'une semaine ENTIÈREMENT ouverte (jours × périodes). */
      creneauxSemaine: number;
      classeIds: string[];
    }
  | { type: "periodes_autorisees"; classeId: string; disciplineNom: string; salleTypeRequis: string | null; duree: number }
  /** Déficit ABSOLU d'enseignants (aucun compétent, ou physiquement impossible) : non corrigeable. */
  | { type: "enseignants" }
  /**
   * Déficit dû au PLAFOND DE SERVICE (volume horaire dû) alors que les enseignants EXISTENT et
   * que la charge tiendrait physiquement : corrigeable par des HEURES SUPPLÉMENTAIRES réparties.
   * `capPhysique` = charge hebdomadaire maximale d'une unité (créneaux ouverts, repos déduit).
   */
  | { type: "service_enseignant"; cycles: string[]; poolLabel: string; demande: number; nbUnites: number; capPhysique: number };

export interface Resultat {
  ok: boolean;
  placements: Placement[];
  blocages: string[];
  stats: { blocs: number; places: number; etapes: number };
  /** Journal de recherche (diagnostic) : échecs de classes rencontrés pendant la résolution. */
  journal?: string[];
  qualite?: Qualite;
  /** Signalements NON bloquants (ex : séances isolées résiduelles malgré l'optimisation). */
  avertissements?: string[];
  /** Blocages de pré-contrôle en forme STRUCTURÉE (moteur de correction automatique). */
  blocagesData?: BlocageData[];
}

// Garde-fou absolu (boucle folle) — PAR TENTATIVE. Grand : le vrai plafond est le budget
// TEMPS ; un grand lycée réel consomme ~2 M d'étapes pour aboutir (Issia : 75 classes).
const LIMITE_ETAPES = 20_000_000;
/** Garde-fou temps réel : au-delà, on abandonne proprement avec un blocage explicite
 *  (jamais de requête qui tourne sans fin — cahier §5.3.0-f). Dimensionné pour un lycée de
 *  75 classes (~1 600 séances) ; la page qui héberge l'action fixe maxDuration = 60. */
const LIMITE_MS = 40_000;
/** Nombre de tentatives de résolution (redémarrages randomisés — remède standard aux
 *  explosions pathologiques du backtracking sur un ordre de parcours malchanceux). */
const NB_TENTATIVES = 3;
/** Recherche PAR CLASSE : essais par sous-problème (ordres de salles/unités re-mélangés)
 *  avec budgets d'étapes PROGRESSIFS, nombre maximal de SAUTS ARRIÈRE par tentative
 *  (défaire la classe précédente et permuter l'ordre quand une classe ne passe pas), et
 *  APPRENTISSAGE : une classe en échec répété est PROMUE EN TÊTE et la tentative repart —
 *  les classes difficiles se placent grille vide, comme le ferait un emploi-du-temps humain. */
// Un segment (une classe) se résout normalement en quelques centaines d'étapes : des paliers
// modestes suffisent, et un échec doit être DÉTECTÉ VITE — c'est lui qui déclenche
// l'apprentissage (saut/promotion), dont chaque cycle coûte une re-résolution.
const CAPS_ETAPES_CLASSE = [2_000, 8_000];
// Dernière tentative : un palier supplémentaire bien plus large — une classe dense mais
// résoluble ne doit pas être abandonnée avec le budget temps inutilisé.
const CAPS_ETAPES_CLASSE_FINALE = [2_000, 8_000, 40_000];
// Budget de réordonnancements par tentative. Généreux : sur un grand établissement, c'est
// souvent la COHORTE ENTIÈRE d'un niveau (10-15 classes à ~92 % de remplissage) qu'il faut
// promouvoir une à une en tête — le garde-fou réel est le budget TEMPS, pas celui-ci.
const MAX_SAUTS_ARRIERE = 600;
// Nombre d'échecs de segment à partir duquel une tentative est jugée « en train de patiner »
// et perd son droit au budget temps entier (voir finTentativeMs adaptatif). Assez haut pour
// laisser l'apprentissage par promotions dérouler plusieurs cycles avant de couper.
const SEUIL_PATINAGE = 12;
const COUT_PROMOTION = 4; // une promotion en tête « coûte » plusieurs sauts (garde-fou global)

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
  // Frontière RÉELLE de la pause déjeuner (grille) ; repli sur floor(N/2) si non fournie.
  const front = p.frontiereMatinAprem ?? Math.floor(p.periodesParJour / 2);
  return groupe === 0 ? [0, front - 1] : [front, p.periodesParJour - 1];
}

export function resoudre(p: Probleme): Resultat {
  const blocages: string[] = [];
  // Forme structurée des blocages de pré-contrôle (correction automatique par l'IA).
  const blocagesData: BlocageData[] = [];
  // Blocages « périodes autorisées » agrégés par (classe, discipline) en conservant la durée
  // MAXIMALE : deux séances d'une même discipline de durées différentes (ex : EPS 55 et 110)
  // partagent le même message, mais la correction doit viser la plus longue.
  const paData = new Map<string, Extract<BlocageData, { type: "periodes_autorisees" }>>();

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

  // Vacation PAR JOUR : le groupe effectif d'un bloc peut varier selon le jour (ex :
  // vacation simple le jour d'EPS). Certains blocs sont en outre fixés à des jours précis.
  const blocParId = new Map(p.blocs.map((b) => [b.id, b]));
  // Groupe de vacation effectif du bloc ce jour-là. Une entrée `null` de vacationParJour
  // signifie EXPLICITEMENT « journée entière » (vacation levée, ex : le jour d'EPS) : il ne
  // faut donc PAS la confondre avec « non défini » via `??` (qui retomberait à tort sur
  // vacationGroupe et annulerait la levée de la double vacation).
  const groupeDe = (bloc: BlocCours, jour: number): 0 | 1 | null => {
    if (!bloc.vacationParJour) return bloc.vacationGroupe;
    const v = bloc.vacationParJour[jour];
    return v === undefined ? bloc.vacationGroupe : v;
  };
  const joursPermis = (bloc: BlocCours, jour: number): boolean =>
    !bloc.joursAutorises || bloc.joursAutorises.includes(jour);

  // Créneaux fermés dans tout l'établissement (jour / demi-journée sans cours), plus les
  // fermetures PAR CLASSE (plages ciblant des niveaux) quand `classeId` est fourni.
  const periodesFermees = p.periodesFermees ?? new Set<string>();
  const estFerme = (jour: number, periode: number, duree = 1, classeId?: string): boolean => {
    const propres = classeId ? p.periodesFermeesParClasse?.get(classeId) : undefined;
    for (let d = 0; d < duree; d++) {
      const cle = `${jour}:${periode + d}`;
      if (periodesFermees.has(cle) || propres?.has(cle)) return true;
    }
    return false;
  };
  // Nombre de créneaux (jour,période) réellement ouverts, pour les vérifications de capacité
  // GLOBALES (salles, service enseignant) — les fermetures par niveau, partielles par nature,
  // sont prises en compte par la vérification PAR CLASSE plus bas.
  let creneauxOuverts = 0;
  const ouvertsParJour: number[] = new Array(p.joursOuvres).fill(0);
  for (let j = 0; j < p.joursOuvres; j++)
    for (let per = 0; per < p.periodesParJour; per++)
      if (!estFerme(j, per)) {
        creneauxOuverts++;
        ouvertsParJour[j]++;
      }

  const unitesParPool = new Map<string, EnseignantUnite[]>();
  for (const u of p.enseignants) {
    const arr = unitesParPool.get(u.pool) ?? [];
    arr.push(u);
    unitesParPool.set(u.pool, arr);
  }

  // ── Pré-vérifications ──
  const sallesCompatibles = new Map<string, SalleSolveur[]>();
  const poolsVus = new Set<string>();
  // Une pénurie d'enseignants ne doit être signalée qu'UNE fois : dès qu'un contrôle
  // (pool vide, par pool, ensemble lié) a nommé le goulot, le test par flot est superflu.
  let blocageEnseignants = false;
  // Restriction de périodes par bloc (ex : plages d'EPS) — pré-résolue en Set.
  const autoriseesParBloc = new Map<string, Set<number>>();
  const sallesReservees = new Set(p.sallesReservees ?? []);
  for (const bloc of p.blocs) {
    // Salle ATTITRÉE (mode « les élèves ne se déplacent pas ») : elle est la SEULE candidate
    // du cours — l'attribution en amont a déjà vérifié sa capacité. Les cours SANS salle
    // imposée ÉVITENT les salles attitrées des autres classes tant qu'il reste une salle
    // libre compatible (recours au parc entier sinon — jamais d'échec artificiel).
    let compat: SalleSolveur[];
    if (bloc.salleImposee) {
      const attitree = p.salles.filter((s) => s.nom === bloc.salleImposee);
      if (p.salleImposeeSouple) {
        // SOUPLE : salle attitrée en TÊTE (préférée), puis les autres salles compatibles en repli
        // (le surplus qui ne tient pas dans la salle partagée se pose ailleurs — jamais de blocage).
        let repli = p.salles.filter((s) => s.nom !== bloc.salleImposee && typeCompatible(p, bloc, s));
        if (sallesReservees.size > 0 && !bloc.salleTypeRequis) {
          // Priorité aux salles NON réservées (salles tournantes) ; les salles réservées d'AUTRES
          // classes viennent en dernier recours — utilisables uniquement quand leur classe ne les
          // occupe pas (ex. le mercredi matin où beaucoup de classes libèrent leur salle pour l'EPS).
          // Les conserver en repli (au lieu de les exclure) évite d'entasser tout le surplus sur les
          // seules salles tournantes et laisse le solveur converger.
          const horsReserve = repli.filter((s) => !sallesReservees.has(s.nom));
          const reserve = repli.filter((s) => sallesReservees.has(s.nom));
          repli = [...horsReserve, ...reserve];
        }
        compat = [...attitree, ...repli];
      } else {
        compat = attitree;
      }
    } else {
      compat = p.salles.filter((s) => typeCompatible(p, bloc, s));
      if (sallesReservees.size > 0 && !bloc.salleTypeRequis) {
        const horsReserve = compat.filter((s) => !sallesReservees.has(s.nom));
        if (horsReserve.length > 0) compat = horsReserve;
      }
    }
    sallesCompatibles.set(bloc.id, compat);
    if (compat.length === 0) {
      const msg = bloc.salleImposee
        ? `La salle attitrée « ${bloc.salleImposee} » de ${bloc.classeNom} est introuvable parmi les salles configurées.`
        : bloc.salleTypeRequis
          ? `Aucune salle compatible (type « ${bloc.salleTypeRequis} », capacité ≥ ${bloc.effectif}) pour ${bloc.disciplineNom} – ${bloc.classeNom}.`
          : `Aucune salle de capacité ≥ ${bloc.effectif} pour ${bloc.disciplineNom} – ${bloc.classeNom}.`;
      if (!blocages.includes(msg)) blocages.push(msg);
    }
    if (!poolsVus.has(bloc.enseignantPool)) {
      poolsVus.add(bloc.enseignantPool);
      if ((unitesParPool.get(bloc.enseignantPool)?.length ?? 0) === 0) {
        blocages.push(`Aucun enseignant déclaré pour ${bloc.poolLabel}. Renseignez les effectifs enseignants.`);
        blocageEnseignants = true;
        blocagesData.push({ type: "enseignants" });
      }
    }
    if (bloc.periodesAutorisees) {
      const set = new Set(bloc.periodesAutorisees);
      autoriseesParBloc.set(bloc.id, set);
      let possible = false;
      for (let jour = 0; jour < p.joursOuvres && !possible; jour++) {
        if (!joursPermis(bloc, jour)) continue;
        const [debV, finV] = bornesPeriodes(p, groupeDe(bloc, jour));
        for (let per = debV; per + bloc.duree - 1 <= finV && !possible; per++) {
          if (!tientDansBloc(per, bloc.duree)) continue;
          if (estFerme(jour, per, bloc.duree, bloc.classeId)) continue; // plage sans cours
          let ok = true;
          for (let d = 0; d < bloc.duree; d++) {
            if (!set.has(per + d)) {
              ok = false;
              break;
            }
          }
          possible = ok;
        }
      }
      if (!possible) {
        const msg = `${bloc.disciplineNom} – ${bloc.classeNom} : aucune période autorisée ne convient (plages horaires configurées trop étroites, ou incompatibles avec la vacation).`;
        if (!blocages.includes(msg)) blocages.push(msg);
        // Donnée structurée agrégée par (classe, discipline), durée MAXIMALE conservée —
        // indépendamment du dédoublonnage du TEXTE (deux durées → un seul message).
        const cle = `${bloc.classeId}:${bloc.disciplineId}`;
        const exist = paData.get(cle);
        if (!exist || bloc.duree > exist.duree) {
          paData.set(cle, {
            type: "periodes_autorisees",
            classeId: bloc.classeId,
            disciplineNom: bloc.disciplineNom,
            salleTypeRequis: bloc.salleTypeRequis ?? null,
            duree: bloc.duree,
          });
        }
      }
    }
  }
  const periodesPermises = (blocId: string, periode: number, duree: number): boolean => {
    const set = autoriseesParBloc.get(blocId);
    if (!set) return true;
    for (let d = 0; d < duree; d++) if (!set.has(periode + d)) return false;
    return true;
  };

  // Capacité globale salles (les créneaux fermés ne comptent pas).
  const demande = p.blocs.reduce((a, b) => a + b.duree, 0);
  const offreSalles = creneauxOuverts * p.salles.length;
  if (offreSalles > 0 && demande > offreSalles) {
    blocages.push(`Volume total trop élevé : ${demande} créneaux-séances pour ${offreSalles} créneaux-salles disponibles. Ajoutez des salles, réduisez les volumes ou les plages sans cours.`);
  }

  // Capacité par TYPE de salle spécialisée, en tenant compte des plages autorisées
  // (ex : EPS confinée à ses plages → chaque plateau n'offre que |plages| × jours créneaux).
  {
    const parType = new Map<string, { demande: number; periodes: number; label: string }>();
    for (const b of p.blocs) {
      if (!b.salleTypeRequis) continue;
      const e = parType.get(b.salleTypeRequis) ?? {
        demande: 0,
        periodes: p.periodesParJour,
        label: b.disciplineNom,
      };
      e.demande += b.duree;
      const fenetre = autoriseesParBloc.get(b.id)?.size ?? p.periodesParJour;
      e.periodes = Math.min(e.periodes, fenetre);
      parType.set(b.salleTypeRequis, e);
    }
    // Fraction de créneaux ouverts (hors plages sans cours), appliquée aux capacités par salle.
    const fractionOuverte = creneauxOuverts / Math.max(1, p.joursOuvres * p.periodesParJour);
    for (const [type, info] of parType) {
      const nbSalles = p.salles.filter((s) => s.type === type).length;
      const capacite = Math.floor(nbSalles * p.joursOuvres * info.periodes * fractionOuverte);
      if (nbSalles > 0 && info.demande > capacite) {
        const manque = Math.ceil(info.demande / Math.max(1, Math.floor(p.joursOuvres * info.periodes * fractionOuverte))) - nbSalles;
        blocages.push(
          `Capacité insuffisante en salles « ${type} » pour ${info.label} : ${info.demande} créneaux à caser pour ${capacite} disponibles${info.periodes < p.periodesParJour ? " (plages horaires restreintes)" : ""} — ajoutez ~${manque} salle(s), élargissez les plages ou réduisez les plages sans cours.`,
        );
      }
    }
    // Et les cours ORDINAIRES : quand les types de salle s'appliquent, ils ne peuvent pas
    // se replier sur les salles spécialisées — leur capacité (créneaux ouverts) est vérifiée aussi.
    if (p.appliquerTypeSalle) {
      const demandeOrdinaire = p.blocs.reduce((a, b) => a + (b.salleTypeRequis ? 0 : b.duree), 0);
      const nbOrdinaires = p.salles.filter((s) => s.type === "ordinaire").length;
      const capacite = nbOrdinaires * creneauxOuverts;
      if (demandeOrdinaire > capacite) {
        const manque = Math.ceil(demandeOrdinaire / Math.max(1, creneauxOuverts)) - nbOrdinaires;
        blocages.push(
          `Capacité insuffisante en salles ordinaires : ${demandeOrdinaire} créneaux à caser pour ${capacite} disponibles — déclarez ~${manque} salle(s) de plus (« Salles de classe disponibles ») ou réduisez les plages sans cours.`,
        );
      }
    }
  }

  // Capacité par SALLE ATTITRÉE : tous les cours imposés à une même salle (au plus deux
  // classes la partagent) doivent tenir dans ses créneaux ouverts de la semaine — sinon
  // blocage EXPLICITE nommant la salle et le réglage en cause (un jour de vacation simple
  // ou une configuration chargée peuvent dépasser la semaine d'une salle unique).
  {
    const parSalleImposee = new Map<string, { duree: number; classes: Set<string> }>();
    for (const b of p.blocs) {
      if (!b.salleImposee) continue;
      const e = parSalleImposee.get(b.salleImposee) ?? { duree: 0, classes: new Set<string>() };
      e.duree += b.duree;
      e.classes.add(b.classeId);
      parSalleImposee.set(b.salleImposee, e);
    }
    for (const [salle, info] of parSalleImposee) {
      // En mode SOUPLE, un dépassement ne bloque plus : le surplus se pose dans d'autres salles.
      if (info.duree > creneauxOuverts && !p.salleImposeeSouple) {
        blocages.push(
          `La salle attitrée « ${salle} » devrait accueillir ${info.duree} périodes pour ${creneauxOuverts} créneaux ouverts dans la semaine — trop de cours pour une seule salle (réglage « réduire les déplacements des élèves ») : réduisez les volumes ou désactivez ce réglage.`,
        );
        blocagesData.push({
          type: "salle_imposee",
          salleNom: salle,
          periodes: info.duree,
          creneauxOuverts,
          creneauxSemaine: p.joursOuvres * p.periodesParJour,
          classeIds: [...info.classes],
        });
      }
    }
  }

  // Capacité par pool d'enseignants.
  const demandeParPool = new Map<string, { duree: number; label: string }>();
  for (const b of p.blocs) {
    const e = demandeParPool.get(b.enseignantPool) ?? { duree: 0, label: b.poolLabel };
    e.duree += b.duree;
    demandeParPool.set(b.enseignantPool, e);
  }
  // Avec le jour de repos garanti, chaque unité perd un jour — au MIEUX le jour le MOINS
  // ouvert (le repos peut toujours y être posé). Une moyenne journalière floorée
  // sous-estimerait la capacité quand les fermetures sont inégales (ex : mercredi après-midi
  // libéré) et ferait rejeter des instances faisables : les pré-tests exigent une borne SUP.
  const capaciteUnite = Math.max(
    1,
    p.reposEnseignant && p.joursOuvres > 1 ? creneauxOuverts - Math.min(...ouvertsParJour) : creneauxOuverts,
  );
  // Capacité EFFECTIVE d'une unité : la plus petite de sa capacité physique (créneaux ouverts)
  // et de son plafond de service hebdomadaire (volume horaire dû), s'il est défini.
  const capEff = (uniteId: string): number =>
    Math.min(p.capaciteServiceParUnite?.get(uniteId) ?? Infinity, capaciteUnite);
  for (const [pool, info] of demandeParPool) {
    const unites = unitesParPool.get(pool) ?? [];
    const offre = unites.reduce((a, u) => a + capEff(u.id), 0);
    if (unites.length > 0 && info.duree > offre) {
      const repCap = Math.min(...unites.map((u) => capEff(u.id)));
      const manque = Math.max(1, Math.ceil((info.duree - offre) / Math.max(1, repCap)));
      const plafonne = unites.some((u) => (p.capaciteServiceParUnite?.get(u.id) ?? Infinity) < capaciteUnite);
      // Volume horaire hebdomadaire qu'il faudrait donner à CHAQUE enseignant de la spécialité
      // pour couvrir la charge à effectif constant (charge ÷ nombre d'enseignants).
      const volRequis = Math.ceil(info.duree / unites.length);
      blocages.push(
        `Pas assez d'enseignants pour ${info.label} : ${info.duree} h à couvrir, ${unites.length} enseignant(s) pour une capacité de ${offre}${plafonne ? " (limitée par le volume horaire dû)" : ""} — ajoutez ~${manque} enseignant(s)${plafonne ? ` ou portez leur volume horaire à ~${volRequis} h/semaine` : ""}.`,
      );
      blocageEnseignants = true;
      // Corrigeable par heures supplémentaires SEULEMENT si le déficit vient du plafond de
      // service (pas d'un manque absolu) ET que la charge tient physiquement (≤ capacité
      // physique de chaque unité). Sinon, déficit ABSOLU (ajouter des enseignants).
      if (plafonne && info.duree <= unites.length * capaciteUnite) {
        blocagesData.push({
          type: "service_enseignant",
          cycles: [pool.slice(0, pool.indexOf(":"))],
          poolLabel: info.label,
          demande: info.duree,
          nbUnites: unites.length,
          capPhysique: capaciteUnite,
        });
      } else {
        blocagesData.push({ type: "enseignants" });
      }
    }
  }

  // Capacité CROISÉE : un bivalent appartient à plusieurs pools mais sa capacité est
  // unique. On vérifie chaque composante de pools reliés par des unités partagées —
  // sinon un manque global passe les contrôles par pool et le backtracking s'enlise
  // au lieu d'expliquer le blocage.
  {
    const racine = new Map<string, string>();
    const find = (x: string): string => {
      let r = x;
      while (racine.get(r) !== r) r = racine.get(r)!;
      let c = x;
      while (racine.get(c) !== c) {
        const suivant = racine.get(c)!;
        racine.set(c, r);
        c = suivant;
      }
      return r;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) racine.set(ra, rb);
    };
    for (const pool of demandeParPool.keys()) racine.set(pool, pool);
    const poolsParUnite = new Map<string, string[]>();
    for (const u of p.enseignants) {
      if (!demandeParPool.has(u.pool)) continue;
      const arr = poolsParUnite.get(u.id) ?? [];
      arr.push(u.pool);
      poolsParUnite.set(u.id, arr);
    }
    for (const pools of poolsParUnite.values()) {
      for (let i = 1; i < pools.length; i++) union(pools[0], pools[i]);
    }
    const composantes = new Map<string, { pools: string[]; demande: number }>();
    for (const [pool, info] of demandeParPool) {
      const r = find(pool);
      const c = composantes.get(r) ?? { pools: [], demande: 0 };
      c.pools.push(pool);
      c.demande += info.duree;
      composantes.set(r, c);
    }
    for (const c of composantes.values()) {
      if (c.pools.length < 2) continue; // le contrôle par pool a déjà couvert ce cas
      const ids = new Set<string>();
      for (const pool of c.pools) for (const u of unitesParPool.get(pool) ?? []) ids.add(u.id);
      const offre = [...ids].reduce((a, id) => a + capEff(id), 0);
      if (ids.size > 0 && c.demande > offre) {
        const repCap = Math.min(...[...ids].map((id) => capEff(id)));
        const manque = Math.max(1, Math.ceil((c.demande - offre) / Math.max(1, repCap)));
        const volRequis = Math.ceil(c.demande / ids.size); // volume/enseignant à effectif constant
        const plafonne = [...ids].some((id) => (p.capaciteServiceParUnite?.get(id) ?? Infinity) < capaciteUnite);
        const libelles = c.pools
          .map((pool) => demandeParPool.get(pool)!.label)
          .slice(0, 4)
          .join(", ");
        blocages.push(
          `Pas assez d'enseignants pour l'ensemble lié ${libelles}${c.pools.length > 4 ? "…" : ""} : ${c.demande} h à couvrir pour une capacité de ${offre} (${ids.size} enseignant(s)) — les bivalents ne peuvent pas être à deux endroits à la fois (ajoutez ~${manque} enseignant(s)${plafonne ? ` ou portez leur volume horaire à ~${volRequis} h/semaine` : ""}).`,
        );
        blocageEnseignants = true;
        if (plafonne && c.demande <= ids.size * capaciteUnite) {
          blocagesData.push({
            type: "service_enseignant",
            cycles: [...new Set(c.pools.map((pool) => pool.slice(0, pool.indexOf(":"))))],
            poolLabel: libelles,
            demande: c.demande,
            nbUnites: ids.size,
            capPhysique: capaciteUnite,
          });
        } else {
          blocagesData.push({ type: "enseignants" });
        }
      }
    }
  }

  // Faisabilité AGRÉGÉE EXACTE (flot maximal pools → unités) : les contrôles par pool et par
  // composante ne testent pas les SOUS-ENSEMBLES (condition de Hall) — ex. : la demande
  // « LV2-Allemand » collège + lycée ne peut être servie QUE par les enseignants d'allemand,
  // même si la composante entière (avec l'espagnol et la LV2 générique) paraît excédentaire.
  // Un flot maximal (Dinic, graphe minuscule) tranche exactement et NOMME le goulot.
  // Sauté si un contrôle précédent a déjà signalé une pénurie d'enseignants : le flot
  // échouerait mathématiquement aussi et produirait un message redondant.
  // Quand le flot SATURE (problème faisable au niveau agrégé), sa répartition par arc
  // pool → unité est conservée comme PLAN : quota de périodes que chaque unité devrait
  // consacrer à chaque pool. La recherche s'en sert comme préférence de tri — sans quoi un
  // pool peut consommer les bivalents partagés et affamer un pool voisin à ajustement exact.
  const quotaFlot = new Map<string, number>();
  if (!blocageEnseignants) {
    const pools = [...demandeParPool.keys()];
    const unitesIds = [...new Set(p.enseignants.map((u) => u.id))];
    const nP = pools.length;
    const S = 0;
    const T = 1 + nP + unitesIds.length;
    const N = T + 1;
    const arcs: { to: number; cap: number }[] = [];
    const adj: number[][] = Array.from({ length: N }, () => []);
    const ajouterArc = (a: number, b: number, cap: number) => {
      adj[a].push(arcs.length);
      arcs.push({ to: b, cap });
      adj[b].push(arcs.length);
      arcs.push({ to: a, cap: 0 });
    };
    const indexPool = new Map(pools.map((pl, i) => [pl, 1 + i]));
    const indexUnite = new Map(unitesIds.map((id, i) => [id, 1 + nP + i]));
    let demandeTotale = 0;
    for (const pl of pools) {
      const d = demandeParPool.get(pl)!.duree;
      demandeTotale += d;
      ajouterArc(S, indexPool.get(pl)!, d);
    }
    for (const id of unitesIds) ajouterArc(indexUnite.get(id)!, T, capEff(id));
    const dejaArc = new Set<string>();
    const arcsPoolUnite: { cle: string; ai: number }[] = [];
    for (const u of p.enseignants) {
      if (!demandeParPool.has(u.pool)) continue;
      const cle = `${u.pool}|${u.id}`;
      if (dejaArc.has(cle)) continue;
      dejaArc.add(cle);
      arcsPoolUnite.push({ cle, ai: arcs.length });
      ajouterArc(indexPool.get(u.pool)!, indexUnite.get(u.id)!, Number.MAX_SAFE_INTEGER / 4);
    }
    const niveauN = new Int32Array(N);
    const itN = new Int32Array(N);
    const bfs = (): boolean => {
      niveauN.fill(-1);
      niveauN[S] = 0;
      const file = [S];
      for (let q = 0; q < file.length; q++) {
        const v = file[q];
        for (const ai of adj[v]) {
          const a = arcs[ai];
          if (a.cap > 0 && niveauN[a.to] < 0) {
            niveauN[a.to] = niveauN[v] + 1;
            file.push(a.to);
          }
        }
      }
      return niveauN[T] >= 0;
    };
    const dfs = (v: number, f: number): number => {
      if (v === T) return f;
      for (; itN[v] < adj[v].length; itN[v]++) {
        const ai = adj[v][itN[v]];
        const a = arcs[ai];
        if (a.cap > 0 && niveauN[a.to] === niveauN[v] + 1) {
          const g = dfs(a.to, Math.min(f, a.cap));
          if (g > 0) {
            a.cap -= g;
            arcs[ai ^ 1].cap += g;
            return g;
          }
        }
      }
      return 0;
    };
    let flot = 0;
    while (bfs()) {
      itN.fill(0);
      let f = dfs(S, Number.MAX_SAFE_INTEGER);
      while (f > 0) {
        flot += f;
        f = dfs(S, Number.MAX_SAFE_INTEGER);
      }
    }
    if (flot < demandeTotale) {
      // Coupe minimale : dans le graphe résiduel final, les pools encore atteignables depuis
      // la source forment le GOULOT — leur demande cumulée dépasse la capacité cumulée des
      // seuls enseignants qui peuvent les servir.
      bfs();
      const poolsGoulot = pools.filter((pl) => niveauN[indexPool.get(pl)!] >= 0);
      const demandeGoulot = poolsGoulot.reduce((a, pl) => a + demandeParPool.get(pl)!.duree, 0);
      const unitesGoulot = unitesIds.filter((id) => niveauN[indexUnite.get(id)!] >= 0);
      const capGoulot = unitesGoulot.reduce((a, id) => a + capEff(id), 0);
      const libelles = poolsGoulot
        .map((pl) => demandeParPool.get(pl)!.label)
        .slice(0, 4)
        .join(", ");
      blocages.push(
        `Pas assez d'enseignants pour ${libelles}${poolsGoulot.length > 4 ? "…" : ""} : ${demandeGoulot} h à couvrir pour ${capGoulot} h disponibles au total (plafonds de service compris), soit un déficit de ${demandeGoulot - capGoulot} h — seuls ces enseignants peuvent assurer cette/ces spécialité(s) : ajoutez-y des enseignants ou relevez leur volume horaire dû.`,
      );
      const plafonneGoulot = unitesGoulot.some((id) => (p.capaciteServiceParUnite?.get(id) ?? Infinity) < capaciteUnite);
      if (plafonneGoulot && unitesGoulot.length > 0 && demandeGoulot <= unitesGoulot.length * capaciteUnite) {
        blocagesData.push({
          type: "service_enseignant",
          cycles: [...new Set(poolsGoulot.map((pl) => pl.slice(0, pl.indexOf(":"))))],
          poolLabel: libelles,
          demande: demandeGoulot,
          nbUnites: unitesGoulot.length,
          capPhysique: capaciteUnite,
        });
      } else {
        blocagesData.push({ type: "enseignants" });
      }
    } else {
      // Problème faisable au niveau agrégé : la répartition du flot devient le plan de
      // consommation des unités (le flot poussé sur l'arc aller est stocké sur l'arc retour).
      for (const { cle, ai } of arcsPoolUnite) {
        const pousse = arcs[ai ^ 1].cap;
        if (pousse > 0) quotaFlot.set(cle, pousse);
      }
    }
  }
  // Seules les unités MULTI-POOLS (bivalents, composantes de couples, couverture
  // inter-cycles) sont bridées par le plan de flot : une unité mono-pool ne peut cannibaliser
  // personne, sa capacité reste entièrement disponible pour son pool (le plan de Dinic
  // sature les unités dans un ordre arbitraire et rétrécirait la recherche pour rien).
  const unitesPartagees = new Set<string>();
  {
    const premierPool = new Map<string, string>();
    for (const u of p.enseignants) {
      if (!demandeParPool.has(u.pool)) continue;
      const prem = premierPool.get(u.id);
      if (prem === undefined) premierPool.set(u.id, u.pool);
      else if (prem !== u.pool) unitesPartagees.add(u.id);
    }
  }

  // Capacité par classe — fenêtre calculée JOUR PAR JOUR (la vacation peut varier :
  // journée entière le jour d'EPS, demi-journée les autres jours). Les blocs à vacation
  // PROPRE différente de celle de la classe (ex : EPS ISOLÉE dans la demi-journée opposée)
  // ne consomment pas la fenêtre « en salle » : ils en sont exclus (leur faisabilité est
  // couverte par le pré-contrôle des plages autorisées, ils sont épinglés à leur jour).
  const parClasse = new Map<string, { nom: string; blocs: BlocCours[] }>();
  for (const b of p.blocs) {
    const e = parClasse.get(b.classeId) ?? { nom: b.classeNom, blocs: [] };
    e.blocs.push(b);
    parClasse.set(b.classeId, e);
  }
  for (const [classeId, info] of parClasse) {
    // Référence = un bloc « libre » (la fenêtre normale de la classe), jamais un bloc épinglé.
    const ref = info.blocs.find((b) => !b.joursAutorises) ?? info.blocs[0];
    let duree = 0;
    for (const b of info.blocs) {
      if (b.vacationParJour && b.vacationParJour !== ref.vacationParJour) continue;
      duree += b.duree;
    }
    let dispo = 0;
    let dispoSansFermetures = 0; // même fenêtre, mais TOUTES les plages sans cours rouvertes
    for (let jour = 0; jour < p.joursOuvres; jour++) {
      const [deb, fin] = bornesPeriodes(p, groupeDe(ref, jour));
      for (let per = deb; per <= fin; per++) {
        dispoSansFermetures++;
        if (!estFerme(jour, per, 1, classeId)) dispo++; // hors plages sans cours (établissement + niveau)
      }
    }
    if (duree > dispo) {
      blocages.push(`${info.nom} : ${duree} créneaux à placer pour ${dispo} disponibles dans la semaine. Réduisez le volume horaire ou les plages sans cours.`);
      blocagesData.push({
        type: "classe_creneaux",
        classeId,
        classeNom: info.nom,
        requis: duree,
        disponibles: dispo,
        disponiblesSansFermetures: dispoSansFermetures,
      });
    }
  }

  for (const d of paData.values()) blocagesData.push(d);

  if (blocages.length > 0) {
    return {
      ok: false,
      placements: [],
      blocages,
      stats: { blocs: p.blocs.length, places: 0, etapes: 0 },
      blocagesData: blocagesData.length > 0 ? blocagesData : undefined,
    };
  }

  // ── Heuristique : blocs les plus contraints d'abord ──
  // La durée prime : un cours de 2 périodes n'a qu'une poignée de positions possibles par
  // jour (il ne peut pas traverser une pause), là où un cours d'1 période en a bien plus.
  // Puis la TENSION du pool d'enseignants (demande / offre) : les pools presque saturés
  // (aggravés par le jour de repos garanti) se placent en premier, grille encore vide.
  const tensionPool = new Map<string, number>();
  for (const [pool, info] of demandeParPool) {
    // Offre = capacité effective cumulée des unités (plafond de service inclus) : les pools
    // proches de la saturation à cause du volume horaire dû se placent en premier.
    const offre = (unitesParPool.get(pool) ?? []).reduce((a, u) => a + capEff(u.id), 0);
    tensionPool.set(pool, offre > 0 ? info.duree / offre : 1);
  }

  // Pool PRIORITAIRE d'une unité : parmi les pools où elle peut enseigner (ses disciplines de
  // bivalence, ses deux cycles…), celui où l'établissement est le plus DÉFICITAIRE (tension la
  // plus élevée). On affectera un bivalent en priorité à sa discipline la plus déficitaire.
  const poolsParUniteMap = new Map<string, string[]>();
  for (const u of p.enseignants) {
    const arr = poolsParUniteMap.get(u.id);
    if (arr) arr.push(u.pool);
    else poolsParUniteMap.set(u.id, [u.pool]);
  }
  const poolPrioritaire = new Map<string, string>();
  for (const [uid, pools] of poolsParUniteMap) {
    if (pools.length < 2) continue; // monovalent mono-cycle : pas d'arbitrage
    let best = pools[0];
    let bestT = tensionPool.get(pools[0]) ?? 0;
    for (const pl of pools) {
      const t = tensionPool.get(pl) ?? 0;
      if (t > bestT) {
        bestT = t;
        best = pl;
      }
    }
    poolPrioritaire.set(uid, best);
  }
  // Unités BRIDÉES par le plan de flot : uniquement celles partagées avec au moins un pool
  // TENDU — c'est là que la cannibalisation menace. Brider tout le monde amincirait la
  // première phase de candidats partout et doublerait les balayages sans bénéfice.
  const unitesBridees = new Set<string>();
  for (const u of p.enseignants) {
    if (!unitesPartagees.has(u.id)) continue;
    if ((tensionPool.get(u.pool) ?? 0) >= 0.8) unitesBridees.add(u.id);
  }
  // Contraintes d'enchaînement actives ? (déclaré AVANT l'ordre de parcours : il en dépend.)
  const contraintesAdjacence = !!(
    p.memeDisciplineNonConsecutive || p.litterairesNonConsecutifs || p.scientifiquesNonConsecutifs
  );
  // Rang d'une séance parmi celles de SA (classe, discipline) : avec les contraintes
  // d'enchaînement, on INTERCALE les disciplines (1re séance de chacune, puis 2e de chacune…)
  // au lieu de les grouper — chaque journée se remplit de disciplines variées et le
  // backtracking évite les impasses d'adjacence en cascade sur les grilles pleines.
  const rangBloc = new Map<string, number>();
  if (contraintesAdjacence) {
    const compte = new Map<string, number>();
    for (const b of p.blocs) {
      const k = `${b.classeId}:${b.disciplineId}`;
      const r = compte.get(k) ?? 0;
      rangBloc.set(b.id, r);
      compte.set(k, r + 1);
    }
  }
  const ordreGlobal = [...p.blocs].sort((a, b) => {
    if (b.duree !== a.duree) return b.duree - a.duree;
    // Blocs confinés à des plages autorisées (ex : EPS) : positions rares → en premier,
    // pendant que la grille est vide (sinon leurs fenêtres se remplissent d'autres cours).
    const fa = autoriseesParBloc.has(a.id) ? 0 : 1;
    const fb = autoriseesParBloc.has(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const ta = tensionPool.get(a.enseignantPool) ?? 0;
    const tb = tensionPool.get(b.enseignantPool) ?? 0;
    if (ta !== tb) return tb - ta;
    const ra = sallesCompatibles.get(a.id)!.length;
    const rb = sallesCompatibles.get(b.id)!.length;
    if (ra !== rb) return ra - rb;
    const na = unitesParPool.get(a.enseignantPool)!.length;
    const nb = unitesParPool.get(b.enseignantPool)!.length;
    if (na !== nb) return na - nb;
    if (contraintesAdjacence) {
      const ra = rangBloc.get(a.id) ?? 0;
      const rb = rangBloc.get(b.id) ?? 0;
      if (ra !== rb) return ra - rb; // intercalage des disciplines (voir rangBloc)
    }
    return (a.vacationGroupe !== null ? 0 : 1) - (b.vacationGroupe !== null ? 0 : 1);
  });

  // ── DÉCOMPOSITION PAR CLASSE ──────────────────────────────────────────────────────────────
  // Chaque classe est un sous-problème quasi indépendant (sa propre grille est souvent presque
  // pleine, surtout en double vacation), couplé aux autres par les enseignants et les salles —
  // qui, eux, ont du mou. Le backtracking CHRONOLOGIQUE global s'effondre sur les grands
  // établissements (un échec en 40e classe remonte pas à pas à travers 39 classes sans
  // rapport) : on résout donc CLASSE PAR CLASSE, comme un emploi du temps humain, avec
  // micro-redémarrages par classe, SAUTS ARRIÈRE bornés (défaire la classe précédente et la
  // permuter avec la classe bloquée) et redémarrages globaux qui mélangent l'ordre des classes.
  // L'ordre INTERNE des blocs d'une classe conserve les priorités du tri global ci-dessus.
  const blocsParClasse = new Map<string, typeof ordreGlobal>();
  for (const b of ordreGlobal) {
    const arr = blocsParClasse.get(b.classeId);
    if (arr) arr.push(b);
    else blocsParClasse.set(b.classeId, [b]);
  }
  // Étroitesse d'une classe = créneaux réellement disponibles − périodes demandées, corrigée
  // par la TENSION des pools d'enseignants qu'elle consomme : les classes serrées ET
  // gourmandes en pools déficitaires se placent en premier, grille encore vide.
  // Calculée sur les listes COMPLÈTES (avant extraction du pré-groupe) : elle sert d'ORDRE,
  // valable pour les deux décompositions (avec pré-groupe, et repli sans).
  const etroitesseClasse = new Map<string, number>();
  for (const [classeId, liste] of blocsParClasse) {
    const ref = liste[0];
    let dispo = 0;
    for (let jour = 0; jour < p.joursOuvres; jour++) {
      const [deb, fin] = bornesPeriodes(p, groupeDe(ref, jour));
      for (let per = deb; per <= fin; per++) if (!estFerme(jour, per, 1, classeId)) dispo++;
    }
    const demandeClasse = liste.reduce((a, b) => a + b.duree, 0);
    let tensionMax = 0;
    for (const b of liste) tensionMax = Math.max(tensionMax, tensionPool.get(b.enseignantPool) ?? 0);
    // Pondération FORTE de la tension : une classe qui consomme un pool quasi saturé doit se
    // servir la première, même si sa grille propre paraît large — sinon les dernières classes
    // trouvent le vivier à sec (constat réel : LV2 sur grands établissements).
    // Malus JOURNÉE ENTIÈRE : une classe hors double vacation concurrence les DEUX groupes
    // pour salles et enseignants — sa marge apparente (grande fenêtre) est illusoire ; placée
    // en dernier elle trouve tout occupé (constat réel : classes de 3ème à Issia).
    const journeeEntiere = ref.vacationGroupe === null ? 20 : 0;
    etroitesseClasse.set(classeId, dispo - demandeClasse - 40 * tensionMax - journeeEntiere);
  }
  // ── PRÉ-GROUPE des blocs à RESSOURCE RARE ──
  // EPS (plages horaires imposées) et disciplines à salle spécialisée quasi saturée : ces
  // blocs se disputent une structure étroite PARTAGÉE par toutes les classes — placés classe
  // par classe, les derniers arrivés trouvent la structure pleine (journal : EPS « ok=0 »).
  // Comme les ACE (plateaux d'EPS d'abord), ils sont TOUS placés en tête, grille vide, via un
  // groupe virtuel que promotions, sauts et redémarrages laissent en première position.
  // La décomposition SANS pré-groupe est conservée : si toutes les tentatives avec pré-groupe
  // échouent, un REPLI la rejoue sur le budget restant (contre-expertise : quelques instances
  // se pavent mieux à l'ancienne — le pré-groupe est un pari, jamais une impasse).
  const GROUPE_RARES = "#rares";
  const blocsParClasseComplet = new Map(blocsParClasse);
  let preGroupeActif = false;
  // MRV pertinent seulement quand le pré-groupe est dominé par des PLAGES imposées (EPS) :
  // pour une rareté de SALLES (labos), l'ordre global statique pave mieux (ablation mesurée).
  let raresDominesParPlages = false;
  {
    const demandeParType = new Map<string, number>();
    for (const b of p.blocs) {
      if (b.salleTypeRequis) demandeParType.set(b.salleTypeRequis, (demandeParType.get(b.salleTypeRequis) ?? 0) + b.duree);
    }
    const typeRare = (t: string | null | undefined): boolean => {
      if (!t || !p.appliquerTypeSalle) return false;
      const nb = p.salles.filter((s) => s.type === t).length;
      return nb > 0 && (demandeParType.get(t) ?? 0) >= 0.7 * nb * creneauxOuverts;
    };
    const estRare = (b: BlocCours): boolean => !!b.periodesAutorisees || typeRare(b.salleTypeRequis);
    const rares = ordreGlobal.filter(estRare);
    // Garde-fou : si « rare » couvrait la moitié du problème, le pré-groupe redeviendrait la
    // recherche globale d'antan (qui s'effondre) — on ne pré-place qu'une structure étroite.
    if (rares.length > 0 && rares.length < p.blocs.length / 2) {
      preGroupeActif = true;
      raresDominesParPlages = rares.filter((b) => b.periodesAutorisees).length * 2 >= rares.length;
      blocsParClasse.set(GROUPE_RARES, rares);
      for (const [cid, liste] of blocsParClasse) {
        if (cid === GROUPE_RARES) continue;
        const restant = liste.filter((b) => !estRare(b));
        // Classe dont TOUS les blocs sont rares : sa liste vidée disparaît (ses blocs vivent
        // dans le pré-groupe) — la garder ferait planter l'initialisation (liste[0] absent).
        if (restant.length === 0) blocsParClasse.delete(cid);
        else blocsParClasse.set(cid, restant);
      }
    }
  }
  // Le pré-groupe des blocs rares passe TOUJOURS en premier (structure partagée étroite).
  etroitesseClasse.set(GROUPE_RARES, Number.NEGATIVE_INFINITY);
  // Ordre de résolution = liste de GROUPES de classes : un segment par groupe (au départ,
  // une classe par groupe). Deux classes qui se renvoient la tête en boucle (ping-pong de
  // promotions) sont FUSIONNÉES dans un même groupe et co-résolues — l'entrelacement de
  // leurs blocs, impossible entre segments, redevient possible à l'intérieur du groupe.
  function initialiserOrdreClasses(): string[][] {
    return [...blocsParClasse.keys()]
      .sort((a, b) => (etroitesseClasse.get(a) ?? 0) - (etroitesseClasse.get(b) ?? 0))
      .map((classeId) => [classeId]);
  }
  let ordreClasses: string[][] = initialiserOrdreClasses();
  let ordre: typeof ordreGlobal = [];
  let bornesSegments: [number, number][] = [];
  // Rang de chaque bloc dans le tri global : les blocs d'un groupe FUSIONNÉ sont ENTRELACÉS
  // selon ce rang (durée, tension des pools…) — concaténer classe par classe ferait perdre
  // au segment co-résolu l'heuristique qui rend le pavage exact trouvable.
  const rangGlobal = new Map(ordreGlobal.map((b, i) => [b.id, i]));
  function reconstruireOrdre() {
    ordre = [];
    bornesSegments = [];
    for (const groupe of ordreClasses) {
      const debut = ordre.length;
      if (groupe.length === 1) {
        for (const b of blocsParClasse.get(groupe[0])!) ordre.push(b);
      } else {
        const blocs = groupe.flatMap((classeId) => blocsParClasse.get(classeId)!);
        blocs.sort((a, b) => (rangGlobal.get(a.id) ?? 0) - (rangGlobal.get(b.id) ?? 0));
        for (const b of blocs) ordre.push(b);
      }
      bornesSegments.push([debut, ordre.length]);
    }
  }
  reconstruireOrdre();

  // État de la tentative courante (réinitialisé à chaque redémarrage randomisé).
  let occT = new Set<string>(); // unitéEnseignant occupée
  let occC = new Set<string>(); // classe occupée
  let occR = new Set<string>(); // salle occupée
  // Occupation par SIGNATURE de salle (type:capacité) : compteur incrémental par créneau.
  // Les salles d'une même signature sont interchangeables — le balayage des positions teste
  // 2-5 signatures au lieu des ~70 salles une à une (point chaud mesuré au profileur).
  const sigParSalle = new Map<string, string>();
  const totalParSignature = new Map<string, number>();
  const sallesParSignature = new Map<string, SalleSolveur[]>();
  for (const s of p.salles) {
    const sig = `${s.type}:${s.capacite}`;
    sigParSalle.set(s.nom, sig);
    totalParSignature.set(sig, (totalParSignature.get(sig) ?? 0) + 1);
    const liste = sallesParSignature.get(sig) ?? [];
    liste.push(s);
    sallesParSignature.set(sig, liste);
  }
  let occSig = new Map<string, number>(); // `${sig}:${jour}:${periode}` → nb de salles occupées
  // Nombre de séances déjà posées par (classe, jour) — maintenu de façon INCRÉMENTALE pour
  // l'étalement, au lieu de rescanner tous les placements à chaque nœud (coût O(P) → O(1)).
  let sessCJ = new Map<string, Int32Array>();
  const compteJours = (classeId: string): Int32Array => {
    let a = sessCJ.get(classeId);
    if (!a) {
      a = new Int32Array(p.joursOuvres);
      sessCJ.set(classeId, a);
    }
    return a;
  };
  // Charge hebdomadaire courante par unité-enseignant (nb de périodes déjà posées) — pour ne
  // jamais dépasser le plafond de service (volume horaire dû). Réinitialisée à chaque tentative.
  const serviceMax = p.capaciteServiceParUnite;
  let chargeUnite = new Map<string, number>();
  // LIAISON pédagogique (et coup de massue combinatoire) : les séances d'une même
  // (classe, discipline) PRIVILÉGIENT la même unité-enseignant — le premier bloc de la
  // paire choisit l'unité, les suivants la suivent (phase 1) et ne se partagent qu'en
  // dernier recours (phase 2). C'est la réalité d'un emploi du temps (un professeur par
  // matière et par classe) et cela effondre le facteur de branchement.
  let uniteParPaire = new Map<string, string>();
  let posesParPaire = new Map<string, number>();
  // Quotas issus du plan de flot (voir pré-vérifications) : périodes restantes qu'une unité
  // devrait consacrer à chaque pool selon UNE répartition globalement faisable. Préférence
  // de tri, jamais contrainte dure. Réinitialisés à chaque tentative.
  let quotaRestant = new Map<string, number>();
  // Jour de repos garanti : attribution STATIQUE d'un jour de repos par unité, répartie
  // en tourniquet et décalée à chaque tentative. Le backtracking élague ainsi dès le
  // choix du jour, au lieu de découvrir l'impasse tardivement (explosion combinatoire).
  // Jour ENTIÈREMENT fermé (ex : mercredi libéré) : TOUT LE MONDE s'y repose — coût nul en
  // capacité, la contrainte est satisfaite gratuitement, et la borne des pré-tests (« le
  // repos peut toujours être posé sur le jour le moins ouvert ») devient exacte. Sans cela,
  // le tourniquet ne propose que NB_TENTATIVES décalages et peut ne JAMAIS essayer le jour
  // fermé pour un enseignant chargé — échec certain sur des instances faisables.
  let reposUnite = new Map<string, number>();
  const jourEntierementFerme = ouvertsParJour.findIndex((n) => n === 0);
  function assignerRepos(decalage: number) {
    reposUnite = new Map();
    let k = 0;
    for (const u of p.enseignants) {
      if (reposUnite.has(u.id)) continue;
      if (jourEntierementFerme >= 0) {
        reposUnite.set(u.id, jourEntierementFerme);
        continue;
      }
      reposUnite.set(u.id, (k + decalage) % p.joursOuvres);
      k++;
    }
  }
  // ── Contraintes supplémentaires d'ENCHAÎNEMENT (options du chef d'établissement) ──
  // Frontière matin/après-midi (pause déjeuner) : elle ROMPT la consécutivité des séances et
  // délimite les demi-journées de la contrainte « séance isolée » — mais UNIQUEMENT si elle
  // est RÉELLE, c.-à-d. si elle coïncide avec une frontière de pause déclarée. Sans pause
  // déjeuner exploitable (école du matin, horaires incomplets), le repli ceil(N/2) tombe au
  // milieu d'un bloc d'enseignement : l'utiliser exonérerait à tort deux séances dos à dos
  // et fabriquerait de fausses « séances isolées ». Dans ce cas, la journée est traitée
  // comme une seule demi-journée et rien ne rompt la consécutivité.
  const frontMA = p.frontiereMatinAprem ?? Math.floor(p.periodesParJour / 2);
  const finsDeBloc = new Set<number>();
  {
    let acc = 0;
    for (const n of p.blocsPeriodes ?? []) {
      acc += n;
      finsDeBloc.add(acc);
    }
  }
  const dejeunerReel =
    frontMA > 0 &&
    frontMA < p.periodesParJour &&
    (p.blocsPeriodes?.length ?? 0) >= 2 &&
    finsDeBloc.has(frontMA);
  const rompuParDejeuner = (perAvant: number, perApres: number): boolean =>
    dejeunerReel && perAvant < frontMA !== perApres < frontMA;
  // Discipline posée par (classe, jour, période) — miroir incrémental des placements du
  // backtracking, pour vérifier l'adjacence en O(1) à chaque candidat.
  let discCP = new Map<string, { disc: string; cat: string }>();
  // Demi-journée d'une période (0 = matin, 1 = après-midi) — journée entière = 0 sans
  // pause déjeuner réelle.
  const demiDe = (periode: number): number => (dejeunerReel && periode >= frontMA ? 1 : 0);
  // Nombre de SÉANCES posées par (classe, jour, demi-journée, discipline) — miroir
  // incrémental pour la contrainte « une séance par demi-journée » (uneSeanceParDemiJournee).
  let seancesDemiDisc = new Map<string, number>();
  const cleDemiDisc = (classeId: string, jour: number, periode: number, disc: string): string =>
    `${classeId}:${jour}:${demiDe(periode)}:${disc}`;
  /** Vérif par BALAYAGE (optimiseurs) : la discipline est-elle déjà posée dans cette demi-journée ? */
  function uneParDemiOkDansListe(liste: Placement[], exclu: Placement, disc: string, jour: number, periode: number): boolean {
    if (!p.uneSeanceParDemiJournee) return true;
    const demi = demiDe(periode);
    for (const pl of liste) {
      if (pl === exclu || pl.jour !== jour || pl.disciplineId !== disc) continue;
      if (demiDe(pl.periode) === demi) return false;
    }
    return true;
  }
  const catDeBloc = (b: BlocCours | undefined): string => b?.disciplineCategorie ?? "autre";
  /**
   * Deux séances adjacentes (perA juste avant perB) violent-elles une contrainte d'enchaînement DURE ?
   * NB : « littéraires/scientifiques consécutives » sont désormais des préférences SOUPLES (pénalité
   * qualité `enchainementCategorie`, cf. `penalitesBrutesClasse`) — elles ne rejettent plus un
   * placement (la génération n'est jamais bloquée par ces règles), l'optimisation les minimise.
   * Seule « même discipline consécutive » (si activée) reste une contrainte DURE ici.
   */
  function violeEnchainement(discA: string, _catA: string, discB: string, _catB: string, perA: number, perB: number): boolean {
    if (rompuParDejeuner(perA, perB)) return false;
    if (p.memeDisciplineNonConsecutive && discA === discB) return true;
    return false;
  }
  /** Enchaînement de CATÉGORIE souple violé (littéraires/scientifiques consécutifs) — pénalité qualité. */
  function violeCategorieSouple(catA: string, catB: string, perA: number, perB: number): boolean {
    if (rompuParDejeuner(perA, perB)) return false;
    if (p.litterairesNonConsecutifs && catA === "litteraire" && catB === "litteraire") return true;
    if (p.scientifiquesNonConsecutifs && catA === "scientifique" && catB === "scientifique") return true;
    return false;
  }
  /** Vérification O(1) du backtracking : voisins immédiats lus dans discCP. */
  function adjacenceOkIncremental(classeId: string, disc: string, cat: string, jour: number, periode: number, duree: number): boolean {
    const avant = discCP.get(`${classeId}:${jour}:${periode - 1}`);
    if (avant && violeEnchainement(avant.disc, avant.cat, disc, cat, periode - 1, periode)) return false;
    const apres = discCP.get(`${classeId}:${jour}:${periode + duree}`);
    if (apres && violeEnchainement(disc, cat, apres.disc, apres.cat, periode + duree - 1, periode + duree)) return false;
    return true;
  }
  /** Vérification par BALAYAGE (phases d'optimisation) — `exclu` = cours en cours de déplacement. */
  function adjacenceOkDansListe(liste: Placement[], exclu: Placement, disc: string, cat: string, jour: number, periode: number, duree: number): boolean {
    for (const pl of liste) {
      if (pl === exclu || pl.jour !== jour) continue;
      const finPl = pl.periode + pl.duree - 1;
      if (finPl === periode - 1 || pl.periode === periode + duree) {
        const catPl = catDeBloc(blocParId.get(pl.blocId));
        if (finPl === periode - 1 && violeEnchainement(pl.disciplineId, catPl, disc, cat, finPl, periode)) return false;
        if (pl.periode === periode + duree && violeEnchainement(disc, cat, pl.disciplineId, catPl, periode + duree - 1, pl.periode)) return false;
      }
    }
    return true;
  }

  let placements: Placement[] = [];
  let etapes = 0;
  let etapesTotal = 0;
  const debutMs = Date.now();
  const limiteMs = p.budgetMs ?? LIMITE_MS;
  let finTentativeMs = debutMs + limiteMs / NB_TENTATIVES;
  let abandonne = false; // limite d'étapes OU de temps atteinte → déroulage rapide de la pile
  // Budget d'étapes du SOUS-PROBLÈME (classe) en cours : dépassé → déroulage rapide de CE
  // segment seulement, la tentative continue (micro-redémarrage ou saut arrière).
  let segmentAbandonne = false;
  let limiteEtapesSegment = Infinity;
  let iMaxSegment = 0; // bloc le plus profond atteint dans le segment courant (diagnostic)
  // MRV (« fail-first ») actif dans le segment courant : à chaque nœud, le bloc au plus
  // petit nombre de positions restantes est placé d'abord. Réservé au pré-groupe des blocs
  // rares (pavage quasi saturé de la structure EPS/labos), où l'ordre statique s'effondre.
  let segmentMRV = false;
  // Décalage de DÉPARTAGE du MRV, changé à chaque tentative : sans lui, le MRV déterministe
  // reproduit le MÊME pavage rare à chaque essai — si ce pavage coince une classe en aval,
  // aucun redémarrage ne peut l'aider (mesuré sur Issia : 3 essais aux échecs identiques).
  let decalageMRV = 0;
  // Nombre de positions encore OUVERTES pour un bloc (classe, fermetures, pauses, plages,
  // et — pour les blocs à salle spécialisée — une salle du type encore libre via les
  // compteurs de signatures ; les enseignants restent hors du compte : éclaireur bon marché).
  function compterOptions(b: BlocCours): number {
    let n = 0;
    const compat = b.salleTypeRequis ? (sallesCompatibles.get(b.id) ?? []) : null;
    for (let jour = 0; jour < p.joursOuvres; jour++) {
      if (!joursPermis(b, jour)) continue;
      const [d1, f1] = bornesPeriodes(p, groupeDe(b, jour));
      positions: for (let per = d1; per + b.duree - 1 <= f1; per++) {
        if (!tientDansBloc(per, b.duree)) continue;
        if (estFerme(jour, per, b.duree, b.classeId)) continue;
        if (!periodesPermises(b.id, per, b.duree)) continue;
        for (let d = 0; d < b.duree; d++) {
          if (occC.has(`${b.classeId}:${jour}:${per + d}`)) continue positions;
        }
        if (compat) {
          // La rareté que ce segment pave est souvent LA salle spécialisée : une position
          // sans salle du type libre n'est pas une option (sans cela, le « fail-first »
          // serait aveugle à la vraie contrainte — contre-expertise, seed 1118).
          let salleOk = false;
          const sigsVues = new Set<string>();
          for (const sa of compat) {
            const sig = sigParSalle.get(sa.nom)!;
            if (sigsVues.has(sig)) continue;
            sigsVues.add(sig);
            let libreSig = true;
            for (let d = 0; d < b.duree; d++) {
              if ((occSig.get(`${sig}:${jour}:${per + d}`) ?? 0) >= (totalParSignature.get(sig) ?? 0)) {
                libreSig = false;
                break;
              }
            }
            if (libreSig) {
              salleOk = true;
              break;
            }
          }
          if (!salleOk) continue;
        }
        n++;
      }
    }
    return n;
  }
  // Ordres de parcours actifs (tentative 0 = déterministe, suivantes = mélangées).
  let sallesActives = sallesCompatibles;
  let unitesActives = unitesParPool;

  function creneauLibre(jour: number, periode: number, duree: number, classeId: string, salleNom: string, uniteId: string): boolean {
    // Plage sans cours (établissement, ou niveau de cette classe) : aucun placement possible.
    if (estFerme(jour, periode, duree, classeId)) return false;
    // Jour de repos garanti : l'unité est indisponible son jour de repos.
    if (p.reposEnseignant && reposUnite.get(uniteId) === jour) return false;
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
    const sig = sigParSalle.get(salleNom);
    const delta = set ? 1 : -1;
    for (let d = 0; d < duree; d++) {
      const pp = periode + d;
      occC[op](`${classeId}:${jour}:${pp}`);
      occR[op](`${salleNom}:${jour}:${pp}`);
      occT[op](`${uniteId}:${jour}:${pp}`);
      if (sig !== undefined) {
        const cleSig = `${sig}:${jour}:${pp}`;
        occSig.set(cleSig, (occSig.get(cleSig) ?? 0) + delta);
      }
    }
  }

  function placer(i: number, finSegment: number): boolean {
    if (i >= finSegment) return true;
    if (abandonne || segmentAbandonne) return false;
    if (++etapes > LIMITE_ETAPES || (etapes % 256 === 0 && Date.now() > finTentativeMs)) {
      abandonne = true;
      return false;
    }
    if (etapes > limiteEtapesSegment) {
      segmentAbandonne = true;
      return false;
    }
    if (i > iMaxSegment) iMaxSegment = i; // bloc le plus profond atteint (diagnostic)
    if (segmentMRV && i < finSegment - 1) {
      // Choix DYNAMIQUE du prochain bloc : celui qui a le moins de positions restantes
      // (fail-first). L'ordre peut différer d'une branche à l'autre — le backtracking reste
      // complet (toutes les valeurs du bloc choisi sont essayées à ce nœud). Le parcours
      // démarre à un DÉCALAGE propre à la tentative : les ÉGALITÉS se départagent autrement
      // d'un essai à l'autre, donc le pavage rare varie entre redémarrages.
      const portee = finSegment - i;
      let meilleur = i;
      let minOptions = Number.POSITIVE_INFINITY;
      for (let k = 0; k < portee; k++) {
        const j = i + ((k + decalageMRV) % portee);
        const options = compterOptions(ordre[j]);
        if (options < minOptions) {
          minOptions = options;
          meilleur = j;
          if (options <= 1) break; // 0 = échec immédiat, 1 = forcé — inutile de chercher mieux
        }
      }
      if (meilleur !== i) {
        const tmp = ordre[i];
        ordre[i] = ordre[meilleur];
        ordre[meilleur] = tmp;
      }
    }
    const bloc = ordre[i];
    const compat = sallesActives.get(bloc.id)!;
    const unitesBrut = unitesActives.get(bloc.enseignantPool)!;
    // Un professeur par matière et par classe : PRÉFÉRENCE FORTE, pas contrainte absolue.
    // L'unité déjà liée à la paire (classe, discipline) est balayée sur TOUTES les positions
    // d'abord (phase 1) ; les autres unités n'interviennent qu'en dernier recours (phase 2 —
    // partage de la paire, co-enseignement) : une liaison dure ferait échouer des instances
    // faisables (une répartition 3+2 entre deux enseignants existe) avec un message trompeur.
    const clePaire = `${bloc.classeId}:${bloc.disciplineId}`;
    const uniteLiee = uniteParPaire.get(clePaire);
    // Sur un pool TENDU, empaquetage best-fit (reliquat de plafond le plus juste d'abord :
    // les grands creux restent disponibles pour les grandes paires à venir) ; sinon,
    // équilibrage classique (l'unité la moins chargée d'abord).
    const capRestant = (u: (typeof unitesBrut)[number]): number => {
      const cap = serviceMax?.get(u.id);
      return cap === undefined ? Number.POSITIVE_INFINITY : cap - (chargeUnite.get(u.id) ?? 0);
    };
    const poolTendu = (tensionPool.get(bloc.enseignantPool) ?? 0) >= 0.8;
    // Plan de flot : une unité non bridée est toujours « dans le plan » pour son pool ; une
    // unité bridée (partagée avec un pool tendu) ne l'est que tant que son quota pour CE
    // pool n'est pas épuisé.
    const quotaOk = (u: (typeof unitesBrut)[number]): boolean =>
      !unitesBridees.has(u.id) || (quotaRestant.get(`${bloc.enseignantPool}|${u.id}`) ?? 0) >= bloc.duree;
    const trier = (liste: typeof unitesBrut): typeof unitesBrut =>
      liste.length > 1
        ? [...liste].sort((a, b) => {
            // Plan de flot d'abord : une unité PARTAGÉE dont le quota pour ce pool est encore
            // ouvert passe avant celles que le plan réserve à d'autres pools — sinon un pool
            // consomme les bivalents partagés et affame un pool voisin à ajustement exact.
            const qa = quotaOk(a) ? 0 : 1;
            const qb = quotaOk(b) ? 0 : 1;
            if (qa !== qb) return qa - qb;
            // Priorité douce : un bivalent est réservé à sa discipline la plus déficitaire ; sur
            // sa discipline abondante il passe APRÈS les autres (0 = ce pool est le sien prioritaire
            // OU l'unité n'a pas d'arbitrage ; 1 = l'unité serait plus utile ailleurs).
            const pa = poolPrioritaire.has(a.id) && poolPrioritaire.get(a.id) !== bloc.enseignantPool ? 1 : 0;
            const pb = poolPrioritaire.has(b.id) && poolPrioritaire.get(b.id) !== bloc.enseignantPool ? 1 : 0;
            if (pa !== pb) return pa - pb;
            if (poolTendu) {
              // Best-fit : le reliquat post-paire le plus PETIT d'abord (rien de gâché).
              return capRestant(a) - capRestant(b);
            }
            // Équilibrage de la charge : l'unité la moins chargée d'abord.
            return (chargeUnite.get(a.id) ?? 0) - (chargeUnite.get(b.id) ?? 0);
          })
        : liste;
    let phases: (typeof unitesBrut)[];
    if (uniteLiee !== undefined) {
      phases = [unitesBrut.filter((u) => u.id === uniteLiee), trier(unitesBrut.filter((u) => u.id !== uniteLiee))];
    } else {
      // Le PLAN DE FLOT sépare les phases : une unité partagée que le plan réserve à
      // d'autres pools (quota épuisé ici) n'est essayée qu'après échec de TOUTES les
      // positions avec les unités du plan — un simple tri par position ne suffit pas : dès
      // que les unités du plan sont occupées sur UN créneau, le pool voisin se ferait
      // cannibaliser. En revanche, PAS de phase « capable d'absorber la paire entière » :
      // elle mettait un bivalent à grand plafond SEUL en tête, il monopolisait la paire et
      // affamait le pool voisin (contre-expertise : instances faisables rejetées) — le
      // partage naît naturellement de l'épuisement des plafonds, bloc par bloc.
      phases = [trier(unitesBrut.filter(quotaOk)), trier(unitesBrut.filter((u) => !quotaOk(u)))];
    }

    // Étalement (souple) : jours où la classe a le moins de séances d'abord (compteur incrémental).
    const sessionsJour = compteJours(bloc.classeId);
    let jours = [...Array(p.joursOuvres).keys()].sort((x, y) => sessionsJour[x] - sessionsJour[y]);
    if (p.memeDisciplineNonConsecutive) {
      // Avec la contrainte « même discipline non consécutive », essayer EN DERNIER les jours
      // où la discipline est déjà posée : beaucoup moins d'impasses d'adjacence (les grilles
      // presque pleines restent résolubles dans le budget), et meilleure répartition.
      const dejaCeJour = (jour: number): number => {
        for (let per = 0; per < p.periodesParJour; per++) {
          if (discCP.get(`${bloc.classeId}:${jour}:${per}`)?.disc === bloc.disciplineId) return 1;
        }
        return 0;
      };
      jours = jours
        .map((j) => ({ j, d: dejaCeJour(j) }))
        .sort((a, b) => a.d - b.d || sessionsJour[a.j] - sessionsJour[b.j])
        .map((m) => m.j);
    }

    // Phase 1 : unité préférée balayée sur TOUTES les positions ; phase 2 : les autres.
    for (const unites of phases) {
      if (unites.length === 0) continue;
      for (const jour of jours) {
        if (abandonne || segmentAbandonne) return false;
        if (!joursPermis(bloc, jour)) continue; // cours fixé à des jours précis (ex : jour d'EPS)
        const [deb, fin] = bornesPeriodes(p, groupeDe(bloc, jour));
        bouclePeriodes: for (let periode = deb; periode + bloc.duree - 1 <= fin; periode++) {
          if (!tientDansBloc(periode, bloc.duree)) continue; // ne pas traverser une pause
          if (estFerme(jour, periode, bloc.duree, bloc.classeId)) continue; // plage sans cours (établissement + niveau)
          if (!periodesPermises(bloc.id, periode, bloc.duree)) continue; // plages autorisées (ex : EPS)
          // Classe libre ? (indépendant de la salle et de l'enseignant — vérifié UNE fois)
          for (let d = 0; d < bloc.duree; d++) {
            if (occC.has(`${bloc.classeId}:${jour}:${periode + d}`)) continue bouclePeriodes;
          }
          // Contraintes d'enchaînement (dures) : les voisins immédiats de la classe ce jour-là
          // ne doivent pas violer « même discipline / littéraires / scientifiques consécutives ».
          if (contraintesAdjacence && !adjacenceOkIncremental(bloc.classeId, bloc.disciplineId, catDeBloc(bloc), jour, periode, bloc.duree)) {
            continue;
          }
          // Une séance par demi-journée et par discipline (dure) : la discipline ne doit pas
          // déjà être posée dans cette demi-journée pour cette classe.
          if (p.uneSeanceParDemiJournee && (seancesDemiDisc.get(cleDemiDisc(bloc.classeId, jour, periode, bloc.disciplineId)) ?? 0) >= 1) {
            continue;
          }
          // Cassage de symétrie EXACT : les salles de même signature (type, capacité) sont
          // interchangeables — une seule salle LIBRE par signature suffit comme candidate.
          // Le compteur occSig écarte les signatures saturées d'un seul coup d'œil ; la
          // recherche salle par salle ne court que dans une signature garantie non pleine.
          // ⚠ SALLE ATTITRÉE : l'interchangeabilité ne s'applique PAS — la classe doit rester
          // dans SA salle, on ne teste qu'elle (jamais une jumelle de même signature).
          const sallesCandidates: SalleSolveur[] = [];
          if (bloc.salleImposee) {
            const sa = compat[0];
            if (sa) {
              let libre = true;
              for (let d = 0; d < bloc.duree; d++) {
                if (occR.has(`${sa.nom}:${jour}:${periode + d}`)) {
                  libre = false;
                  break;
                }
              }
              if (libre) sallesCandidates.push(sa);
            }
            // SOUPLE : quand la salle attitrée est occupée (typiquement les jours à séance unique où
            // toutes les classes affluent en même temps), on se replie sur une AUTRE salle compatible
            // libre au lieu de rester bloqué sur la seule salle attitrée — c'est ce repli qui rend le
            // parc de salles réellement « tournant » et permet au solveur de converger. En DURE, la
            // classe reste strictement dans sa salle (aucun repli).
            if (sallesCandidates.length === 0 && p.salleImposeeSouple) {
              for (let i = 1; i < compat.length; i++) {
                const salle = compat[i];
                let libre = true;
                for (let d = 0; d < bloc.duree; d++) {
                  if (occR.has(`${salle.nom}:${jour}:${periode + d}`)) {
                    libre = false;
                    break;
                  }
                }
                if (libre) {
                  sallesCandidates.push(salle);
                  break;
                }
              }
            }
            if (sallesCandidates.length === 0) continue;
          } else {
          const signaturesVues = new Set<string>();
          for (const salle of compat) {
            const sig = sigParSalle.get(salle.nom)!;
            if (signaturesVues.has(sig)) continue;
            signaturesVues.add(sig);
            let place = true;
            for (let d = 0; d < bloc.duree; d++) {
              if ((occSig.get(`${sig}:${jour}:${periode + d}`) ?? 0) >= totalParSignature.get(sig)!) {
                place = false;
                break;
              }
            }
            if (!place) continue;
            for (const s2 of sallesParSignature.get(sig)!) {
              let libre = true;
              for (let d = 0; d < bloc.duree; d++) {
                if (occR.has(`${s2.nom}:${jour}:${periode + d}`)) {
                  libre = false;
                  break;
                }
              }
              if (libre) {
                sallesCandidates.push(s2);
                break;
              }
            }
          }
          if (sallesCandidates.length === 0) continue;
          }
          for (const unite of unites) {
            if (abandonne || segmentAbandonne) return false;
            // Unité disponible ? (jour de repos + occupation — indépendant de la salle)
            if (p.reposEnseignant && reposUnite.get(unite.id) === jour) continue;
            // Plafond de service hebdomadaire (volume horaire dû) : ne pas dépasser.
            if (serviceMax) {
              const capU = serviceMax.get(unite.id);
              if (capU !== undefined && (chargeUnite.get(unite.id) ?? 0) + bloc.duree > capU) continue;
            }
            let uniteLibre = true;
            for (let d = 0; d < bloc.duree; d++) {
              if (occT.has(`${unite.id}:${jour}:${periode + d}`)) {
                uniteLibre = false;
                break;
              }
            }
            if (!uniteLibre) continue;
            for (const salle of sallesCandidates) {
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
              sessionsJour[jour]++; // étalement incrémental (miroir du placements.push)
              chargeUnite.set(unite.id, (chargeUnite.get(unite.id) ?? 0) + bloc.duree); // charge (cap + équilibrage)
              const cleQuota = `${bloc.enseignantPool}|${unite.id}`;
              quotaRestant.set(cleQuota, (quotaRestant.get(cleQuota) ?? 0) - bloc.duree); // plan de flot
              // Liaison (classe, discipline) → unité : posée au PREMIER bloc de la paire.
              // Préférence seulement : les blocs suivants la privilégient (phase 1) mais
              // peuvent être portés par une autre unité (phase 2, partage).
              const dejaPosePaire = posesParPaire.get(clePaire) ?? 0;
              posesParPaire.set(clePaire, dejaPosePaire + bloc.duree);
              if (dejaPosePaire === 0) uniteParPaire.set(clePaire, unite.id);
              if (contraintesAdjacence) {
                for (let d = 0; d < bloc.duree; d++) {
                  discCP.set(`${bloc.classeId}:${jour}:${periode + d}`, { disc: bloc.disciplineId, cat: catDeBloc(bloc) });
                }
              }
              if (p.uneSeanceParDemiJournee) {
                const cle = cleDemiDisc(bloc.classeId, jour, periode, bloc.disciplineId);
                seancesDemiDisc.set(cle, (seancesDemiDisc.get(cle) ?? 0) + 1);
              }
              if (placer(i + 1, finSegment)) return true;
              if (p.uneSeanceParDemiJournee) {
                const cle = cleDemiDisc(bloc.classeId, jour, periode, bloc.disciplineId);
                seancesDemiDisc.set(cle, (seancesDemiDisc.get(cle) ?? 0) - 1);
              }
              if (contraintesAdjacence) {
                for (let d = 0; d < bloc.duree; d++) discCP.delete(`${bloc.classeId}:${jour}:${periode + d}`);
              }
              const restePaire = (posesParPaire.get(clePaire) ?? bloc.duree) - bloc.duree;
              posesParPaire.set(clePaire, restePaire);
              if (restePaire === 0) uniteParPaire.delete(clePaire);
              quotaRestant.set(cleQuota, (quotaRestant.get(cleQuota) ?? 0) + bloc.duree);
              chargeUnite.set(unite.id, (chargeUnite.get(unite.id) ?? 0) - bloc.duree);
              sessionsJour[jour]--;
              placements.pop();
              basculer(jour, periode, bloc.duree, bloc.classeId, salle.nom, unite.id, false);
            }
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
      const periodeCat = new Map<number, string>(); // catégorie littéraire/scientifique/autre par période
      let min = Infinity;
      let max = -Infinity;
      let milieuOccupe = false;
      for (const pl of liste) {
        const cat = catDeBloc(blocParId.get(pl.blocId));
        for (let d = 0; d < pl.duree; d++) {
          const per = pl.periode + d;
          periodeDisc.set(per, pl.disciplineId);
          periodeCat.set(per, cat);
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
        // Préférence SOUPLE : deux disciplines de MÊME catégorie (littéraire/scientifique) adjacentes.
        const catCur = periodeCat.get(per);
        const catPrev = periodeCat.get(per - 1);
        if (
          cur != null && prev != null && cur !== prev && catCur && catPrev &&
          violeCategorieSouple(catPrev, catCur, per - 1, per)
        ) {
          pen.enchainementCategorie = (pen.enchainementCategorie ?? 0) + 1;
        }
      }
      // Préférence SOUPLE (Français collège) : deux séances de français le MÊME jour devraient être
      // ISOLÉES — séparées par une autre discipline, de PRÉFÉRENCE scientifique. Consécutives → +2 ;
      // séparées mais SANS discipline scientifique entre elles → +1 ; une scientifique entre → 0.
      const frSeances = liste
        .filter((pl) => blocParId.get(pl.blocId)?.francaisCollege)
        .map((pl) => ({ start: pl.periode, end: pl.periode + pl.duree - 1 }))
        .sort((a, b) => a.start - b.start);
      for (let i = 1; i < frSeances.length; i++) {
        const a = frSeances[i - 1];
        const b = frSeances[i];
        if (b.start <= a.end + 1) {
          pen.francaisNonIsole = (pen.francaisNonIsole ?? 0) + 2;
          continue;
        }
        let scientifiqueEntre = false;
        for (let per = a.end + 1; per < b.start; per++) {
          if (periodeCat.get(per) === "scientifique") {
            scientifiqueEntre = true;
            break;
          }
        }
        if (!scientifiqueEntre) pen.francaisNonIsole = (pen.francaisNonIsole ?? 0) + 1;
      }
      if (milieuOccupe) pen.pauseMidi += 1;
    }
    const cnt = new Map<string, number>();
    for (const pl of pls) {
      const k = `${pl.jour}:${pl.disciplineId}`;
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
    for (const c of cnt.values()) if (c > 1) pen.repartition += c - 1;
    // Option : ne pas TERMINER deux jours consécutifs par la même discipline (classe).
    if (p.eviterFinJourneeRepetee) pen.finsJourneesRepetees = finsRepeteesDe(pls);
    return pen;
  }

  // Paires de jours CONSÉCUTIFS où la classe finit par la même discipline (dernière période
  // occupée de chaque jour) — option eviterFinJourneeRepetee.
  function finsRepeteesDe(pls: Placement[]): number {
    const fins = new Map<number, { per: number; disc: string }>();
    for (const pl of pls) {
      const fin = pl.periode + pl.duree - 1;
      const e = fins.get(pl.jour);
      if (!e || fin > e.per) fins.set(pl.jour, { per: fin, disc: pl.disciplineId });
    }
    let n = 0;
    for (let jour = 1; jour < p.joursOuvres; jour++) {
      const a = fins.get(jour - 1);
      const b = fins.get(jour);
      if (a && b && a.disc === b.disc) n++;
    }
    return n;
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

  function grouperParEnseignant(): Map<string, Placement[]> {
    const m = new Map<string, Placement[]>();
    for (const pl of placements) {
      const arr = m.get(pl.enseignantId);
      if (arr) arr.push(pl);
      else m.set(pl.enseignantId, [pl]);
    }
    return m;
  }

  // Heures creuses DISPERSÉES d'un enseignant : par jour, trous entre sa première et sa
  // dernière période. Les minimiser regroupe ses cours — et donc ses heures libres — sur
  // une demi-journée (matinée ou après-midi) plutôt qu'en pointillés.
  function trousEnseignant(pls: Placement[]): number {
    const parJour = new Map<number, { min: number; max: number; occupe: number }>();
    for (const pl of pls) {
      const e = parJour.get(pl.jour) ?? { min: Infinity, max: -Infinity, occupe: 0 };
      if (pl.periode < e.min) e.min = pl.periode;
      if (pl.periode + pl.duree - 1 > e.max) e.max = pl.periode + pl.duree - 1;
      e.occupe += pl.duree;
      parJour.set(pl.jour, e);
    }
    let tot = 0;
    for (const e of parJour.values()) tot += Math.max(0, e.max - e.min + 1 - e.occupe);
    return tot;
  }

  // Séances ISOLÉES d'un enseignant : demi-journées (matin / après-midi) où il n'a qu'UNE
  // séance — il se déplacerait pour un seul cours (option eviterSeanceIsoleeEnseignant).
  // Sans pause déjeuner réelle, la journée entière compte comme UNE demi-journée.
  function seancesIsoleesDe(pls: Placement[]): number {
    const parDemi = new Map<number, number>();
    for (const pl of pls) {
      const cle = dejeunerReel ? pl.jour * 2 + (pl.periode < frontMA ? 0 : 1) : pl.jour;
      parDemi.set(cle, (parDemi.get(cle) ?? 0) + 1);
    }
    let n = 0;
    for (const c of parDemi.values()) if (c === 1) n++;
    return n;
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
      if (c.finsJourneesRepetees) {
        tot.finsJourneesRepetees = (tot.finsJourneesRepetees ?? 0) + c.finsJourneesRepetees;
      }
      if (c.enchainementCategorie) {
        tot.enchainementCategorie = (tot.enchainementCategorie ?? 0) + c.enchainementCategorie;
      }
      if (c.francaisNonIsole) {
        tot.francaisNonIsole = (tot.francaisNonIsole ?? 0) + c.francaisNonIsole;
      }
    }
    if (p.optimiserEnseignants) {
      let te = 0;
      for (const pls of grouperParEnseignant().values()) te += trousEnseignant(pls);
      tot.trousEnseignants = te;
    }
    if (p.eviterSeanceIsoleeEnseignant) {
      let si = 0;
      for (const pls of grouperParEnseignant().values()) si += seancesIsoleesDe(pls);
      tot.seancesIsoleesEnseignants = si;
    }
    return tot;
  }

  function poids(pen: PenalitesSouples): number {
    // Heures creuses des élèves autorisées (choix du chef) : les trous des classes ne
    // pèsent plus — l'emploi du temps peut respirer.
    const poidsTrous = p.autoriserHeuresCreusesEleves ? 0 : 3;
    return (
      pen.trous * poidsTrous +
      pen.repartition * 2 +
      pen.consecutives * 2 +
      pen.finJournee * 1 +
      pen.pauseMidi * 1 +
      (pen.trousEnseignants ?? 0) * 2 +
      // Poids fort : se déplacer pour une seule séance est la gêne maximale d'un enseignant.
      (pen.seancesIsoleesEnseignants ?? 0) * 6 +
      // Fins de journée répétées (option) : plus lourd que « fin de journée » simple.
      (pen.finsJourneesRepetees ?? 0) * 3 +
      // Enchaînement de même catégorie (littéraires/scientifiques) : préférence forte mais SOUPLE.
      (pen.enchainementCategorie ?? 0) * 4 +
      // Français (collège) mal isolé le même jour : préférence SOUPLE.
      (pen.francaisNonIsole ?? 0) * 3
    );
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
    const parEnseignant =
      p.optimiserEnseignants || p.eviterSeanceIsoleeEnseignant ? grouperParEnseignant() : null;
    let budget = 1_500_000;
    // Borne TEMPS RÉEL en plus du budget d'étapes : sur un vCPU lent, une optimisation non
    // bornée pourrait manger la marge jusqu'au couperet d'exécution de la plateforme
    // (recherche longue + optimisation + écritures) — l'optimisation est un bonus, jamais
    // au prix de la persistance du résultat.
    const finOptimisationMs = Date.now() + 20_000;
    for (let pass = 0; pass < 4; pass++) {
      if (Date.now() > finOptimisationMs) break;
      let ameliore = false;
      for (const pl of placements) {
        if ((budget & 1023) === 0 && Date.now() > finOptimisationMs) break;
        const cls = parClasse.get(pl.classeId)!;
        const ens = parEnseignant?.get(pl.enseignantId) ?? null;
        const blocPl = blocParId.get(pl.blocId);
        // Pénalité combinée : la classe du cours + (options) heures creuses et séances
        // isolées de SON enseignant.
        const mesure = () =>
          penaliteClasse(cls) +
          (ens
            ? (p.optimiserEnseignants ? trousEnseignant(ens) * 2 : 0) +
              (p.eviterSeanceIsoleeEnseignant ? seancesIsoleesDe(ens) * 6 : 0)
            : 0);
        const avant = mesure();
        const oj = pl.jour;
        const op = pl.periode;
        basculer(oj, op, pl.duree, pl.classeId, pl.salleNom, pl.enseignantId, false);
        let bj = oj;
        let bp = op;
        let best = avant;
        for (let jour = 0; jour < p.joursOuvres && budget > 0; jour++) {
          if (blocPl && !joursPermis(blocPl, jour)) continue; // jours fixés (ex : jour d'EPS)
          const [deb, fin] = bornesPeriodes(p, blocPl ? groupeDe(blocPl, jour) : null);
          for (let per = deb; per + pl.duree - 1 <= fin; per++) {
            if (jour === oj && per === op) continue;
            if (!tientDansBloc(per, pl.duree)) continue; // ne pas traverser une pause
            if (!periodesPermises(pl.blocId, per, pl.duree)) continue; // plages autorisées (ex : EPS)
            if (--budget <= 0) break;
            if (!creneauLibre(jour, per, pl.duree, pl.classeId, pl.salleNom, pl.enseignantId)) continue;
            // Contraintes d'enchaînement (dures) : la nouvelle place doit rester licite.
            if (contraintesAdjacence && !adjacenceOkDansListe(cls, pl, pl.disciplineId, catDeBloc(blocPl), jour, per, pl.duree)) continue;
            // Une séance par demi-journée et par discipline (dure) — idem.
            if (!uneParDemiOkDansListe(cls, pl, pl.disciplineId, jour, per)) continue;
            pl.jour = jour;
            pl.periode = per;
            const pen = mesure();
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
    const parEnseignant =
      p.optimiserEnseignants || p.eviterSeanceIsoleeEnseignant ? grouperParEnseignant() : null;
    const W = 30;
    const stride = Math.max(1, Math.floor(n / W));
    let budget = 300_000;
    // Même borne temps réel que optimiserDeplacements (l'optimisation est un bonus).
    const finOptimisationMs = Date.now() + 10_000;
    for (let pass = 0; pass < 2 && budget > 0; pass++) {
      if (Date.now() > finOptimisationMs) break;
      let ameliore = false;
      for (let a = 0; a < n && budget > 0; a++) {
        if ((a & 255) === 0 && Date.now() > finOptimisationMs) break;
        const pl1 = placements[a];
        for (let k = 1; k <= W; k++) {
          if (--budget <= 0) break;
          const pl2 = placements[(a + k * stride) % n];
          if (pl2 === pl1 || pl1.classeId === pl2.classeId || pl1.duree !== pl2.duree) continue;
          if (pl1.jour === pl2.jour && pl1.periode === pl2.periode) continue;
          const b1 = blocParId.get(pl1.blocId);
          const b2 = blocParId.get(pl2.blocId);
          // Chacun doit rester sur un jour permis et dans SA fenêtre de vacation du jour cible.
          if (b1 && !joursPermis(b1, pl2.jour)) continue;
          if (b2 && !joursPermis(b2, pl1.jour)) continue;
          const [d1, f1] = bornesPeriodes(p, b1 ? groupeDe(b1, pl2.jour) : null);
          const [d2, f2] = bornesPeriodes(p, b2 ? groupeDe(b2, pl1.jour) : null);
          if (pl2.periode < d1 || pl2.periode + pl1.duree - 1 > f1) continue;
          if (pl1.periode < d2 || pl1.periode + pl2.duree - 1 > f2) continue;
          // Ni l'un ni l'autre ne doit traverser une pause à sa nouvelle place.
          if (!tientDansBloc(pl2.periode, pl1.duree) || !tientDansBloc(pl1.periode, pl2.duree)) continue;
          // Chacun doit rester dans SES plages autorisées (ex : EPS) à sa nouvelle place.
          if (!periodesPermises(pl1.blocId, pl2.periode, pl1.duree)) continue;
          if (!periodesPermises(pl2.blocId, pl1.periode, pl2.duree)) continue;
          const cls1 = parClasse.get(pl1.classeId)!;
          const cls2 = parClasse.get(pl2.classeId)!;
          // Contraintes d'enchaînement (dures) : chaque cours doit rester licite à sa
          // NOUVELLE place (classes différentes garanties → vérifications indépendantes).
          if (contraintesAdjacence) {
            if (!adjacenceOkDansListe(cls1, pl1, pl1.disciplineId, catDeBloc(b1), pl2.jour, pl2.periode, pl1.duree)) continue;
            if (!adjacenceOkDansListe(cls2, pl2, pl2.disciplineId, catDeBloc(b2), pl1.jour, pl1.periode, pl2.duree)) continue;
          }
          // Une séance par demi-journée et par discipline (dure) — idem aux deux places.
          if (!uneParDemiOkDansListe(cls1, pl1, pl1.disciplineId, pl2.jour, pl2.periode)) continue;
          if (!uneParDemiOkDansListe(cls2, pl2, pl2.disciplineId, pl1.jour, pl1.periode)) continue;
          // Pénalité combinée : les deux classes + (options) les enseignants concernés.
          const ensIds = parEnseignant ? [...new Set([pl1.enseignantId, pl2.enseignantId])] : [];
          const penEns = () =>
            ensIds.reduce(
              (acc, id) =>
                acc +
                (p.optimiserEnseignants ? trousEnseignant(parEnseignant!.get(id)!) * 2 : 0) +
                (p.eviterSeanceIsoleeEnseignant ? seancesIsoleesDe(parEnseignant!.get(id)!) * 6 : 0),
              0,
            );
          const avant = penaliteClasse(cls1) + penaliteClasse(cls2) + penEns();
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
          const apres = penaliteClasse(cls1) + penaliteClasse(cls2) + penEns();
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

  // ── Pilote d'une tentative : résolution CLASSE PAR CLASSE avec sauts arrière bornés ──
  // Défait proprement tous les placements au-delà de `n` (miroir exact des mises à jour
  // incrémentales du placement) : sert aux sauts arrière entre classes.
  function defaireJusqua(n: number) {
    while (placements.length > n) {
      const pl = placements.pop()!;
      basculer(pl.jour, pl.periode, pl.duree, pl.classeId, pl.salleNom, pl.enseignantId, false);
      compteJours(pl.classeId)[pl.jour]--;
      chargeUnite.set(pl.enseignantId, (chargeUnite.get(pl.enseignantId) ?? 0) - pl.duree);
      const cleQuota = `${blocParId.get(pl.blocId)!.enseignantPool}|${pl.enseignantId}`;
      quotaRestant.set(cleQuota, (quotaRestant.get(cleQuota) ?? 0) + pl.duree);
      if (contraintesAdjacence) {
        for (let d = 0; d < pl.duree; d++) discCP.delete(`${pl.classeId}:${pl.jour}:${pl.periode + d}`);
      }
      if (p.uneSeanceParDemiJournee) {
        const cle = cleDemiDisc(pl.classeId, pl.jour, pl.periode, pl.disciplineId);
        seancesDemiDisc.set(cle, (seancesDemiDisc.get(cle) ?? 0) - 1);
      }
      // Liaison (classe, discipline) → unité : levée quand plus aucun bloc de la paire n'est posé.
      const clePaire = `${pl.classeId}:${pl.disciplineId}`;
      const restePaire = (posesParPaire.get(clePaire) ?? pl.duree) - pl.duree;
      posesParPaire.set(clePaire, restePaire);
      if (restePaire === 0) uniteParPaire.delete(clePaire);
    }
  }

  // Premier bloc de la DERNIÈRE classe restée en échec (message de blocage lisible).
  let echecClasse: (typeof ordreGlobal)[number] | null = null;
  // Difficulté apprise par classe (cumul des échecs, TOUTES tentatives confondues) : les
  // redémarrages placent les classes les plus difficiles en tête au lieu de repartir au hasard.
  const difficulteClasse = new Map<string, number>();
  // Journal de recherche (diagnostic) : une ligne par échec de classe — quelle classe, combien
  // de créneaux encore libres face à sa demande, et les pools d'enseignants au reliquat juste.
  const journal: string[] = [];
  const libellePool = new Map<string, string>();
  for (const b of p.blocs) if (!libellePool.has(b.enseignantPool)) libellePool.set(b.enseignantPool, b.poolLabel ?? b.enseignantPool);
  function diagnostiqueSegment(essai: number, s: number, deb: number, fin: number, action: string) {
    if (journal.length >= 120) return;
    const ref = ordre[deb];
    let libres = 0;
    for (let jour = 0; jour < p.joursOuvres; jour++) {
      const [d1, f1] = bornesPeriodes(p, groupeDe(ref, jour));
      for (let per = d1; per <= f1; per++) {
        if (!estFerme(jour, per, 1, ref.classeId) && !occC.has(`${ref.classeId}:${jour}:${per}`)) libres++;
      }
    }
    let demandeSeg = 0;
    const parPool = new Map<string, number>();
    for (let k = deb; k < fin; k++) {
      demandeSeg += ordre[k].duree;
      parPool.set(ordre[k].enseignantPool, (parPool.get(ordre[k].enseignantPool) ?? 0) + ordre[k].duree);
    }
    const justes: string[] = [];
    for (const [pool, dem] of parPool) {
      const unites = unitesParPool.get(pool) ?? [];
      const reste = unites.reduce((a, u) => {
        const cap = serviceMax?.get(u.id);
        return a + (cap === undefined ? 99 : Math.max(0, cap - (chargeUnite.get(u.id) ?? 0)));
      }, 0);
      // Reliquat individuel : la liaison PRIVILÉGIE une unité par paire — le plus grand
      // reliquat d'un seul enseignant aide à lire les blocages de paires non partageables.
      const maxIndiv = unites.reduce((a, u) => {
        const cap = serviceMax?.get(u.id);
        return Math.max(a, cap === undefined ? 99 : cap - (chargeUnite.get(u.id) ?? 0));
      }, 0);
      if (reste < dem * 2) justes.push(`${libellePool.get(pool)}:${dem}p/reste${reste}(max indiv ${maxIndiv})`);
    }
    // Bloc le plus PROFOND atteint dans le segment : sonde des raisons de rejet position par
    // position (le vrai goulot est presque toujours ce bloc-là, pas le premier du segment).
    let sonde = "";
    const blocMax = ordre[Math.min(iMaxSegment, fin - 1)];
    if (blocMax) {
      let nFerme = 0, nPause = 0, nClasse = 0, nSalle = 0, nEnsOcc = 0, nRepos = 0, nPlafond = 0, nOk = 0;
      const unitesB = unitesParPool.get(blocMax.enseignantPool) ?? [];
      for (let jour = 0; jour < p.joursOuvres; jour++) {
        if (!joursPermis(blocMax, jour)) continue;
        const [d1, f1] = bornesPeriodes(p, groupeDe(blocMax, jour));
        positions: for (let per = d1; per + blocMax.duree - 1 <= f1; per++) {
          if (!tientDansBloc(per, blocMax.duree)) { nPause++; continue; }
          if (estFerme(jour, per, blocMax.duree, blocMax.classeId)) { nFerme++; continue; }
          if (!periodesPermises(blocMax.id, per, blocMax.duree)) { nPause++; continue; }
          for (let d = 0; d < blocMax.duree; d++) {
            if (occC.has(`${blocMax.classeId}:${jour}:${per + d}`)) { nClasse++; continue positions; }
          }
          const compatB = sallesCompatibles.get(blocMax.id) ?? [];
          let salleLibre = false;
          for (const sa of compatB) {
            let libre = true;
            for (let d = 0; d < blocMax.duree; d++) if (occR.has(`${sa.nom}:${jour}:${per + d}`)) { libre = false; break; }
            if (libre) { salleLibre = true; break; }
          }
          if (!salleLibre) { nSalle++; continue; }
          let motif = 0; // 1=occupé 2=repos 3=plafond
          let ensLibre = false;
          for (const u of unitesB) {
            if (p.reposEnseignant && reposUnite.get(u.id) === jour) { motif = Math.max(motif, 2); continue; }
            const capU = serviceMax?.get(u.id);
            if (capU !== undefined && (chargeUnite.get(u.id) ?? 0) + blocMax.duree > capU) { motif = Math.max(motif, 3); continue; }
            let occ = false;
            for (let d = 0; d < blocMax.duree; d++) if (occT.has(`${u.id}:${jour}:${per + d}`)) { occ = true; break; }
            if (occ) { motif = Math.max(motif, 1); continue; }
            ensLibre = true;
            break;
          }
          if (ensLibre) nOk++;
          else if (motif === 3) nPlafond++;
          else if (motif === 2) nRepos++;
          else nEnsOcc++;
        }
      }
      sonde = ` → ${blocMax.disciplineNom}(d${blocMax.duree}) ok=${nOk} classe=${nClasse} salle=${nSalle} ensOcc=${nEnsOcc}${nRepos ? ` repos=${nRepos}` : ""}${nPlafond ? ` plafond=${nPlafond}` : ""}${nPause ? ` pause=${nPause}` : ""}${nFerme ? ` fermé=${nFerme}` : ""}`;
    }
    journal.push(
      `essai${essai} s=${s} ${action} ${ref.classeNom} libres=${libres} demande=${demandeSeg}${justes.length ? " pools:" + justes.join(" ") : ""}${sonde}`,
    );
  }

  // PRÉ-TEST de capacité par segment : si un pool requis par la classe n'a plus assez de
  // reliquat cumulé (plafonds de service), inutile de chercher — échec instantané (au lieu de
  // milliers d'étapes brûlées) et, si cela survient GRILLE VIDE, blocage capacitaire explicite.
  let blocageCapaciteMsg: string | null = null;
  function poolManquantPourSegment(deb: number, fin: number): { pool: string; demande: number; reste: number } | null {
    const parPool = new Map<string, number>();
    for (let k = deb; k < fin; k++) {
      const b = ordre[k];
      parPool.set(b.enseignantPool, (parPool.get(b.enseignantPool) ?? 0) + b.duree);
    }
    for (const [pool, dem] of parPool) {
      const unites = unitesParPool.get(pool) ?? [];
      let reste = 0;
      for (const u of unites) {
        const cap = serviceMax?.get(u.id);
        reste += cap === undefined ? dem : Math.max(0, cap - (chargeUnite.get(u.id) ?? 0));
        if (reste >= dem) break;
      }
      if (reste < dem) return { pool, demande: dem, reste };
    }
    return null;
  }

  function resoudreTentative(graine: number, numeroEssai: number): boolean {
    const rnd = mulberry32(graine);
    let s = 0;
    let sauts = 0;
    let echecsTentative = 0;
    const debutPlacements: number[] = [];
    // Échecs cumulés par classe dans CETTE tentative : au 2e échec, la classe est PROMUE EN
    // TÊTE et la tentative repart de zéro (le blocage vient souvent de classes placées bien
    // plus tôt qui ont consommé les enseignants partagés — le saut local n'y peut rien).
    const echecsParClasse = new Map<string, number>();
    while (s < bornesSegments.length) {
      if (abandonne) return false;
      debutPlacements[s] = placements.length;
      const [deb, fin] = bornesSegments[s];
      let okSeg = false;
      const manque = poolManquantPourSegment(deb, fin);
      if (manque) {
        // Pool à sec pour cette classe : échec INSTANTANÉ (aucune recherche). Grille encore
        // vide (s = 0, donc après promotion éventuelle) → le manque est STRUCTUREL : blocage
        // capacitaire explicite plutôt que « génération trop complexe ».
        if (s === 0) {
          const ref = ordre[deb];
          blocageCapaciteMsg = `Le vivier d'enseignants « ${libellePool.get(manque.pool) ?? manque.pool} » est insuffisant : la classe ${ref.classeNom} demande ${manque.demande} h alors qu'il n'en reste que ${manque.reste} (plafonds de service atteints). Ajoutez un enseignant à cette spécialité ou relevez le volume horaire dû.`;
        }
      } else {
        // Dernière tentative globale : paliers élargis (un abandon au cap n'est PAS une
        // preuve d'impossibilité — on donne sa chance à la recherche avant de conclure).
        const caps = numeroEssai >= NB_TENTATIVES - 1 ? CAPS_ETAPES_CLASSE_FINALE : CAPS_ETAPES_CLASSE;
        iMaxSegment = deb;
        // MRV réservé au pré-groupe DOMINÉ par des plages imposées (EPS) : pour une rareté
        // de salles (labos), le signal positionnel trie mal et l'ordre global statique pave
        // mieux (contre-expertise : ablation seed 1118 — 72 étapes sans MRV, échec avec).
        segmentMRV = ordreClasses[s][0] === GROUPE_RARES && raresDominesParPlages;
        for (let essaiSeg = 0; essaiSeg < caps.length && !okSeg; essaiSeg++) {
          if (abandonne) return false;
          if (essaiSeg > 0) {
            // Micro-redémarrage du sous-problème : autres ordres de salles et d'unités.
            sallesActives = new Map([...sallesActives].map(([id, liste]) => [id, melanger(liste, rnd)]));
            unitesActives = new Map([...unitesActives].map(([pool, liste]) => [pool, melanger(liste, rnd)]));
          }
          segmentAbandonne = false;
          // Cap proportionnel à la taille RÉELLE du segment (blocs) : les groupes fusionnés
          // et le pré-groupe des blocs rares co-résolvent bien plus qu'une classe.
          const facteurSegment = Math.max(ordreClasses[s].length, Math.ceil((fin - deb) / 20));
          limiteEtapesSegment = etapes + caps[essaiSeg] * facteurSegment;
          okSeg = placer(deb, fin);
        }
        // Cap d'étapes atteint au dernier palier : l'échec du segment n'est pas prouvé —
        // le message final doit dire « trop complexe », jamais « impossible ».
        if (!okSeg && segmentAbandonne) capSegmentAtteint = true;
        segmentAbandonne = false;
        limiteEtapesSegment = Infinity;
        segmentMRV = false;
      }
      if (okSeg) {
        s++;
        continue;
      }
      if (abandonne) return false;
      echecClasse = ordre[deb] ?? null;
      const groupeBloque = ordreClasses[s];
      const cleGroupe = groupeBloque.join("+");
      const nbEchecs = (echecsParClasse.get(cleGroupe) ?? 0) + 1;
      echecsParClasse.set(cleGroupe, nbEchecs);
      // Mémoire de DIFFICULTÉ persistante entre tentatives : les redémarrages ordonnent les
      // classes par difficulté apprise au lieu de tout remélanger (ce qui détruirait des
      // dizaines de promotions durement acquises sur les grandes cohortes).
      for (const cid of groupeBloque) difficulteClasse.set(cid, (difficulteClasse.get(cid) ?? 0) + 1);
      // Budget temps ADAPTATIF : une tentative qui avance sans échec garde le budget entier
      // (la tuer pour un redémarrage gâcherait un cheminement gagnant) ; dès qu'elle patine,
      // le temps restant est partagé équitablement avec les redémarrages mélangés à venir.
      if (++echecsTentative === SEUIL_PATINAGE) {
        const restant = Math.max(0, debutMs + limiteMs - Date.now());
        finTentativeMs = Math.min(finTentativeMs, Date.now() + restant / Math.max(1, NB_TENTATIVES - numeroEssai));
      }
      if (s === 0 || sauts >= MAX_SAUTS_ARRIERE) {
        // Budget de sauts épuisé : l'échec n'est pas une preuve (des réordonnancements
        // restaient à explorer) — mémorisé pour choisir un message final honnête.
        if (sauts >= MAX_SAUTS_ARRIERE) sautsEpuises = true;
        diagnostiqueSegment(numeroEssai, s, deb, fin, "abandon");
        return false;
      }
      // Le pré-groupe des blocs rares reste TOUJOURS en tête : promotions et fusions
      // s'insèrent juste derrière lui (« base »), jamais devant.
      const base = ordreClasses[0]?.[0] === GROUPE_RARES ? 1 : 0;
      if (nbEchecs >= 3) {
        if (s <= base) {
          // 3e échec juste derrière le pré-groupe des blocs rares : le pavage rare impose à
          // cette classe une position intenable (son EPS posé là où le reste de sa grille ne
          // rentre plus). SES blocs rares lui sont RENDUS — elle placera son EPS elle-même,
          // comme une résolution isolée (mesuré : la classe seule se résout en <1 s). Jamais
          // de FUSION avec le pré-groupe : le méga-segment échoue dans ses caps et, l'ordre
          // persistant entre tentatives, empoisonne tout le budget (mesuré : 0/1571).
          const rares = blocsParClasse.get(GROUPE_RARES);
          const groupe = ordreClasses[s];
          const aExtraire = rares ? rares.filter((b) => groupe.includes(b.classeId)) : [];
          if (aExtraire.length === 0) {
            // Rien à rendre (classe sans bloc rare, ou déjà extraite) : la tentative
            // s'arrête — redémarrage (tri par difficulté) ou repli prendront le relais.
            diagnostiqueSegment(numeroEssai, s, deb, fin, "abandon");
            return false;
          }
          diagnostiqueSegment(numeroEssai, s, deb, fin, "extraction");
          sauts += COUT_PROMOTION;
          defaireJusqua(0);
          blocsParClasse.set(GROUPE_RARES, rares!.filter((b) => !groupe.includes(b.classeId)));
          for (const cid of groupe) {
            const siens = aExtraire.filter((b) => b.classeId === cid);
            if (siens.length === 0) continue;
            const fusionnes = [...(blocsParClasse.get(cid) ?? []), ...siens];
            fusionnes.sort((a, b) => (rangGlobal.get(a.id) ?? 0) - (rangGlobal.get(b.id) ?? 0));
            blocsParClasse.set(cid, fusionnes);
          }
          if (blocsParClasse.get(GROUPE_RARES)!.length === 0) {
            // Pré-groupe entièrement vidé : il disparaît de l'ordre.
            blocsParClasse.delete(GROUPE_RARES);
            ordreClasses = ordreClasses.filter((g) => g[0] !== GROUPE_RARES);
          }
          reconstruireOrdre();
          s = 0;
          continue;
        }
        // ANTI PING-PONG : le groupe a déjà été promu et échoue ENCORE — lui et le dernier
        // promu se renvoient la balle : deux ensembles en ajustement exact sur une ressource
        // partagée ne peuvent pas être résolus dans des segments séparés. FUSION en un seul
        // groupe co-résolu (entrelacement rétabli) ; à l'extrême, les fusions successives
        // convergent vers la recherche globale d'antan.
        diagnostiqueSegment(numeroEssai, s, deb, fin, "fusion");
        sauts += COUT_PROMOTION;
        defaireJusqua(0);
        const groupe = ordreClasses.splice(s, 1)[0];
        ordreClasses[base] = [...ordreClasses[base], ...groupe];
        reconstruireOrdre();
        s = 0;
        continue;
      }
      diagnostiqueSegment(numeroEssai, s, deb, fin, nbEchecs >= 2 ? "promotion" : "saut");
      if (nbEchecs >= 2) {
        // APPRENTISSAGE : classe difficile promue en tête (derrière le pré-groupe rare),
        // tentative rejouée de zéro.
        sauts += COUT_PROMOTION;
        defaireJusqua(0);
        ordreClasses.splice(s, 1);
        ordreClasses.splice(Math.min(base, ordreClasses.length), 0, groupeBloque);
        reconstruireOrdre();
        s = 0;
        continue;
      }
      if (s - 1 < base) {
        // Pas de saut possible devant le pré-groupe : remise à zéro simple (les mélanges de
        // salles/unités des micro-redémarrages font varier la trajectoire du rejeu).
        sauts++;
        defaireJusqua(0);
        s = 0;
        continue;
      }
      // SAUT ARRIÈRE local : on défait la classe précédente, la classe bloquée passe avant.
      sauts++;
      defaireJusqua(debutPlacements[s - 1]);
      ordreClasses.splice(s, 1);
      ordreClasses.splice(s - 1, 0, groupeBloque);
      reconstruireOrdre();
      s = s - 1;
    }
    return true;
  }

  // ── Tentatives : déterministe d'abord, puis redémarrages avec ordres mélangés ──
  // Deux DÉCOMPOSITIONS successives : avec le pré-groupe des blocs rares (plateaux d'abord),
  // puis — si tout a échoué et qu'il reste du budget — REPLI sans pré-groupe (décomposition
  // classique) : le pré-groupe est un pari gagnant sur les grands établissements, mais la
  // contre-expertise a mesuré des instances qui ne se pavent qu'à l'ancienne.
  let succes = false;
  let tempsEpuise = false;
  // Un échec via cap d'étapes ou budget de sauts n'est PAS une preuve d'impossibilité :
  // ces drapeaux routent le message final vers « trop complexe » plutôt qu'« impossible ».
  let capSegmentAtteint = false;
  let sautsEpuises = false;
  const modesDecomposition: boolean[] = preGroupeActif ? [true, false] : [true];
  for (const avecPreGroupe of modesDecomposition) {
  if (succes) break;
  if (preGroupeActif && !avecPreGroupe) {
    if (Date.now() - debutMs > limiteMs) break;
    // Restauration des listes complètes par classe (l'apprentissage de difficulté est gardé).
    blocsParClasse.clear();
    for (const [cid, liste] of blocsParClasseComplet) blocsParClasse.set(cid, liste);
    ordreClasses = initialiserOrdreClasses();
    reconstruireOrdre();
  }
  for (let essai = 0; essai < NB_TENTATIVES && !succes; essai++) {
    if (essai > 0) {
      if (Date.now() - debutMs > limiteMs) {
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
      // L'ordre des CLASSES gouverne la recherche : léger aléa (départage), puis les classes
      // les plus DIFFICILES (échecs cumulés des tentatives précédentes) passent devant — le
      // redémarrage capitalise sur l'apprentissage au lieu de le détruire par un mélange.
      ordreClasses = melanger(ordreClasses, rnd);
      const difficulte = (g: string[]): number =>
        g[0] === GROUPE_RARES ? Number.POSITIVE_INFINITY : Math.max(...g.map((cid) => difficulteClasse.get(cid) ?? 0));
      ordreClasses.sort((a, b) => difficulte(b) - difficulte(a));
      reconstruireOrdre();
    }
    occT = new Set();
    occC = new Set();
    occR = new Set();
    occSig = new Map();
    sessCJ = new Map();
    chargeUnite = new Map();
    quotaRestant = new Map(quotaFlot);
    uniteParPaire = new Map();
    posesParPaire = new Map();
    discCP = new Map();
    seancesDemiDisc = new Map();
    if (p.reposEnseignant) assignerRepos(essai);
    decalageMRV = essai * 7 + (avecPreGroupe ? 0 : 3); // départage MRV différent par essai
    placements = [];
    etapes = 0;
    abandonne = false;
    // Plein budget par défaut — resserré par resoudreTentative dès que la tentative patine.
    finTentativeMs = debutMs + limiteMs;
    succes = resoudreTentative(4243 + essai * 131, essai);
    etapesTotal += etapes;
    if (abandonne) tempsEpuise = tempsEpuise || Date.now() - debutMs > limiteMs;
  }
  }

  if (!succes) {
    const restant = echecClasse ?? ordre[placements.length];
    // Réglages restrictifs choisis par le chef : rappelés dans l'échec — ils peuvent être la
    // cause de la sur-contrainte, l'utilisateur doit pouvoir faire le lien.
    const suffixeReglages =
      p.reglagesActifs && p.reglagesActifs.length > 0
        ? ` Réglages actifs pouvant contraindre : ${p.reglagesActifs.join(", ")} — les désactiver peut débloquer.`
        : "";
    if (blocageCapaciteMsg) {
      blocages.push(blocageCapaciteMsg);
    } else if (tempsEpuise || abandonne || etapes > LIMITE_ETAPES || capSegmentAtteint || sautsEpuises || p.reposEnseignant) {
      // reposEnseignant : l'échec « exhaustif » n'est prouvé QUE pour les affectations de
      // repos essayées (tourniquet) — jamais assez pour affirmer « Impossible ».
      blocages.push(
        `Génération trop complexe pour aboutir dans le temps imparti${restant ? ` (la classe ${restant.classeNom} concentre les difficultés)` : ""}. Réduisez les contraintes (volumes, double vacation${p.reposEnseignant ? ", jour de repos garanti" : ""}${contraintesAdjacence ? ", enchaînement des disciplines (Contraintes supplémentaires)" : ""}) ou ajoutez des ressources (salles, enseignants).${suffixeReglages}`,
      );
    } else if (restant) {
      blocages.push(
        echecClasse
          ? `Impossible de caser la classe ${restant.classeNom} sans conflit (enseignants, salles ou créneaux saturés), même en réordonnant les classes. Vérifiez ses volumes horaires, son régime de vacation et les plages sans cours de son niveau.${suffixeReglages}`
          : `Impossible de placer ${restant.disciplineNom} – ${restant.classeNom} sans conflit (enseignant, classe ou salle occupés sur tous les créneaux possibles).`,
      );
    } else {
      blocages.push(`Aucune solution complète n'a pu être trouvée avec les contraintes actuelles.${suffixeReglages}`);
    }
    return { ok: false, placements: [], blocages, stats: { blocs: p.blocs.length, places: placements.length, etapes: etapesTotal }, journal };
  }

  // Qualité de la première solution, puis optimisation, puis qualité finale.
  const scoreInitial = scoreDe(evaluerPenalites());
  optimiserDeplacements();
  optimiserSwaps();
  optimiserDeplacements();
  const penalites = evaluerPenalites();
  const score = scoreDe(penalites);
  // Détail PAR CLASSE de l'état FINAL : alimente « classes concernées » au clic sur une
  // pastille de pénalité. Seules les classes réellement pénalisées sont remontées.
  const detailParClasse: PenalitesClasse[] = [];
  for (const [classeId, pls] of grouperParClasse()) {
    const pen = penalitesBrutesClasse(pls);
    if (pen.trous || pen.repartition || pen.consecutives || pen.finJournee || pen.pauseMidi) {
      detailParClasse.push({ classeId, penalites: pen });
    }
  }

  // Séances isolées RÉSIDUELLES malgré l'optimisation : signalées explicitement, jamais en
  // silence (l'option « éviter une séance isolée » est best-effort après placement complet).
  const avertissements: string[] = [];
  if (p.eviterSeanceIsoleeEnseignant && (penalites.seancesIsoleesEnseignants ?? 0) > 0) {
    const details: string[] = [];
    for (const pls of grouperParEnseignant().values()) {
      const n = seancesIsoleesDe(pls);
      if (n > 0) details.push(`${pls[0].enseignantNom} (${n})`);
    }
    avertissements.push(
      `Séances isolées résiduelles malgré l'optimisation — ${details.join(", ")} : demi-journée(s) où l'enseignant n'a qu'une seule séance. Ajustez par glisser-déposer ou assouplissez les contraintes.`,
    );
  }
  // Fins de journée répétées résiduelles (option eviterFinJourneeRepetee) : même principe.
  if (p.eviterFinJourneeRepetee && (penalites.finsJourneesRepetees ?? 0) > 0) {
    const details: string[] = [];
    for (const pls of grouperParClasse().values()) {
      const n = finsRepeteesDe(pls);
      if (n > 0) details.push(`${pls[0].classeNom} (${n})`);
    }
    avertissements.push(
      `Fins de journée répétées malgré l'optimisation — ${details.join(", ")} : jours consécutifs se terminant par la même discipline. Ajustez par glisser-déposer ou assouplissez les contraintes.`,
    );
  }

  return {
    ok: true,
    placements: [...placements],
    blocages: [],
    stats: { blocs: p.blocs.length, places: placements.length, etapes: etapesTotal },
    qualite: { score, scoreInitial, penalites, parClasse: detailParClasse },
    avertissements: avertissements.length > 0 ? avertissements : undefined,
  };
}
