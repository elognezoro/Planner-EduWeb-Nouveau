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
   * Plafond de SERVICE hebdomadaire par unité-enseignant (id → nb de périodes max/semaine),
   * issu du « volume horaire dû » selon le cycle. Contrainte DURE : une unité n'est jamais
   * chargée au-delà. Une unité absente de la table n'a pas de plafond (capacité physique).
   */
  capaciteServiceParUnite?: Map<string, number>;
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

  // Créneaux fermés dans tout l'établissement (jour / demi-journée sans cours).
  const periodesFermees = p.periodesFermees ?? new Set<string>();
  const estFerme = (jour: number, periode: number, duree = 1): boolean => {
    for (let d = 0; d < duree; d++) if (periodesFermees.has(`${jour}:${periode + d}`)) return true;
    return false;
  };
  // Nombre de créneaux (jour,période) réellement ouverts, pour les vérifications de capacité.
  let creneauxOuverts = 0;
  for (let j = 0; j < p.joursOuvres; j++)
    for (let per = 0; per < p.periodesParJour; per++) if (!estFerme(j, per)) creneauxOuverts++;

  const unitesParPool = new Map<string, EnseignantUnite[]>();
  for (const u of p.enseignants) {
    const arr = unitesParPool.get(u.pool) ?? [];
    arr.push(u);
    unitesParPool.set(u.pool, arr);
  }

  // ── Pré-vérifications ──
  const sallesCompatibles = new Map<string, SalleSolveur[]>();
  const poolsVus = new Set<string>();
  // Restriction de périodes par bloc (ex : plages d'EPS) — pré-résolue en Set.
  const autoriseesParBloc = new Map<string, Set<number>>();
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
    if (bloc.periodesAutorisees) {
      const set = new Set(bloc.periodesAutorisees);
      autoriseesParBloc.set(bloc.id, set);
      let possible = false;
      for (let jour = 0; jour < p.joursOuvres && !possible; jour++) {
        if (!joursPermis(bloc, jour)) continue;
        const [debV, finV] = bornesPeriodes(p, groupeDe(bloc, jour));
        for (let per = debV; per + bloc.duree - 1 <= finV && !possible; per++) {
          if (!tientDansBloc(per, bloc.duree)) continue;
          if (estFerme(jour, per, bloc.duree)) continue; // plage sans cours
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

  // Capacité par pool d'enseignants.
  const demandeParPool = new Map<string, { duree: number; label: string }>();
  for (const b of p.blocs) {
    const e = demandeParPool.get(b.enseignantPool) ?? { duree: 0, label: b.poolLabel };
    e.duree += b.duree;
    demandeParPool.set(b.enseignantPool, e);
  }
  // Avec le jour de repos garanti, chaque unité ne peut travailler que (jours ouvrés − 1) jours ;
  // et seuls les créneaux ouverts (hors plages sans cours) comptent.
  const joursTravaillables = Math.max(1, p.joursOuvres - (p.reposEnseignant ? 1 : 0));
  const periodesOuvertesParJour = creneauxOuverts / Math.max(1, p.joursOuvres);
  const capaciteUnite = Math.max(1, Math.floor(periodesOuvertesParJour * joursTravaillables));
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
      blocages.push(
        `Pas assez d'enseignants pour ${info.label} : ${info.duree} créneaux à couvrir, ${unites.length} enseignant(s) pour une capacité de ${offre}${plafonne ? " (limitée par le volume horaire dû)" : ""} — ajoutez ~${manque} enseignant(s)${plafonne ? " ou augmentez le volume horaire" : ""}.`,
      );
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
        const libelles = c.pools
          .map((pool) => demandeParPool.get(pool)!.label)
          .slice(0, 4)
          .join(", ");
        blocages.push(
          `Pas assez d'enseignants pour l'ensemble lié ${libelles} : ${c.demande} créneaux à couvrir pour une capacité de ${offre} (${ids.size} enseignant(s)) — les bivalents ne peuvent pas être à deux endroits à la fois (ajoutez ~${manque} ou augmentez le volume horaire).`,
        );
      }
    }
  }

  // Capacité par classe — fenêtre calculée JOUR PAR JOUR (la vacation peut varier :
  // journée entière le jour d'EPS, demi-journée les autres jours).
  const parClasse = new Map<string, { duree: number; nom: string; ref: BlocCours }>();
  for (const b of p.blocs) {
    const e = parClasse.get(b.classeId) ?? { duree: 0, nom: b.classeNom, ref: b };
    e.duree += b.duree;
    parClasse.set(b.classeId, e);
  }
  for (const [, info] of parClasse) {
    let dispo = 0;
    for (let jour = 0; jour < p.joursOuvres; jour++) {
      const [deb, fin] = bornesPeriodes(p, groupeDe(info.ref, jour));
      for (let per = deb; per <= fin; per++) if (!estFerme(jour, per)) dispo++; // hors plages sans cours
    }
    if (info.duree > dispo) {
      blocages.push(`${info.nom} : ${info.duree} créneaux à placer pour ${dispo} disponibles dans la semaine. Réduisez le volume horaire ou les plages sans cours.`);
    }
  }

  if (blocages.length > 0) {
    return { ok: false, placements: [], blocages, stats: { blocs: p.blocs.length, places: 0, etapes: 0 } };
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
  const ordre = [...p.blocs].sort((a, b) => {
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
    return (a.vacationGroupe !== null ? 0 : 1) - (b.vacationGroupe !== null ? 0 : 1);
  });

  // État de la tentative courante (réinitialisé à chaque redémarrage randomisé).
  let occT = new Set<string>(); // unitéEnseignant occupée
  let occC = new Set<string>(); // classe occupée
  let occR = new Set<string>(); // salle occupée
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
  // Jour de repos garanti : attribution STATIQUE d'un jour de repos par unité, répartie
  // en tourniquet et décalée à chaque tentative. Le backtracking élague ainsi dès le
  // choix du jour, au lieu de découvrir l'impasse tardivement (explosion combinatoire).
  let reposUnite = new Map<string, number>();
  function assignerRepos(decalage: number) {
    reposUnite = new Map();
    let k = 0;
    for (const u of p.enseignants) {
      if (reposUnite.has(u.id)) continue;
      reposUnite.set(u.id, (k + decalage) % p.joursOuvres);
      k++;
    }
  }
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
    // Plage sans cours (établissement) : aucun placement possible.
    if (estFerme(jour, periode, duree)) return false;
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
    if (++etapes > LIMITE_ETAPES || (etapes % 256 === 0 && Date.now() > finTentativeMs)) {
      abandonne = true;
      return false;
    }
    const bloc = ordre[i];
    const compat = sallesActives.get(bloc.id)!;
    const unites = unitesActives.get(bloc.enseignantPool)!;

    // Étalement (souple) : jours où la classe a le moins de séances d'abord (compteur incrémental).
    const sessionsJour = compteJours(bloc.classeId);
    const jours = [...Array(p.joursOuvres).keys()].sort((x, y) => sessionsJour[x] - sessionsJour[y]);

    for (const jour of jours) {
      if (abandonne) return false;
      if (!joursPermis(bloc, jour)) continue; // cours fixé à des jours précis (ex : jour d'EPS)
      const [deb, fin] = bornesPeriodes(p, groupeDe(bloc, jour));
      bouclePeriodes: for (let periode = deb; periode + bloc.duree - 1 <= fin; periode++) {
        if (!tientDansBloc(periode, bloc.duree)) continue; // ne pas traverser une pause
        if (estFerme(jour, periode, bloc.duree)) continue; // plage sans cours (établissement)
        if (!periodesPermises(bloc.id, periode, bloc.duree)) continue; // plages autorisées (ex : EPS)
        // Classe libre ? (indépendant de la salle et de l'enseignant — vérifié UNE fois)
        for (let d = 0; d < bloc.duree; d++) {
          if (occC.has(`${bloc.classeId}:${jour}:${periode + d}`)) continue bouclePeriodes;
        }
        // Cassage de symétrie EXACT : les salles de même signature (type, capacité) sont
        // interchangeables — une seule salle LIBRE par signature suffit comme candidate.
        const sallesCandidates: SalleSolveur[] = [];
        const signaturesVues = new Set<string>();
        for (const salle of compat) {
          const sig = `${salle.type}:${salle.capacite}`;
          if (signaturesVues.has(sig)) continue;
          let libre = true;
          for (let d = 0; d < bloc.duree; d++) {
            if (occR.has(`${salle.nom}:${jour}:${periode + d}`)) {
              libre = false;
              break;
            }
          }
          if (!libre) continue;
          signaturesVues.add(sig);
          sallesCandidates.push(salle);
        }
        if (sallesCandidates.length === 0) continue;
        for (const unite of unites) {
          if (abandonne) return false;
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
            if (serviceMax?.has(unite.id)) chargeUnite.set(unite.id, (chargeUnite.get(unite.id) ?? 0) + bloc.duree);
            if (placer(i + 1)) return true;
            if (serviceMax?.has(unite.id)) chargeUnite.set(unite.id, (chargeUnite.get(unite.id) ?? 0) - bloc.duree);
            sessionsJour[jour]--;
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
    if (p.optimiserEnseignants) {
      let te = 0;
      for (const pls of grouperParEnseignant().values()) te += trousEnseignant(pls);
      tot.trousEnseignants = te;
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
      (pen.trousEnseignants ?? 0) * 2
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
    const parEnseignant = p.optimiserEnseignants ? grouperParEnseignant() : null;
    let budget = 1_500_000;
    for (let pass = 0; pass < 4; pass++) {
      let ameliore = false;
      for (const pl of placements) {
        const cls = parClasse.get(pl.classeId)!;
        const ens = parEnseignant?.get(pl.enseignantId) ?? null;
        const blocPl = blocParId.get(pl.blocId);
        // Pénalité combinée : la classe du cours + (option) les heures creuses de SON enseignant.
        const mesure = () => penaliteClasse(cls) + (ens ? trousEnseignant(ens) * 2 : 0);
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
    const parEnseignant = p.optimiserEnseignants ? grouperParEnseignant() : null;
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
          // Pénalité combinée : les deux classes + (option) les enseignants concernés.
          const ensIds = parEnseignant ? [...new Set([pl1.enseignantId, pl2.enseignantId])] : [];
          const penEns = () =>
            ensIds.reduce((acc, id) => acc + trousEnseignant(parEnseignant!.get(id)!) * 2, 0);
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
    sessCJ = new Map();
    chargeUnite = new Map();
    if (p.reposEnseignant) assignerRepos(essai);
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
      blocages.push(
        `Génération trop complexe pour aboutir dans le temps imparti. Réduisez les contraintes (volumes, double vacation${p.reposEnseignant ? ", jour de repos garanti" : ""}) ou ajoutez des ressources (salles, enseignants).`,
      );
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
